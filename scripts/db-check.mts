/**
 * Prints what is actually in the database, so a migration step can be checked
 * against reality rather than against the seed script's own report.
 *
 *   pnpm db:check
 */
import { sql } from "drizzle-orm";
import { connect } from "./connect.mjs";

const db = connect();
const rows = async (text: string) => (await db.execute(sql.raw(text))).rows as any[];

const TABLES = [
  "posts",
  "abouts",
  "timeline_entries",
  "apps",
  "works",
  "experiments",
  "intro_nodes",
  "chips",
  "nav_items",
  "copy_blocks",
  "resume_profiles",
  "resume_experiences",
  "login_attempts",
];

console.log("row counts");
for (const t of TABLES) {
  const [{ n }] = await rows(`select count(*)::int as n from ${t}`);
  console.log(`  ${t.padEnd(20)}${n}`);
}

console.log("\ntimeline (sort order, newest first)");
for (const r of await rows(
  `select version, date, (date_label is not null) as has_label
   from timeline_entries order by sort`
)) {
  console.log(
    `  ${String(r.version).padEnd(5)} ${r.date ?? "—         "}` +
      `${r.has_label ? "  dateLabel" : ""}`
  );
}

console.log("\nposts");
for (const r of await rows(
  `select slug, locale, date, reading_minutes, coalesce(array_length(tags,1),0) as tag_count,
          length(body_html) as html_len
   from posts order by date desc, locale`
)) {
  console.log(
    `  ${r.date}  ${r.locale}  ${String(r.reading_minutes).padStart(2)}min  ` +
      `${r.tag_count} tags  ${String(r.html_len).padStart(6)}B  ${r.slug}`
  );
}

console.log("\napps");
for (const r of await rows(
  `select key, category, accent, hue, sort from apps order by sort`
)) {
  console.log(
    `  ${String(r.key).padEnd(15)} ${String(r.category).padEnd(9)} ` +
      `${r.accent ?? "—"}  hue ${r.hue}`
  );
}

console.log("\nnav_items");
for (const r of await rows(`select href, surfaces from nav_items order by sort`)) {
  console.log(`  ${String(r.href).padEnd(11)} ${r.surfaces.join(", ")}`);
}

console.log("\ncopy_blocks (first line of each namespace)");
for (const r of await rows(
  `select split_part(key, '.', 1) as ns, count(*)::int as n
   from copy_blocks group by 1 order by 1`
)) {
  console.log(`  ${String(r.ns).padEnd(11)} ${r.n}`);
}
