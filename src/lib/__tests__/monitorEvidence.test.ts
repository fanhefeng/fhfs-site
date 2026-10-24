import { describe, expect, it, vi } from "vite-plus/test";
import { readJobEvidence } from "@/lib/node/monitorEvidence";
import type { MonitorRun, MonitorJob } from "@/lib/monitor";

const step = "Run backup operation and verify freshness";
const run: MonitorRun = {
  id: 40116677924,
  run_attempt: 1,
  display_title: "private backup / health",
  head_branch: "main",
  event: "schedule",
  status: "completed",
  conclusion: "success",
  created_at: "2026-10-24T17:33:40Z",
  run_started_at: "2026-10-24T17:33:40Z",
  updated_at: "2026-10-24T17:43:16Z",
};
const job = {
  id: 120939287442,
  run_id: run.id,
  run_attempt: 1,
  status: "completed",
  conclusion: "success",
  steps: [{ name: step, status: "completed", conclusion: "success" }],
};

function fixture(snapshots: unknown[], latest: unknown = run) {
  let time = 0;
  let reads = 0;
  const paths: string[] = [];
  const read = vi.fn((path: string) => {
    paths.push(path);
    return Promise.resolve(
      path.includes("/jobs?") ? snapshots[Math.min(reads++, snapshots.length - 1)] : latest,
    );
  });
  const sleep = vi.fn((ms: number) => {
    time += ms;
    return Promise.resolve();
  });
  const options = { sleep, now: () => time, deadline: 120_000 };
  return { read, sleep, paths, options, advance: (ms: number) => (time += ms) };
}
const response = (jobs: MonitorJob[]) => ({ total_count: jobs.length, jobs });

describe("cloud audit job evidence", () => {
  it("accepts real successful evidence without a retry and pins the selected attempt", async () => {
    const f = fixture([response([job])]);
    await expect(readJobEvidence(run, step, f.read, f.options)).resolves.toEqual(job);
    expect(f.paths).toContain(`actions/runs/${run.id}/attempts/1/jobs?per_page=100`);
    expect(f.sleep).not.toHaveBeenCalled();
  });

  it.each([
    response([]),
    response([{ ...job, status: "in_progress", conclusion: null }]),
    response([{ ...job, steps: [] }]),
    response([{ ...job, steps: [{ name: step, status: "in_progress", conclusion: null }] }]),
  ])("rechecks incomplete evidence for the same successful run: %j", async (incomplete) => {
    const f = fixture([incomplete, response([job])]);
    await expect(readJobEvidence(run, step, f.read, f.options)).resolves.toEqual(job);
    expect(f.sleep).toHaveBeenCalledExactlyOnceWith(10_000);
  });

  it("alerts after four reads when evidence never catches up", async () => {
    const f = fixture([response([])]);
    await expect(readJobEvidence(run, step, f.read, f.options)).rejects.toThrow(
      "critical step evidence remained incomplete",
    );
    expect(f.sleep.mock.calls.flat()).toEqual([10_000, 20_000, 40_000]);
    expect(f.paths.filter((p) => p.includes("/jobs?"))).toHaveLength(4);
  });

  it.each(["failure", "timed_out", "cancelled", "skipped", "neutral", "action_required"])(
    "does not retry or mask an explicit job %s with a later success",
    async (conclusion) => {
      const f = fixture([response([{ ...job, conclusion }]), response([job])]);
      await expect(readJobEvidence(run, step, f.read, f.options)).rejects.toThrow(
        "job did not succeed",
      );
      expect(f.sleep).not.toHaveBeenCalled();
    },
  );

  it.each(["failure", "timed_out", "cancelled", "skipped"])(
    "does not retry an explicit critical step %s",
    async (conclusion) => {
      const f = fixture([
        response([{ ...job, steps: [{ name: step, status: "completed", conclusion }] }]),
        response([job]),
      ]);
      await expect(readJobEvidence(run, step, f.read, f.options)).rejects.toThrow(
        "critical step did not succeed",
      );
      expect(f.sleep).not.toHaveBeenCalled();
    },
  );

  it("never lets a healthy sibling job hide a failed job", async () => {
    const f = fixture([response([job, { ...job, id: 2, conclusion: "failure" }])]);
    await expect(readJobEvidence(run, step, f.read, f.options)).rejects.toThrow(
      "job did not succeed",
    );
  });

  it("rejects a new run attempt instead of accepting the previously successful one", async () => {
    const f = fixture([response([job])], { ...run, run_attempt: 2, status: "in_progress" });
    await expect(readJobEvidence(run, step, f.read, f.options)).rejects.toThrow("attempt changed");
    expect(f.sleep).not.toHaveBeenCalled();
  });

  it.each([{ run_attempt: 2 }, { run_id: 9 }])(
    "rejects mismatched job identity: %j",
    async (fields) => {
      const f = fixture([response([{ ...job, ...fields }])]);
      await expect(readJobEvidence(run, step, f.read, f.options)).rejects.toThrow(
        "job identity does not match",
      );
      expect(f.sleep).not.toHaveBeenCalled();
    },
  );

  it("fails immediately if the workflow itself now reports failure", async () => {
    const f = fixture([response([job])], { ...run, conclusion: "failure" });
    await expect(readJobEvidence(run, step, f.read, f.options)).rejects.toThrow(
      "run did not succeed",
    );
    expect(f.sleep).not.toHaveBeenCalled();
  });

  it("bounds retries by a deadline shared with earlier evidence checks", async () => {
    const f = fixture([response([]), response([job])]);
    f.advance(115_000);
    await expect(readJobEvidence(run, step, f.read, f.options)).rejects.toThrow(
      "critical step evidence remained incomplete",
    );
    expect(f.sleep).not.toHaveBeenCalled();
  });

  it.each([null, {}, { jobs: "invalid" }, { total_count: 101, jobs: [job] }])(
    "never treats malformed or truncated evidence as healthy: %j",
    async (data) => {
      const f = fixture([data]);
      await expect(readJobEvidence(run, step, f.read, f.options)).rejects.toThrow(
        "Invalid job evidence",
      );
      expect(f.sleep).not.toHaveBeenCalled();
    },
  );

  it("propagates unavailable API evidence without converting it to success", async () => {
    const f = fixture([]);
    f.read.mockRejectedValueOnce(new Error("GitHub verification unavailable (HTTP 403)"));
    await expect(readJobEvidence(run, step, f.read, f.options)).rejects.toThrow("HTTP 403");
    expect(f.sleep).not.toHaveBeenCalled();
  });
});
