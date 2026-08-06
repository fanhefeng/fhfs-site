import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/**
 * The content database. Two ways of saying "bilingual" live here on purpose:
 *
 *  - Long prose (posts, about) is stored one row per locale, keyed by
 *    `(slug, locale)`. A slug may exist in only one language — the read layer
 *    falls back to the other and flags it, which is the behaviour the site has
 *    always had.
 *  - Short fields (titles, taglines, blurbs) are a single `{ zh, en }` jsonb
 *    column, matching the shape the YAML files already used.
 *
 * Anything that is a *visual* parameter — sticker angles, hues, animation
 * timings — deliberately stays in code. Only content lives here.
 */

export const localeEnum = pgEnum("locale", ["zh", "en"]);
export const appCategoryEnum = pgEnum("app_category", [
  "desktop",
  "tool",
  "game",
  "website",
]);
export const experimentStatusEnum = pgEnum("experiment_status", [
  "live",
  "wip",
  "planned",
]);
export const chipToneEnum = pgEnum("chip_tone", ["paper", "ink", "accent"]);

/** Every bilingual short field is this shape — the old `localeSchema`. */
export type Localized = { zh: string; en: string };

const localized = (name?: string) =>
  name ? jsonb(name).$type<Localized>() : jsonb().$type<Localized>();

// ---------------------------------------------------------------------------
// Long prose
// ---------------------------------------------------------------------------

/**
 * `bodyMd` is what the author typed; `bodyHtml` is what the page renders.
 * Both are kept: the editor needs the source, `readingMinutes()` counts the
 * source, and a change of rendering pipeline has to be able to regenerate the
 * HTML from something.
 */
export const posts = pgTable(
  "posts",
  {
    id: serial().primaryKey(),
    slug: text().notNull(),
    locale: localeEnum().notNull(),
    title: text().notNull(),
    // Stored as a calendar day. The read layer widens it back to the ISO
    // string the sort comparator and <time> elements expect.
    date: date({ mode: "string" }).notNull(),
    summary: text().notNull(),
    // Tags are per-locale strings, not translations of each other: the Chinese
    // post carries 手札, the English one carries notes. A tag entity table
    // would change the /blog/tags/[tag] URLs, so they stay an array.
    tags: text().array().notNull().default(sql`'{}'`),
    draft: boolean().notNull().default(false),
    cover: text(),
    bodyMd: text("body_md").notNull(),
    bodyHtml: text("body_html").notNull(),
    readingMinutes: integer("reading_minutes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("posts_slug_locale").on(t.slug, t.locale)]
);

export const abouts = pgTable("abouts", {
  locale: localeEnum().primaryKey(),
  title: text().notNull(),
  bodyMd: text("body_md").notNull(),
  bodyHtml: text("body_html").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Structured content
// ---------------------------------------------------------------------------

/**
 * A life numbered like software releases. `sort` ascends newest-first (5.1 is
 * 1, 1.0 is 10) — the same convention the YAML files used.
 *
 * The CHECK enforces what the old YAML could only ask for in a comment: an
 * entry states a real date, or it labels the gap. It never invents one.
 */
export const timelineEntries = pgTable(
  "timeline_entries",
  {
    id: serial().primaryKey(),
    key: text().notNull().unique(),
    version: text().notNull(),
    date: date({ mode: "string" }),
    dateLabel: localized("date_label"),
    title: localized().notNull(),
    note: localized().notNull(),
    sort: integer().notNull(),
  },
  (t) => [
    check(
      "timeline_has_date_or_label",
      sql`${t.date} IS NOT NULL OR ${t.dateLabel} IS NOT NULL`
    ),
  ]
);

/**
 * `accent` folds in what used to be `APP_ACCENT` on the portfolio page, and
 * `hue` folds in the `HUES` index-modulo on the software page — two separate
 * palettes that gave the same app two different colours. One column now.
 */
export const apps = pgTable("apps", {
  id: serial().primaryKey(),
  key: text().notNull().unique(),
  name: text().notNull(),
  tagline: localized().notNull(),
  description: localized().notNull(),
  category: appCategoryEnum().notNull(),
  icon: text(),
  website: text().notNull(),
  platforms: text().array().notNull().default(sql`'{}'`),
  accent: text(),
  hue: integer(),
  sort: integer().notNull().default(0),
});

export const works = pgTable("works", {
  id: serial().primaryKey(),
  key: text().notNull().unique(),
  title: localized().notNull(),
  description: localized().notNull(),
  year: integer().notNull(),
  cover: text(),
  url: text(),
  tags: text().array().notNull().default(sql`'{}'`),
  // Stored for the same reason apps carry one: a colour derived from list
  // position repaints the whole wall the moment anything is reordered.
  accent: text(),
  sort: integer().notNull().default(0),
});

/**
 * The craft log. Merges `CRAFT_ENTRIES` (structure) with
 * `portfolio.experiments.<id>` (copy) — adding one used to mean editing a
 * constant plus two message files, with nothing to catch a missed edit.
 */
export const experiments = pgTable("experiments", {
  id: serial().primaryKey(),
  key: text().notNull().unique(),
  name: localized().notNull(),
  description: localized().notNull(),
  status: experimentStatusEnum().notNull(),
  accent: text(),
  href: text(),
  // Names an in-page demo component when the experiment ships one.
  demo: text(),
  sort: integer().notNull().default(0),
});

/**
 * The /intro résumé. Merges `intro.nodes.<id>` (copy) with the *content* half
 * of `INTRO_STICKERS` (label, icon). The spatial half — direction, size,
 * rotation, distance — stays in `src/lib/intro/stickers.ts`, because those
 * numbers were hand-calibrated against one head model and mean nothing to an
 * editor. `key` is the join.
 */
export const introNodes = pgTable("intro_nodes", {
  id: serial().primaryKey(),
  key: text().notNull().unique(),
  kicker: localized().notNull(),
  title: localized().notNull(),
  period: localized(),
  body: localized().notNull(),
  bullets: jsonb().$type<{ zh: string[]; en: string[] }>().notNull(),
  // Latin on purpose: CJK turns to mush at sticker texture resolution.
  stickerLabel: text("sticker_label").notNull(),
  stickerIcon: text("sticker_icon").notNull(),
  sort: integer().notNull().default(0),
});

/**
 * The sticker wall. `label` is bilingual but the two sides are often identical
 * — proper nouns like TypeScript read the same in both languages.
 */
export const chips = pgTable("chips", {
  id: serial().primaryKey(),
  label: localized().notNull(),
  tone: chipToneEnum().notNull().default("paper"),
  sort: integer().notNull().default(0),
});

/**
 * One nav table replacing four drifted copies (Header, Footer, FullNav and
 * sitemap each kept their own list — /intro only ever reached the sitemap,
 * home only ever reached FullNav). `surfaces` says where a link shows up.
 */
export const navItems = pgTable("nav_items", {
  id: serial().primaryKey(),
  href: text().notNull(),
  // Still points at a `nav.<key>` label in the message catalogue.
  labelKey: text("label_key").notNull(),
  surfaces: text().array().notNull().default(sql`'{}'`),
  sort: integer().notNull().default(0),
});

/**
 * Loose site copy lifted out of messages/*.json — hero lines, the manifesto,
 * the self-introduction. The JSON files stay as the default values; rows here
 * are an override layer merged in `src/i18n/request.ts`, so an empty table
 * means the site reads exactly as it does today.
 */
export const copyBlocks = pgTable("copy_blocks", {
  key: text().primaryKey(),
  zh: text().notNull(),
  en: text().notNull(),
  // A reminder to self about what this string is load-bearing for.
  note: text(),
});

/*
 * There is deliberately no `site_settings` table.
 *
 * It existed briefly and read to nobody: `src/config/site.ts` stayed the real
 * source while a copy of it sat here, which is the exact duplication this
 * whole migration was meant to end — and the worse kind, because the stale
 * copy looked authoritative enough to edit.
 *
 * The split that settles it: content goes in the database, deployment config
 * stays in code. `site.url` decides canonical URLs, hreflang, OG image
 * addresses and the sitemap's domain; it belongs to the environment a build
 * runs in, not to a row someone can retype. The rest — title, description,
 * the signature, the GitHub link — changes about once a year, and buying it an
 * editor would have meant threading async through forty-odd call sites, five
 * client components and every `generateMetadata` on the site.
 */

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/** Login throttling. An in-memory counter would not survive serverless. */
export const loginAttempts = pgTable("login_attempts", {
  id: serial().primaryKey(),
  ip: text().notNull(),
  at: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
