import { describe, expect, it } from "vite-plus/test";
import {
  assessRuns,
  NATURAL_CREATE_DEADLINE,
  requiredJob,
  restoreComparisonPassed,
  validHealthchecksUrl,
  type MonitorJob,
  type MonitorRun,
} from "@/lib/monitor";

const now = Date.parse("2026-10-15T09:00:00Z");
const run = (fields: Partial<MonitorRun> = {}): MonitorRun => ({
  id: 1,
  display_title: "private backup / create",
  head_branch: "main",
  event: "schedule",
  status: "completed",
  conclusion: "success",
  created_at: new Date(now - 3_600_000).toISOString(),
  run_started_at: fields.created_at ?? new Date(now - 3_600_000).toISOString(),
  run_attempt: 1,
  ...fields,
});

describe("cloud monitoring policy", () => {
  it("requires a recent real success on the default branch", () => {
    expect(assessRuns([run()], now, 36, "main").problems).toEqual([]);
    for (const fields of [
      { head_branch: "feature" },
      { status: "in_progress" },
      { conclusion: "skipped" },
      { conclusion: "cancelled" },
    ])
      expect(assessRuns([run(fields)], now, 36, "main").problems.length).toBeGreaterThan(0);
  });

  it("alerts on a new failure even when an older successful backup is still fresh", () => {
    const failed = run({ id: 2, conclusion: "failure", created_at: new Date(now).toISOString() });
    expect(assessRuns([run(), failed], now, 36, "main").problems).toContain(
      "latest completed run is failure",
    );
    const recovered = run({ id: 3, created_at: new Date(now + 1000).toISOString() });
    expect(assessRuns([failed, run(), recovered], now, 36, "main").problems).toEqual([]);
  });

  it("orders reruns by the latest attempt, never by original creation", () => {
    const oldRerun = run({
      id: 2,
      created_at: "2026-01-01T00:00:00Z",
      run_started_at: new Date(now).toISOString(),
      run_attempt: 2,
      conclusion: "failure",
    });
    expect(assessRuns([run(), oldRerun], now, 36, "main").problems).toContain(
      "latest completed run is failure",
    );
    expect(
      assessRuns([run(), { ...oldRerun, status: "in_progress", conclusion: null }], now, 36, "main")
        .problems,
    ).toContain("rerun is awaiting verification");
    expect(
      assessRuns(
        [oldRerun, { ...oldRerun, run_attempt: 3, conclusion: "success" }],
        now,
        36,
        "main",
      ).problems,
    ).toEqual([]);
  });

  it("rejects stale, invalid and implausibly future timestamps", () => {
    for (const created_at of [
      new Date(now - 36 * 3_600_000 - 1).toISOString(),
      new Date(now + 300_001).toISOString(),
      "invalid",
    ])
      expect(assessRuns([run({ created_at })], now, 36, "main").problems.length).toBeGreaterThan(0);
  });

  it("never accepts manual or push runs as natural schedule evidence", () => {
    expect(NATURAL_CREATE_DEADLINE).toBe(Date.parse("2026-10-14T16:17:00+08:00"));
    for (const event of ["workflow_dispatch", "push"])
      expect(assessRuns([run({ event })], now, 36, "main", true).problems).toContain(
        "no successful run",
      );
    expect(assessRuns([run()], now, 36, "main", true).problems).toEqual([]);
  });

  it("requires the actual critical step rather than a green skipped job", () => {
    const job: MonitorJob = {
      id: 2,
      status: "completed",
      conclusion: "success",
      steps: [{ name: "Run pnpm e2e", status: "completed", conclusion: "success" }],
    };
    expect(requiredJob([job], "Run pnpm e2e")).toBe(job);
    expect(requiredJob([{ ...job, steps: [] }], "Run pnpm e2e")).toBeUndefined();
    expect(
      requiredJob(
        [{ ...job, steps: [{ ...job.steps[0]!, conclusion: "skipped" }] }],
        "Run pnpm e2e",
      ),
    ).toBeUndefined();
  });

  it("requires native table, column, migration and sequence comparison in the restore step", () => {
    const summary =
      "Postgres restore drill passed: 17 tables, 14 sequences; rows, columns and migration history match.";
    const start = "2026-10-13T10:08:00Z",
      end = "2026-10-13T10:09:17Z";
    const prefix = "2026-10-13T10:09:14.8337980Z ";
    for (const changed of [
      summary.replace("14 sequences", "0 sequences"),
      summary.replace("17 tables", "16 tables"),
      summary.replace("14 sequences", "13 sequences"),
    ])
      expect(
        restoreComparisonPassed(prefix + changed, start, end, { tables: 17, sequences: 14 }),
      ).toBe(false);
    expect(
      restoreComparisonPassed(prefix + summary.replace("17 tables", "18 tables"), start, end, {
        tables: 18,
        sequences: 14,
      }),
    ).toBe(true);
    expect(
      restoreComparisonPassed(prefix + summary, start, end, { tables: 17, sequences: 14 }),
    ).toBe(true);
    expect(
      restoreComparisonPassed("2026-10-13T11:00:00Z " + summary, start, end, {
        tables: 17,
        sequences: 14,
      }),
    ).toBe(false);
    expect(
      restoreComparisonPassed(prefix + "pg_restore exited 0", start, end, {
        tables: 17,
        sequences: 14,
      }),
    ).toBe(false);
    expect(
      restoreComparisonPassed(prefix + summary, "invalid", end, { tables: 17, sequences: 14 }),
    ).toBe(false);
    expect(
      restoreComparisonPassed(prefix + summary.replace("17 tables", "0 tables"), start, end, {
        tables: 17,
        sequences: 14,
      }),
    ).toBe(false);
  });

  it("restricts ping destinations to a plain Healthchecks UUID URL", () => {
    const url = "https://hc-ping.com/11111111-2222-3333-4444-555555555555";
    expect(validHealthchecksUrl(url)).toBe(true);
    for (const value of [
      url + "/fail",
      url + "?token=x",
      url.replace("https:", "http:"),
      url.replace("hc-ping.com", "example.org"),
      "",
    ])
      expect(validHealthchecksUrl(value)).toBe(false);
  });
});
