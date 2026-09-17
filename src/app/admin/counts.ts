import "server-only";
import { cache } from "react";
import { sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { SECTIONS, type SectionCounts } from "./sections";

/**
 * How many rows each section holds, for the sidebar and the dashboard.
 *
 * One statement, not fourteen: the sidebar is on every admin page, and over
 * Neon's HTTP driver each `select count(*)` is its own round trip. They fold
 * into a single row of scalar subqueries instead — `select (select count(*)
 * from posts) as "/admin/posts", …` — which is one request whatever the
 * dashboard and the sidebar both ask for.
 *
 * Wrapped in `React.cache`, so the two of them share the one read per render.
 * Never `unstable_cache`: this is the admin, and the whole point of the number
 * is that it says what is in the table right now.
 *
 * The table comes from the schema object, not from a name spliced into
 * `sql.raw` — a renamed table is a type error in this file rather than a 500
 * on the dashboard. This module is server-only for the same reason `sections`
 * has no imports: `@/db/schema` must never cross into the sidebar's bundle.
 */
const TABLES: Record<string, PgTable> = {
  "/admin/posts": schema.posts,
  "/admin/apps": schema.apps,
  "/admin/experiments": schema.experiments,
  "/admin/moments": schema.moments,
  "/admin/secrets": schema.secrets,
  "/admin/timeline": schema.timelineEntries,
  "/admin/about": schema.abouts,
  "/admin/intro": schema.introNodes,
  "/admin/resume": schema.resumeExperiences,
  "/admin/chips": schema.chips,
  "/admin/copy": schema.copyBlocks,
  "/admin/nav": schema.navItems,
  "/admin/works": schema.works,
};

export type { SectionCounts };

export const sectionCounts = cache(async (): Promise<SectionCounts> => {
  const columns = SECTIONS.map(
    (section) =>
      sql`(select count(*)::int from ${TABLES[section.href]}) as ${sql.identifier(section.href)}`
  );
  const result = await db.execute<Record<string, number>>(
    sql`select ${sql.join(columns, sql`, `)}`
  );
  const row = result.rows[0] ?? {};

  const counts: SectionCounts = {};
  for (const section of SECTIONS) {
    counts[section.href] = Number(row[section.href] ?? 0);
  }
  return counts;
});
