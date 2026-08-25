/**
 * Writes the whole database out to `backup/`, so the content keeps a
 * plain-text life outside Postgres.
 *
 * This matters more than a normal backup would. Moving content into a
 * database traded away the two things files gave for free: a diff and a
 * history. Exporting into the repo hands both back — `git log backup/` is a
 * record of what the site has said, and a restore needs nothing but
 * `db:import`.
 *
 * Two shapes, on purpose:
 *   backup/db.json      every table, complete, and what db:import reads
 *   backup/posts/*.md   the prose again as markdown with frontmatter, so a
 *                       diff on an article reads like a diff on an article
 *   backup/about.*.md   the about page's prose, outside posts/ so a post
 *                       slugged "about" can never collide with it
 *
 * db:import reads only db.json — the markdown copies exist for the diff.
 *
 *   pnpm db:export
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/neon-http";
import { asc } from "drizzle-orm";
import { stringify as toYaml } from "yaml";
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
const OUT = path.join(ROOT, "backup");

/**
 * Every ordering below is total, not just sorted.
 *
 * `sort` and `slug` repeat — two rows per slug, one per language — and a
 * partial ordering leaves the tie to the planner, which is free to answer
 * differently each time. That turns an unchanged database into a file that
 * keeps rewriting itself, and a diff that cries wolf is a diff nobody reads.
 */
const data = {
  posts: await db
    .select()
    .from(schema.posts)
    .orderBy(asc(schema.posts.slug), asc(schema.posts.locale)),
  abouts: await db.select().from(schema.abouts).orderBy(asc(schema.abouts.locale)),
  timelineEntries: await db
    .select()
    .from(schema.timelineEntries)
    .orderBy(asc(schema.timelineEntries.sort), asc(schema.timelineEntries.key)),
  apps: await db
    .select()
    .from(schema.apps)
    .orderBy(asc(schema.apps.sort), asc(schema.apps.key)),
  works: await db
    .select()
    .from(schema.works)
    .orderBy(asc(schema.works.sort), asc(schema.works.key)),
  experiments: await db
    .select()
    .from(schema.experiments)
    .orderBy(asc(schema.experiments.sort), asc(schema.experiments.key)),
  introNodes: await db
    .select()
    .from(schema.introNodes)
    .orderBy(asc(schema.introNodes.sort), asc(schema.introNodes.key)),
  resumeProfiles: await db
    .select()
    .from(schema.resumeProfiles)
    .orderBy(asc(schema.resumeProfiles.key)),
  resumeExperiences: await db
    .select()
    .from(schema.resumeExperiences)
    .orderBy(asc(schema.resumeExperiences.sort), asc(schema.resumeExperiences.key)),
  chips: await db
    .select()
    .from(schema.chips)
    .orderBy(asc(schema.chips.sort), asc(schema.chips.id)),
  navItems: await db
    .select()
    .from(schema.navItems)
    .orderBy(asc(schema.navItems.sort), asc(schema.navItems.href)),
  copyBlocks: await db
    .select()
    .from(schema.copyBlocks)
    .orderBy(asc(schema.copyBlocks.key)),
};

// Serial ids and timestamps are restatements of the data, not part of it —
// leaving them out keeps the diff to what someone actually changed.
const strip = <T extends Record<string, unknown>>(rows: T[]) =>
  rows.map(({ id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest }) => rest);

await rm(OUT, { recursive: true, force: true });
await mkdir(path.join(OUT, "posts"), { recursive: true });

await writeFile(
  path.join(OUT, "db.json"),
  JSON.stringify(
    Object.fromEntries(
      Object.entries(data).map(([table, rows]) => [table, strip(rows as any)])
    ),
    null,
    2
  ) + "\n"
);

/** The article again, as the file it used to be. */
for (const post of data.posts) {
  const frontmatter = toYaml({
    title: post.title,
    date: post.date,
    tags: post.tags,
    summary: post.summary,
    ...(post.draft ? { draft: true } : {}),
  });
  await writeFile(
    path.join(OUT, "posts", `${post.slug}.${post.locale}.md`),
    `---\n${frontmatter}---\n\n${post.bodyMd}`
  );
}

for (const about of data.abouts) {
  const frontmatter = toYaml({ title: about.title });
  await writeFile(
    path.join(OUT, `about.${about.locale}.md`),
    `---\n${frontmatter}---\n\n${about.bodyMd}`
  );
}

const counts = Object.entries(data).map(
  ([table, rows]) => `${table} ${(rows as unknown[]).length}`
);
console.log(`backup/ written — ${counts.join(", ")}`);
