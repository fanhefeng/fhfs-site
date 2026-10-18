import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import {
  assessRuns,
  mergeRunAttempts,
  monitorChecks,
  NATURAL_CREATE_DEADLINE,
  requiredJob,
  restoreComparisonPassed,
  validHealthchecksUrl,
  type MonitorJob,
  type MonitorCheck,
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
  updated_at: fields.run_started_at ?? fields.created_at ?? new Date(now).toISOString(),
  ...fields,
});

const assessCheck = (check: MonitorCheck, at = now) =>
  assessRuns(check.runs, at, check.hours, "main", { freshnessRuns: check.freshnessRuns });
const healthCheck = (history: MonitorRun[]) =>
  monitorChecks(history, [], [], now).find((check) => check.label === "health")!;
const healthRun = (fields: Partial<MonitorRun> = {}) =>
  run({ display_title: "private backup / health", ...fields });

describe("cloud monitoring policy", () => {
  it("replays the October 18 delayed health run without rejecting the verified morning backup", () => {
    const at = Date.parse("2026-10-18T05:49:08.357Z");
    const previous = healthRun({
      id: 39054126966,
      created_at: "2026-10-17T17:31:22Z",
      run_started_at: "2026-10-17T17:31:22Z",
      updated_at: "2026-10-17T17:32:00Z",
    });
    const morning = run({
      id: 39075009188,
      created_at: "2026-10-17T22:25:26Z",
      run_started_at: "2026-10-17T22:25:26Z",
      updated_at: "2026-10-17T22:27:32Z",
    });
    const check = healthCheck([previous, morning]);
    const result = assessCheck(check, at);
    expect(result.problems).toEqual([]);
    // The caller must verify the create job's real backup + health step.
    expect(result.successful).toBe(morning);
    expect(
      requiredJob(
        [
          {
            id: 117520224435,
            status: "completed",
            conclusion: "success",
            steps: [],
          },
        ],
        check.step,
      ),
    ).toBeUndefined();
  });

  it("keeps explicit health failures actionable even after a newer successful create", () => {
    for (const conclusion of ["failure", "timed_out", "cancelled", "skipped", "action_required"])
      expect(
        assessCheck(
          healthCheck([
            healthRun({ conclusion }),
            run({ id: 2, run_started_at: new Date(now).toISOString() }),
          ]),
        ).problems,
      ).toContain(`latest completed run is ${conclusion}`);
  });

  it("never lets a healthy check cover a failed create or a rerun awaiting verification", () => {
    const history = [
      run({ conclusion: "failure" }),
      healthRun({ id: 2, run_started_at: new Date(now).toISOString() }),
    ];
    const create = monitorChecks(history, [], [], now).find((check) => check.label === "create")!;
    expect(assessCheck(create).problems).toContain("latest completed run is failure");
    expect(
      assessCheck(
        healthCheck([
          run(),
          healthRun({ id: 2, run_attempt: 2, status: "in_progress", conclusion: null }),
        ]),
      ).problems,
    ).toContain("rerun is awaiting verification");
  });

  it("still alerts when backup health evidence is missing or more than twelve hours old", () => {
    const stale = new Date(now - 12 * 3_600_000 - 1).toISOString();
    expect(assessCheck(healthCheck([])).problems).toContain("no successful run");
    expect(
      assessCheck(
        healthCheck([healthRun({ run_started_at: stale }), run({ id: 2, run_started_at: stale })]),
      ).problems,
    ).toContain("successful run is outside the 12 hour window");
    for (const fields of [
      { head_branch: "feature" },
      { status: "in_progress", conclusion: null },
      { conclusion: "skipped" },
      { display_title: "private backup / alert-test" },
      { display_title: "private backup / verify" },
    ])
      expect(
        assessCheck(healthCheck([healthRun({ run_started_at: stale }), run({ id: 2, ...fields })]))
          .problems,
      ).toContain("successful run is outside the 12 hour window");
  });

  it("retains the daily and natural backup deadlines independently of recent health checks", () => {
    const stale = run({ created_at: new Date(now - 36 * 3_600_000 - 1).toISOString() });
    const history = [stale, healthRun({ id: 2 })];
    for (const label of ["create", "natural create"]) {
      const check = monitorChecks(history, [], [], now).find((entry) => entry.label === label)!;
      expect(assessCheck(check).problems).toContain("successful run is outside the 36 hour window");
    }
    const manual = run({ id: 3, event: "workflow_dispatch" });
    expect(assessCheck(healthCheck([manual])).problems).toEqual([]);
    const natural = monitorChecks([stale, manual], [], [], now).find(
      (check) => check.label === "natural create",
    )!;
    expect(assessCheck(natural).problems).toContain("successful run is outside the 36 hour window");
  });

  it("keeps the other workflow requirements and the natural-create rollout date", () => {
    const browser = run({ id: 2 });
    const snapshot = run({ id: 3 });
    const checks = monitorChecks([], [browser], [snapshot], NATURAL_CREATE_DEADLINE - 1);
    expect(checks.some((check) => check.label === "natural create")).toBe(false);
    expect(assessCheck(checks.find((check) => check.label === "browser flows")!).successful).toBe(
      browser,
    );
    expect(assessCheck(checks.find((check) => check.label === "public snapshot")!).successful).toBe(
      snapshot,
    );
  });

  it("schedules health checks at most six hours apart, including overnight", () => {
    const workflow = readFileSync(
      new URL("../../../.github/workflows/private-backup.yml", import.meta.url),
      "utf8",
    );
    const hours = /cron: "37 ([\d,]+) \* \* \*"/
      .exec(workflow)![1]!
      .split(",")
      .map(Number)
      .sort((a, b) => a - b);
    const gaps = hours.map((hour, i) => (hours[(i + 1) % hours.length]! - hour + 24) % 24);
    expect(hours.length).toBe(4);
    expect(Math.max(...gaps)).toBe(6);
  });

  it("keeps the newest attempt and update when parallel API responses overlap", () => {
    const old = run({ run_attempt: 1, conclusion: "failure" });
    const fresh = run({ run_attempt: 2, conclusion: "success" });
    expect(mergeRunAttempts([fresh, old])).toEqual([fresh]);
    expect(mergeRunAttempts([old, fresh])).toEqual([fresh]);
    const complete = run({ run_attempt: 2, updated_at: new Date(now).toISOString() });
    const pending = run({
      run_attempt: 2,
      status: "in_progress",
      conclusion: null,
      updated_at: new Date(now - 1000).toISOString(),
    });
    expect(mergeRunAttempts([complete, pending])).toEqual([complete]);
  });
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
      expect(
        assessRuns([run({ event })], now, 36, "main", { scheduledOnly: true }).problems,
      ).toContain("no successful run");
    expect(assessRuns([run()], now, 36, "main", { scheduledOnly: true }).problems).toEqual([]);
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
