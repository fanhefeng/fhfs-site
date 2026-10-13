/** Read-only GitHub audit; signal sends only a fixed status to Healthchecks.io. */
import {
  assessRuns,
  latestAttemptFirst,
  NATURAL_CREATE_DEADLINE,
  requiredJob,
  restoreComparisonPassed,
  validHealthchecksUrl,
  type MonitorJob,
  type MonitorRun,
} from "../src/lib/monitor";

import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "../src/db/schema";

class MonitorError extends Error {}
const [command, repository, branch = "main"] = process.argv.slice(2);

async function github(path: string): Promise<Response> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new MonitorError("GITHUB_TOKEN is missing");
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok && response.status !== 302)
    throw new MonitorError(`GitHub verification unavailable (HTTP ${response.status})`);
  return response;
}

async function json<T>(path: string): Promise<T> {
  const response = await github(path);
  if (response.status === 302) throw new MonitorError("Unexpected GitHub metadata redirect");
  return (await response.json()) as T;
}

async function runPages(workflow: string, filters: Record<string, string>): Promise<MonitorRun[]> {
  const result: MonitorRun[] = [];
  const query = new URLSearchParams({
    branch,
    per_page: "100",
    ...filters,
  });
  for (let page = 1; page <= 10; page++) {
    const data = await json<{ workflow_runs: MonitorRun[]; total_count: number }>(
      `actions/workflows/${workflow}/runs?${query}&page=${page}`,
    );
    if (!Array.isArray(data.workflow_runs)) throw new MonitorError("Invalid workflow history");
    if (data.total_count > 1000)
      throw new MonitorError(
        "Workflow history exceeds the bounded API search; narrower queries are required",
      );
    result.push(...data.workflow_runs);
    if (data.workflow_runs.length < 100) return result;
  }
  throw new MonitorError("Workflow history exceeds the bounded audit window");
}

async function runs(workflow: string, now: number): Promise<MonitorRun[]> {
  // Retain quarterly recoveries. Fetch failures without a created cutoff:
  // rerunning an old run changes run_started_at, not created_at.
  const days = workflow === "private-backup.yml" ? 120 : 36;
  const groups = await Promise.all([
    runPages(workflow, { created: `>=${new Date(now - days * 86_400_000).toISOString()}` }),
    ...["failure", "timed_out", "cancelled", "action_required"].map((status) =>
      runPages(workflow, { status }),
    ),
  ]);
  return [...new Map(groups.flat().map((run) => [run.id, run])).values()];
}

async function nativeRestoreLog(job: MonitorJob): Promise<boolean> {
  const step = job.steps.find((s) => s.name === "Restore into the guarded disposable database");
  if (!step?.started_at || !step.completed_at) return false;
  let response = await github(`actions/jobs/${job.id}/logs`);
  if (response.status === 302) {
    const location = response.headers.get("location");
    if (!location || new URL(location).protocol !== "https:")
      throw new MonitorError("Invalid log download redirect");
    // Never forward the GitHub token to the signed download host.
    response = await fetch(location, { signal: AbortSignal.timeout(30_000), redirect: "error" });
  }
  if (!response.ok) throw new MonitorError("Restore evidence download unavailable");
  const log = await response.text();
  if (log.length > 8_000_000) throw new MonitorError("Restore evidence exceeds audit size limit");
  // Current schema inventory, plus the migration journal and its serial.
  // No database connection is opened; adding a table updates this expectation.
  const tables = Object.values(schema)
    .filter((value) => is(value, PgTable))
    .map((value) => value as PgTable);
  const sequences = tables
    .flatMap((table) => getTableConfig(table).columns)
    .filter((column) =>
      ["PgSerial", "PgBigSerial", "PgSmallSerial"].includes(column.columnType),
    ).length;
  return restoreComparisonPassed(log, step.started_at, step.completed_at, {
    tables: tables.length + 1,
    sequences: sequences + 1,
  });
}

async function audit() {
  if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^[\w./-]+$/.test(branch))
    throw new MonitorError("Usage: monitor.mts audit owner/repository default-branch");
  const now = Date.now();
  const problems: string[] = [];
  const flags = JSON.parse(process.env.MONITOR_FLAGS ?? "{}") as Record<string, string>;
  for (const name of ["PRIVATE_BACKUP_ENABLED", "PRIVATE_RESTORE_ENABLED", "E2E_ENABLED"])
    if (flags[name] !== "true") problems.push(`${name} is not true`);
  const files = ["private-backup.yml", "e2e.yml", "backup.yml"];
  for (const file of files) {
    const workflow = await json<{ state: string }>(`actions/workflows/${file}`);
    if (workflow.state !== "active") problems.push(`${file} is not active`);
  }
  const [privateRuns, browserRuns, publicRuns] = await Promise.all(
    files.map((file) => runs(file, now)),
  );
  const specifications = [
    {
      label: "create",
      runs: privateRuns!.filter((r) => r.display_title === "private backup / create"),
      hours: 36,
      step: "Run backup operation and verify freshness",
    },
    {
      label: "health",
      runs: privateRuns!.filter((r) => r.display_title === "private backup / health"),
      hours: 12,
      step: "Run backup operation and verify freshness",
    },
    {
      label: "restore-database",
      runs: privateRuns!.filter((r) => r.display_title === "private backup / restore-database"),
      hours: 35 * 24,
      step: "Restore into the guarded disposable database",
    },
    { label: "browser flows", runs: browserRuns!, hours: 36, step: "Run pnpm e2e" },
    {
      label: "public snapshot",
      runs: publicRuns!,
      hours: 36,
      step: "Commit the snapshot, if it says anything new",
    },
  ];
  if (now >= NATURAL_CREATE_DEADLINE)
    specifications.push({
      label: "natural create",
      runs: privateRuns!.filter(
        (r) => r.display_title === "private backup / create" && r.event === "schedule",
      ),
      hours: 36,
      step: "Run backup operation and verify freshness",
    });
  // Other real backup operations must not be hidden by a successful create.
  for (const operation of ["verify", "verify-database"]) {
    if (
      privateRuns!.some(
        (r) =>
          r.display_title === `private backup / ${operation}` &&
          r.run_attempt > 1 &&
          r.status !== "completed",
      )
    )
      problems.push(`${operation}: rerun is awaiting verification`);
    const history = privateRuns!.filter(
      (r) => r.display_title === `private backup / ${operation}` && r.status === "completed",
    );
    history.sort(latestAttemptFirst);
    if (history[0] && history[0].conclusion !== "success")
      problems.push(`${operation}: latest run did not succeed`);
  }
  const verified = new Set<number>();
  for (const spec of specifications) {
    const assessment = assessRuns(spec.runs, now, spec.hours, branch);
    problems.push(...assessment.problems.map((problem) => `${spec.label}: ${problem}`));
    const run = assessment.successful;
    if (!run || verified.has(run.id)) continue;
    const data = await json<{ jobs: MonitorJob[] }>(`actions/runs/${run.id}/jobs?per_page=100`);
    if (!Array.isArray(data.jobs)) throw new MonitorError("Invalid job evidence");
    const job = requiredJob(data.jobs, spec.step);
    if (!job) problems.push(`${spec.label}: critical step did not execute successfully`);
    else if (spec.label === "restore-database" && !(await nativeRestoreLog(job)))
      problems.push("restore-database: native comparison evidence is missing");
    else console.log(`${spec.label}: actual successful ${run.event} run ${run.id}`);
    verified.add(run.id);
  }
  if (problems.length) throw new MonitorError(problems.join("\n"));
  console.log("Cloud workflow audit passed; encrypted repository freshness is checked separately.");
}

async function signal() {
  const status = repository;
  const url = process.env.HEALTHCHECKS_PING_URL ?? "";
  if (!validHealthchecksUrl(url) || !["success", "failure"].includes(status ?? ""))
    throw new MonitorError("A valid HEALTHCHECKS_PING_URL and success/failure status are required");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url + (status === "failure" ? "/fail" : ""), {
        method: "POST",
        body: `fhfs-site cloud audit: ${status}`,
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) {
        console.log(`Independent monitor received ${status}`);
        return;
      }
    } catch {
      /* URLs and native fetch errors contain the secret; never log them. */
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  throw new MonitorError("Independent monitor could not receive status");
}

try {
  if (command === "audit") await audit();
  else if (command === "signal") await signal();
  else throw new MonitorError("Expected audit or signal");
} catch (error) {
  console.error(
    error instanceof MonitorError
      ? error.message
      : "Cloud monitor could not verify external evidence; private response details withheld.",
  );
  process.exitCode = 1;
}
