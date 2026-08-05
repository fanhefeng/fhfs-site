/**
 * Restores the database from `backup/db.json`.
 *
 * The other half of `db:export` — a backup nobody can restore is not a
 * backup. Rows with a natural key are upserted and keyless tables are
 * replaced, so this is safe to run against a live database and safe to run
 * twice.
 *
 *   pnpm db:import
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";

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
  await db
    .insert(schema.posts)
    .values(row)
    .onConflictDoUpdate({
      target: [schema.posts.slug, schema.posts.locale],
      set: { ...row, updatedAt: new Date() },
    });
}

for (const row of data.abouts ?? []) {
  await db
    .insert(schema.abouts)
    .values(row)
    .onConflictDoUpdate({
      target: schema.abouts.locale,
      set: { ...row, updatedAt: new Date() },
    });
}

const keyed = [
  [schema.timelineEntries, data.timelineEntries],
  [schema.apps, data.apps],
  [schema.works, data.works],
  [schema.experiments, data.experiments],
  [schema.introNodes, data.introNodes],
] as const;

for (const [table, rows] of keyed) {
  for (const row of rows ?? []) {
    await db
      .insert(table as any)
      .values(row)
      .onConflictDoUpdate({ target: (table as any).key, set: row });
  }
}

// Keyless tables: replaced wholesale.
await db.delete(schema.chips);
if (data.chips?.length) await db.insert(schema.chips).values(data.chips);

await db.delete(schema.navItems);
if (data.navItems?.length) await db.insert(schema.navItems).values(data.navItems);

await db.delete(schema.copyBlocks);
if (data.copyBlocks?.length)
  await db.insert(schema.copyBlocks).values(data.copyBlocks);

for (const row of data.siteSettings ?? []) {
  await db
    .insert(schema.siteSettings)
    .values(row)
    .onConflictDoUpdate({ target: schema.siteSettings.id, set: row });
}

const counts = Object.entries(data).map(
  ([table, rows]) => `${table} ${rows.length}`
);
console.log(`restored — ${counts.join(", ")}`);
