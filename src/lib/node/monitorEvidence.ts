import { requiredJob, type MonitorJob, type MonitorRun } from "../monitor";

export class MonitorEvidenceError extends Error {}

/** Shared across all checks, rather than two minutes for each selected run. */
export const JOB_EVIDENCE_WINDOW_MS = 120_000;
const DELAYS = [10_000, 20_000, 40_000];
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
type AttemptJob = MonitorJob & { run_id: number; run_attempt: number };

/** Retry only incomplete metadata; explicit failures and unverifiable responses fail closed. */
export async function readJobEvidence(
  run: MonitorRun,
  step: string,
  read: (path: string, signal?: AbortSignal) => Promise<unknown>,
  {
    sleep = wait,
    now = Date.now,
    deadline = now() + JOB_EVIDENCE_WINDOW_MS,
  }: { sleep?: (ms: number) => Promise<void>; now?: () => number; deadline?: number } = {},
): Promise<MonitorJob> {
  for (let attempt = 0; now() < deadline; attempt++) {
    const signal = AbortSignal.timeout(Math.max(1, deadline - now()));
    const data = (await read(
      `actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`,
      signal,
    )) as { total_count: number; jobs: AttemptJob[] } | null;
    if (
      !data ||
      !Array.isArray(data.jobs) ||
      data.total_count !== data.jobs.length ||
      data.jobs.some((job) => !job || !Array.isArray(job.steps))
    )
      throw new MonitorEvidenceError("Invalid job evidence");
    for (const job of data.jobs) {
      if (job.run_id !== run.id || job.run_attempt !== run.run_attempt)
        throw new MonitorEvidenceError("job identity does not match the selected run attempt");
      if (job.conclusion && job.conclusion !== "success")
        throw new MonitorEvidenceError("job did not succeed");
      if (job.steps.some((s) => s.name === step && s.conclusion && s.conclusion !== "success"))
        throw new MonitorEvidenceError("critical step did not succeed");
    }
    // Re-read the run after its jobs: a rerun may have begun while the jobs
    // endpoint caught up. The old successful attempt must not hide that rerun.
    const latest = (await read(`actions/runs/${run.id}`, signal)) as Partial<MonitorRun> | null;
    if (!latest || latest.id !== run.id || latest.run_attempt !== run.run_attempt)
      throw new MonitorEvidenceError("run attempt changed during verification");
    if (latest.conclusion && latest.conclusion !== "success")
      throw new MonitorEvidenceError("run did not succeed");
    const job = requiredJob(data.jobs, step);
    if (job && latest.status === "completed" && latest.conclusion === "success" && now() < deadline)
      return job;

    const delay = DELAYS[attempt];
    if (delay === undefined || now() + delay >= deadline) break;
    await sleep(delay);
  }
  throw new MonitorEvidenceError(
    "critical step evidence remained incomplete after bounded retries",
  );
}
