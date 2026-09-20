/**
 * Refuses a snapshot that lost a table.
 *
 * Stands between `db:export` and the commit the nightly backup makes on its
 * own (.github/workflows/backup.yml). The reasoning is in `src/lib/backup.ts`;
 * the short version is that an export which succeeds but comes back empty
 * writes a file full of empty arrays over the last good one, and nobody is
 * watching a job that passes.
 *
 * The comparison is against the copy committed in the checkout — `backup/` as
 * `HEAD` has it, before `db:export` overwrote the working tree. That copy is
 * always some real snapshot, so the check holds whether or not a snapshot
 * branch exists yet.
 *
 *   pnpm db:export && pnpm tsx scripts/db-snapshot-guard.mts
 */
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tablesEmptied, type Snapshot } from "../src/lib/backup";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const committed = execFileSync("git", ["show", "HEAD:backup/db.json"], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});

const before = JSON.parse(committed) as Snapshot;
const after = JSON.parse(await readFile(path.join(ROOT, "backup", "db.json"), "utf8")) as Snapshot;

const emptied = tablesEmptied(before, after);

if (emptied.length) {
  console.error(
    `refusing the snapshot: ${emptied.join(", ")} had rows and came back empty.\n` +
      "Either the database is in trouble or the export read the wrong one. If the\n" +
      "table really was emptied on purpose, run `pnpm db:export` by hand and commit it.",
  );
  process.exit(1);
}

const counts = Object.entries(after).map(([table, rows]) => `${table} ${rows.length}`);
console.log(`snapshot accepted — ${counts.join(", ")}`);
