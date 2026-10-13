/** Decisions shared by the cloud audit and its synthetic failure checks. */
export type MonitorRun = {
  id: number;
  display_title: string;
  head_branch: string;
  event: string;
  status: string;
  conclusion: string | null;
  created_at: string;
};

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
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const problems: string[] = [];
  if (completed.some((r) => !Number.isFinite(Date.parse(r.created_at))))
    problems.push("invalid run timestamp");
  if (completed[0] && completed[0].conclusion !== "success")
    problems.push(`latest completed run is ${completed[0].conclusion ?? "unknown"}`);
  const successful = completed.find((r) => r.conclusion === "success");
  if (!successful) problems.push("no successful run");
  else {
    const age = now - Date.parse(successful.created_at);
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
): boolean {
  const start = Date.parse(startedAt);
  const end = Date.parse(completedAt) + 999; // GitHub step metadata has second precision.
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return false;
  return log.split("\n").some((line) => {
    const time = Date.parse(line.split(" ")[0] ?? "");
    return (
      time >= start &&
      time <= end &&
      /Postgres restore drill passed: [1-9]\d* tables, \d+ sequences; rows, columns and migration history match\./.test(
        line,
      )
    );
  });
}

export function validHealthchecksUrl(value: string): boolean {
  return /^https:\/\/hc-ping\.com\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
    value,
  );
}
