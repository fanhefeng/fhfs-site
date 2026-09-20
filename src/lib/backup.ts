/**
 * The one question a new snapshot has to answer before it is allowed to
 * replace the last one.
 *
 * A backup that runs by itself introduces a failure the manual one never had:
 * nobody reads its output. A database that answers but answers empty — a
 * migration half-applied, a role that lost its grants, a connection string
 * pointing at the wrong branch — exports cleanly, and the snapshot that lands
 * on top of yesterday's is a file full of empty arrays. The site is still
 * fine; the backup is gone, and the day it is needed is the day anyone finds
 * out.
 *
 * So: a table that had rows and now has none is not a snapshot, it is an
 * alarm. Emptying a table on purpose is rare and always deliberate — the
 * commit that does it carries a hand-run `pnpm db:export` with it (copy_blocks
 * was emptied exactly that way), and the automation is meant to stop and say
 * so rather than quietly record the loss.
 *
 * Shrinkage is deliberately not checked. Deleting most of a table is ordinary
 * editing, and a threshold that fires on it teaches everyone to ignore the
 * alarm — which costs more than the case it catches.
 */
export type Snapshot = Record<string, unknown[]>;

/**
 * The tables `before` had rows in and `after` does not — missing from the new
 * snapshot counts as empty, since a table that stopped being exported is the
 * same loss as a table that came back empty.
 */
export function tablesEmptied(before: Snapshot, after: Snapshot): string[] {
  return Object.entries(before)
    .filter(([table, rows]) => Array.isArray(rows) && rows.length > 0 && !after[table]?.length)
    .map(([table]) => table);
}
