/**
 * Restores the database from `backup/db.json`.
 *
 * The other half of `db:export` — a backup nobody can restore is not a
 * backup. Rows with a natural key are upserted and keyless tables are
 * replaced, so running it twice is safe. Two caveats worth knowing:
 *
 *  - The restore is additive: rows created after the backup was taken keep
 *    existing. Delete strays by hand (or in /admin) if a true reset is meant.
 *  - A deployed site keeps serving its cached pages until something calls
 *    `updateTag` — press save on anything in /admin once after importing.
 *
 *   pnpm db:import
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";
import { renderMarkdown } from "../src/lib/markdown";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Already in the environment.
}

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL must be set");

const db = drizzle(url, { schema });
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const data = JSON.parse(
  await readFile(path.join(ROOT, "backup", "db.json"), "utf8")
) as Record<string, any[]>;

for (const row of data.posts ?? []) {
  // The backup's own bodyHtml is ignored: HTML is always this pipeline's
  // output (same contract as savePost), so a hand-edited backup cannot put
  // markup in the database that the sanitizing renderer never produced.
  const value = { ...row, bodyHtml: await renderMarkdown(row.bodyMd) };
  await db
    .insert(schema.posts)
    .values(value)
    .onConflictDoUpdate({
      target: [schema.posts.slug, schema.posts.locale],
      set: { ...value, updatedAt: new Date() },
    });
}

for (const row of data.abouts ?? []) {
  // Same contract as posts: never the backup's own HTML.
  const value = { ...row, bodyHtml: await renderMarkdown(row.bodyMd) };
  await db
    .insert(schema.abouts)
    .values(value)
    .onConflictDoUpdate({
      target: schema.abouts.locale,
      set: { ...value, updatedAt: new Date() },
    });
}

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
  for (const row of rows ?? []) {
    await db
      .insert(table as any)
      .values(row)
      .onConflictDoUpdate({ target: (table as any).key, set: row });
  }
}

// Keyless tables: replaced wholesale. Delete and insert travel in one
// `db.batch()` — a single atomic request — so a failed insert cannot leave
// the table empty (an empty nav_items is a site with no header).
const keyless = [
  [schema.chips, data.chips],
  [schema.navItems, data.navItems],
  [schema.copyBlocks, data.copyBlocks],
] as const;

for (const [table, rows] of keyless) {
  const del = db.delete(table as any);
  await db.batch(
    rows?.length ? [del, db.insert(table as any).values(rows)] : [del]
  );
}

const counts = Object.entries(data).map(
  ([table, rows]) => `${table} ${rows.length}`
);
console.log(`restored — ${counts.join(", ")}`);
