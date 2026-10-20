/** Explicit one-time operational setup. Never invoked by a workflow/admin.
 * Only expected counts are inserted; existing content/evidence is unchanged.
 * Usage: pnpm exec tsx scripts/backup-state-init.mts reviewed/db.json
 */
import { readFile } from "node:fs/promises";
import { BACKUP_TABLES, backupAuditQueries, bootstrapAuditQuery } from "../src/lib/backupAudit";
import * as schema from "../src/db/schema";
import { connect } from "./connect.mjs";

const file = process.argv[2];
if (!file) throw new Error("A reviewed public snapshot path is required; no writes were run");
const baseline = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
const db = connect(undefined, { isolationLevel: "ReadCommitted" });
const revision = `bootstrap:${crypto.randomUUID()}`;
const entries = Object.keys(BACKUP_TABLES) as (keyof typeof BACKUP_TABLES)[];
const locks = entries.map((key) => db.execute(backupAuditQueries(schema[key], revision).lock));
const seeds = entries.map((key) => {
  const rows = baseline[key];
  if (!Array.isArray(rows)) throw new Error(`${key}: reviewed snapshot is missing a table`);
  return db.execute(bootstrapAuditQuery(schema[key], rows.length, revision));
});
const [first, ...rest] = [...locks, ...seeds];
if (!first) throw new Error("No content tables; no writes were run");
await db.batch([first, ...rest]);
console.log(
  "Expected backup counts initialized against the reviewed public snapshot. No content was changed.",
);
