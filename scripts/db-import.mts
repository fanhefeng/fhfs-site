/**
 * Restores the database from `backup/db.json`.
 *
 * The other half of `db:export` — a backup nobody can restore is not a
 * backup. Rows with a natural key are upserted; the two positional lists and
 * the copy table are replaced. Running it twice is safe. Two caveats worth
 * knowing:
 *
 *  - The restore is additive for the keyed tables: rows created after the
 *    backup was taken keep existing. Delete strays by hand (or in /admin) if
 *    a true reset is meant. chips, nav_items and copy_blocks come out exactly
 *    as the backup has them.
 *  - A deployed site keeps serving its cached pages until something calls
 *    `updateTag` — press save on anything in /admin once after importing.
 *
 * Each table travels as one `db.batch()`: a single HTTP request, run as one
 * transaction, so a table is restored whole or not at all, and a restore is
 * a dozen round trips rather than a hundred. What the network still drops
 * between requests, `connect()` retries.
 *
 *   pnpm db:import
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BatchItem } from "drizzle-orm/batch";
import * as schema from "../src/db/schema";
import { renderMarkdown } from "../src/lib/markdown";
import { readingMinutes } from "../src/lib/reading";
import { connect } from "./connect.mjs";

const db = connect();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const data = JSON.parse(
  await readFile(path.join(ROOT, "backup", "db.json"), "utf8")
) as Record<string, any[]>;

/** One request for the whole table; an empty table sends nothing. */
async function batch(label: string, statements: BatchItem<"pg">[]) {
  const [first, ...rest] = statements;
  if (first) await db.batch([first, ...rest]);
  console.log(`  ${label.padEnd(20)}${statements.length}`);
}

// Both derived columns are re-derived: HTML is always this pipeline's output
// (same contract as savePost), so a hand-edited backup cannot put markup in
// the database the sanitising renderer never produced; and the reading time
// follows whatever `readingMinutes` says today, not what it said when the
// backup was written.
const posts = await Promise.all(
  (data.posts ?? []).map(async (row) => ({
    ...row,
    bodyHtml: await renderMarkdown(row.bodyMd),
    readingMinutes: readingMinutes(row.bodyMd),
  }))
);
await batch(
  "posts",
  posts.map((value) =>
    db
      .insert(schema.posts)
      .values(value)
      .onConflictDoUpdate({
        target: [schema.posts.slug, schema.posts.locale],
        set: { ...value, updatedAt: new Date() },
      })
  )
);

const abouts = await Promise.all(
  (data.abouts ?? []).map(async (row) => ({
    ...row,
    bodyHtml: await renderMarkdown(row.bodyMd),
  }))
);
await batch(
  "abouts",
  abouts.map((value) =>
    db
      .insert(schema.abouts)
      .values(value)
      .onConflictDoUpdate({
        target: schema.abouts.locale,
        set: { ...value, updatedAt: new Date() },
      })
  )
);

// Every table with a natural key that /admin can also delete from.
const keyed = [
  [schema.timelineEntries, data.timelineEntries],
  [schema.apps, data.apps],
  [schema.works, data.works],
  [schema.experiments, data.experiments],
  [schema.introNodes, data.introNodes],
  [schema.resumeProfiles, data.resumeProfiles],
  [schema.resumeExperiences, data.resumeExperiences],
] as const;

for (const [table, rows] of keyed) {
  await batch(
    (table as any)[Symbol.for("drizzle:Name")],
    (rows ?? []).map((row) => {
      // The backup strips timestamps, so a table that keeps one is stamped
      // now — same as posts and abouts above. /resume prints its own.
      const set = "updatedAt" in table ? { ...row, updatedAt: new Date() } : row;
      return db
        .insert(table as any)
        .values(row)
        .onConflictDoUpdate({ target: (table as any).key, set });
    })
  );
}

// Replaced wholesale rather than upserted. The two positional lists have no
// key to upsert on; copy_blocks has one, but it is a closed set — every key
// names a line in messages/*.json — and /admin can edit those rows but not
// delete them, so a key retired from the catalogue would otherwise sit in the
// table for good, the one thing "additive" must not mean here. Delete and
// insert share the one batch, so a failed insert cannot leave the table empty
// — an empty nav_items is a site with no header.
const replaced = [
  [schema.chips, data.chips],
  [schema.navItems, data.navItems],
  [schema.copyBlocks, data.copyBlocks],
] as const;

for (const [table, rows] of replaced) {
  const statements: BatchItem<"pg">[] = [db.delete(table as any)];
  if (rows?.length) statements.push(db.insert(table as any).values(rows));
  await batch((table as any)[Symbol.for("drizzle:Name")], statements);
}

console.log("restored");
