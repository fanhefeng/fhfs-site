/** Validate a complete export against transactional admin-edit evidence.
 * Intentional clearing is valid; unexplained loss or missing evidence blocks
 * the commit. The last snapshot also detects a formerly exported table omitted
 * by a newer exporter. No acknowledgement flags or production writes here.
 */
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { snapshotProblems, type BackupState } from "../src/lib/backupAudit";
import { type Snapshot } from "../src/lib/backup";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const against = process.argv[2];
const committed = against
  ? await readFile(against, "utf8")
  : execFileSync("git", ["show", "HEAD:backup/db.json"], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });

const before = JSON.parse(committed) as Snapshot;
console.log(`comparing against ${against ?? "HEAD:backup/db.json"}`);
const after = JSON.parse(await readFile(path.join(ROOT, "backup", "db.json"), "utf8")) as Snapshot;

const evidence = JSON.parse(
  await readFile(path.join(ROOT, "backup", "evidence.json"), "utf8"),
) as BackupState[];
const problems = snapshotProblems(after, evidence);
for (const name of Object.keys(before)) {
  if (!(name in after)) problems.push(`${name}: previous snapshot table is missing`);
}

if (problems.length) {
  console.error(
    `Public snapshot refused: ${problems.join("; ")}.\n` +
      "Authenticated admin edits and their expected row counts must agree. " +
      "Inspect the source database and edit evidence; do not bypass this guard.",
  );
  process.exit(1);
}

const counts = Object.entries(after).map(([table, rows]) => `${table} ${rows.length}`);
console.log(`snapshot accepted — ${counts.join(", ")}`);
