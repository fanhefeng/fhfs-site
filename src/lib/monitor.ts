/** Decisions shared by the cloud audit and its synthetic failure checks. */
export type MonitorRun = {
  id: number;
  display_title: string;
  head_branch: string;
  event: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  run_started_at: string;
  run_attempt: number;
  updated_at: string;
};

/** Parallel API queries may return different attempts of the same run. */
export function mergeRunAttempts(runs: MonitorRun[]): MonitorRun[] {
  const byId = new Map<number, MonitorRun>();
  for (const run of runs) {
    const old = byId.get(run.id);
    if (
      !old ||
      run.run_attempt > old.run_attempt ||
      (run.run_attempt === old.run_attempt &&
        Date.parse(run.updated_at) > Date.parse(old.updated_at))
    )
      byId.set(run.id, run);
  }
  return [...byId.values()];
}

export function latestAttemptFirst(a: MonitorRun, b: MonitorRun): number {
  return (
    Date.parse(b.run_started_at) - Date.parse(a.run_started_at) || b.run_attempt - a.run_attempt
  );
}

export type MonitorJob = {
  id: number;
  status: string;
  conclusion: string | null;
  steps: {
    name: string;
    status: string;
    conclusion: string | null;
    started_at?: string;
    completed_at?: string;
  }[];
};

export const NATURAL_CREATE_DEADLINE = Date.parse("2026-10-14T08:17:00Z");

export function assessRuns(
  runs: MonitorRun[],
  now: number,
  hours: number,
  branch: string,
  scheduledOnly = false,
): { problems: string[]; successful?: MonitorRun } {
  const completed = runs
    .filter(
      (r) =>
        r.head_branch === branch &&
        r.status === "completed" &&
        (!scheduledOnly || r.event === "schedule"),
    )
    .sort(latestAttemptFirst);
  const problems: string[] = [];
  if (runs.some((r) => r.head_branch === branch && r.run_attempt > 1 && r.status !== "completed"))
    problems.push("rerun is awaiting verification");
  if (completed.some((r) => !Number.isFinite(Date.parse(r.run_started_at))))
    problems.push("invalid run timestamp");
  if (completed[0] && completed[0].conclusion !== "success")
    problems.push(`latest completed run is ${completed[0].conclusion ?? "unknown"}`);
  const successful = completed.find((r) => r.conclusion === "success");
  if (!successful) problems.push("no successful run");
  else {
    const age = now - Date.parse(successful.run_started_at);
    if (!Number.isFinite(age) || age < -300_000 || age > hours * 3_600_000)
      problems.push(`successful run is outside the ${hours} hour window`);
  }
  return { problems, successful };
}

export function requiredJob(jobs: MonitorJob[], step: string): MonitorJob | undefined {
  return jobs.find(
    (job) =>
      job.status === "completed" &&
      job.conclusion === "success" &&
      job.steps.some(
        (s) => s.name === step && s.status === "completed" && s.conclusion === "success",
      ),
  );
}

export function restoreComparisonPassed(
  log: string,
  startedAt: string,
  completedAt: string,
  expected: { tables: number; sequences: number },
): boolean {
  const start = Date.parse(startedAt);
  const end = Date.parse(completedAt) + 999; // GitHub step metadata has second precision.
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return false;
  return log.split("\n").some((line) => {
    const time = Date.parse(line.split(" ")[0] ?? "");
    const counts =
      /Postgres restore drill passed: ([1-9]\d*) tables, ([1-9]\d*) sequences; rows, columns and migration history match\./.exec(
        line,
      );
    return (
      time >= start &&
      time <= end &&
      !!counts &&
      Number(counts[1]) === expected.tables &&
      Number(counts[2]) === expected.sequences
    );
  });
}

export function validHealthchecksUrl(value: string): boolean {
  return /^https:\/\/hc-ping\.com\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
    value,
  );
}
