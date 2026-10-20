import { getTableName, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

/** Public snapshot names and their physical tables. Operational tables are excluded. */
export const BACKUP_TABLES = {
  posts: "posts",
  abouts: "abouts",
  secrets: "secrets",
  moments: "moments",
  timelineEntries: "timeline_entries",
  apps: "apps",
  works: "works",
  films: "films",
  idols: "idols",
  introNodes: "intro_nodes",
  resumeProfiles: "resume_profiles",
  resumeExperiences: "resume_experiences",
  chips: "chips",
  navItems: "nav_items",
  copyBlocks: "copy_blocks",
} as const;

export type BackupState = { tableName: string; publicRows: number };

function counts(table: PgTable) {
  const name = getTableName(table);
  if (!(Object.values(BACKUP_TABLES) as string[]).includes(name))
    throw new Error(`Not a backed-up content table: ${name}`);
  const total = sql`(SELECT count(*)::integer FROM ${table})`;
  const visible =
    "draft" in table
      ? sql`${(table as PgTable & { draft: AnyPgColumn }).draft} = false`
      : sql`true`;
  const published = sql`(SELECT count(*)::integer FROM ${table} WHERE ${visible})`;
  return { name, total, published };
}

/** One-time provisioning against a reviewed public snapshot, while holding all
 * content locks. Existing evidence is preserved. Never call this from an admin
 * action or a scheduled backup: a failed check must require investigation.
 */
export function bootstrapAuditQuery(table: PgTable, expectedPublicRows: number, revision: string) {
  if (!Number.isSafeInteger(expectedPublicRows) || expectedPublicRows < 0)
    throw new Error("Invalid reviewed snapshot count");
  const { name, total, published } = counts(table);
  return sql`INSERT INTO admin_content_state (table_name, total_rows, public_rows, revision)
    SELECT ${name}, ${total}, ${published}, ${revision}
    WHERE (CASE WHEN ${published} = ${expectedPublicRows}
      THEN '1' ELSE ${`BACKUP_BASELINE_MISMATCH:${name}`} END)::integer = 1
    ON CONFLICT (table_name) DO NOTHING`;
}

/** Run lock, check, mutation(s), then record in ONE transaction, in that order.
 * The table lock also serializes older deployments and direct SQL writes.
 * Checking the old count prevents a later no-op edit from blessing prior loss.
 */
export function backupAuditQueries(table: PgTable, revision: string) {
  const { name, total, published } = counts(table);
  return {
    lock: sql`LOCK TABLE ${table} IN SHARE ROW EXCLUSIVE MODE`,
    check: sql`SELECT (CASE WHEN EXISTS (
      SELECT 1 FROM admin_content_state
      WHERE table_name = ${name} AND total_rows = ${total} AND public_rows = ${published}
    ) THEN '1' ELSE ${`BACKUP_STATE_MISMATCH:${name}`} END)::integer AS backup_guard`,
    record: sql`INSERT INTO admin_content_state (table_name, total_rows, public_rows, revision, updated_at)
      VALUES (${name}, ${total}, ${published}, ${revision}, now())
      ON CONFLICT (table_name) DO UPDATE SET
        total_rows = excluded.total_rows, public_rows = excluded.public_rows,
        revision = excluded.revision, updated_at = excluded.updated_at`,
  };
}

/** Evidence and export must come from the same read-only Repeatable Read transaction.
 * A valid zero recorded by an authenticated edit is accepted. Missing evidence,
 * unknown/missing exports, malformed counts and unexplained shrinkage fail closed.
 */
export function snapshotProblems(
  snapshot: Record<string, unknown>,
  evidence: BackupState[],
): string[] {
  const problems: string[] = [];
  const states = new Map(evidence.map((row) => [row.tableName, row.publicRows]));
  if (states.size !== evidence.length) problems.push("duplicate edit evidence");
  for (const [key, name] of Object.entries(BACKUP_TABLES)) {
    const rows = snapshot[key];
    const expected = states.get(name);
    if (!Array.isArray(rows)) problems.push(`${key}: missing or invalid export`);
    else if (!Number.isSafeInteger(expected) || expected! < 0)
      problems.push(`${key}: missing or invalid admin edit evidence`);
    else if (rows.length !== expected)
      problems.push(`${key}: exported ${rows.length} rows; authenticated edits expect ${expected}`);
  }
  if (!Array.isArray(snapshot.mediaUploads))
    problems.push("mediaUploads: missing or invalid export");
  return problems;
}
