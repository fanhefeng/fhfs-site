import { unstable_cache } from "next/cache";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  abouts,
  apps,
  posts,
  timelineEntries,
  works,
  type Localized,
} from "@/db/schema";
import type { Locale } from "@/i18n/routing";

/**
 * Every read the site does, in one file.
 *
 * Two things are deliberate here:
 *
 * **All of it is cached with tags.** Pages stay statically generated; the tags
 * a getter declares get collected into that page's ISR entry, so one
 * `updateTag("content")` from the admin invalidates the pages, the sitemap,
 * the feed and the OG images together. `revalidate: false` means an entry
 * lives until a tag kills it — no polling, no background recompute.
 *
 * **Nothing is captured from module scope.** `unstable_cache` keys on a
 * function's arguments but not on the variables it closes over, so a module
 * level constant would quietly be shared across every cache entry. Everything
 * a getter needs, it takes as a parameter.
 *
 * If this ever moves to Cache Components, it moves here and only here: each
 * `unstable_cache(fn, keys, opts)` becomes `'use cache'` + `cacheTag()`, and
 * no caller changes.
 */

/** Cache tags. `content` is on everything — the admin's blunt instrument. */
export const TAGS = {
  content: "content",
  posts: "posts",
  about: "about",
  apps: "apps",
  works: "works",
  timeline: "timeline",
} as const;

const cacheOptions = (...tags: string[]) => ({
  tags: [TAGS.content, ...tags],
  revalidate: false as const,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A post as the lists need it — no body. The article body is by far the
 * largest column (one post's rendered HTML runs to 28 KB), and the index
 * pages, the feed, the sitemap and the OG cards never touch it.
 */
export type PostSummary = {
  slug: string;
  locale: Locale;
  title: string;
  /** A calendar day, `YYYY-MM-DD`: sorts as a string, parses as a Date. */
  date: string;
  summary: string;
  tags: string[];
  readingMinutes: number;
  /** True when this locale has no version of its own and another stood in. */
  isFallback: boolean;
};

export type Post = PostSummary & { html: string };

export type About = { locale: Locale; title: string; html: string };

export type TimelineEntry = {
  key: string;
  version: string;
  date: string | null;
  dateLabel: Localized | null;
  title: Localized;
  note: Localized;
};

export type Work = {
  key: string;
  title: Localized;
  description: Localized;
  year: number;
  cover: string | null;
  url: string | null;
  tags: string[];
};

export type App = {
  key: string;
  name: string;
  tagline: Localized;
  description: Localized;
  category: "desktop" | "tool" | "game" | "website";
  website: string;
  platforms: string[];
  accent: string | null;
  hue: number | null;
};

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

const summaryColumns = {
  slug: posts.slug,
  locale: posts.locale,
  title: posts.title,
  date: posts.date,
  summary: posts.summary,
  tags: posts.tags,
  readingMinutes: posts.readingMinutes,
};

/** Prefers the asked-for locale, falls back to whatever exists. */
const localeFirst = (locale: Locale) =>
  sql`(${posts.locale} = ${locale}) desc`;

/**
 * One row per slug, newest first, in the requested locale where there is one.
 *
 * The fallback is a sort, not a second query: `DISTINCT ON (slug)` keeps the
 * first row per slug, and the ordering puts the requested locale first. A post
 * that exists only in Chinese therefore still appears on the English index,
 * flagged so the article page can say so.
 */
export const getPosts = unstable_cache(
  async (locale: Locale): Promise<PostSummary[]> => {
    const rows = await db
      .selectDistinctOn([posts.slug], summaryColumns)
      .from(posts)
      .where(eq(posts.draft, false))
      .orderBy(posts.slug, localeFirst(locale), asc(posts.id));

    return rows
      .map((row) => ({ ...row, isFallback: row.locale !== locale }))
      .sort((a, b) => b.date.localeCompare(a.date));
  },
  ["posts-by-locale"],
  cacheOptions(TAGS.posts)
);

export const getPost = unstable_cache(
  async (slug: string, locale: Locale): Promise<Post | null> => {
    const [row] = await db
      .select({ ...summaryColumns, html: posts.bodyHtml })
      .from(posts)
      .where(and(eq(posts.slug, slug), eq(posts.draft, false)))
      .orderBy(localeFirst(locale), asc(posts.id))
      .limit(1);

    if (!row) return null;
    return { ...row, isFallback: row.locale !== locale };
  },
  ["post"],
  cacheOptions(TAGS.posts)
);

export const getAllSlugs = unstable_cache(
  async (): Promise<string[]> => {
    const rows = await db
      .selectDistinct({ slug: posts.slug })
      .from(posts)
      .where(eq(posts.draft, false))
      .orderBy(posts.slug);
    return rows.map((row) => row.slug);
  },
  ["all-slugs"],
  cacheOptions(TAGS.posts)
);

/**
 * The previous and next article by publication date.
 *
 * Deliberately its own query rather than an index lookup into `getPosts()`:
 * the article page only needs two titles, and this keeps it from pulling the
 * whole index in to find them.
 */
export const getAdjacentPosts = unstable_cache(
  async (
    slug: string,
    locale: Locale
  ): Promise<{
    older: { slug: string; title: string } | null;
    newer: { slug: string; title: string } | null;
  }> => {
    const rows = await db
      .selectDistinctOn([posts.slug], {
        slug: posts.slug,
        title: posts.title,
        date: posts.date,
      })
      .from(posts)
      .where(eq(posts.draft, false))
      .orderBy(posts.slug, localeFirst(locale), asc(posts.id));

    const ordered = rows.sort((a, b) => b.date.localeCompare(a.date));
    const index = ordered.findIndex((row) => row.slug === slug);
    if (index === -1) return { older: null, newer: null };

    const pick = (row?: (typeof ordered)[number]) =>
      row ? { slug: row.slug, title: row.title } : null;
    return { older: pick(ordered[index + 1]), newer: pick(ordered[index - 1]) };
  },
  ["adjacent-posts"],
  cacheOptions(TAGS.posts)
);

/**
 * Tags with their counts, most used first.
 *
 * Tags are per-locale strings rather than translations of each other — the
 * Chinese post carries 手札, the English one carries notes — so this counts
 * within one locale's view of the index.
 */
export const getAllTags = unstable_cache(
  async (locale: Locale): Promise<{ tag: string; count: number }[]> => {
    const rows = await db
      .selectDistinctOn([posts.slug], { tags: posts.tags, date: posts.date })
      .from(posts)
      .where(eq(posts.draft, false))
      .orderBy(posts.slug, localeFirst(locale), asc(posts.id));

    // Counted newest-first so that tags sharing a count come out in the order
    // a reader meets them down the index, rather than in slug order.
    const counts = new Map<string, number>();
    for (const row of rows.sort((a, b) => b.date.localeCompare(a.date))) {
      for (const tag of row.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  },
  ["all-tags"],
  cacheOptions(TAGS.posts)
);

/**
 * Posts carrying a tag, as seen from one locale.
 *
 * The filter runs over this locale's view of the index rather than over the
 * table, and the difference is deliberate: tags are per-locale strings, so the
 * English `notes` is not a translation of 手札 but a different label
 * altogether. Matching the raw column would surface a Chinese article under
 * `/zh/blog/tags/notes` on the strength of its English edition's tags. A tag
 * that this locale never uses finds nothing, and the page 404s.
 */
export const getPostsByTag = unstable_cache(
  async (tag: string, locale: Locale): Promise<PostSummary[]> => {
    const rows = await db
      .selectDistinctOn([posts.slug], summaryColumns)
      .from(posts)
      .where(eq(posts.draft, false))
      .orderBy(posts.slug, localeFirst(locale), asc(posts.id));

    return rows
      .filter((row) => row.tags.includes(tag))
      .map((row) => ({ ...row, isFallback: row.locale !== locale }))
      .sort((a, b) => b.date.localeCompare(a.date));
  },
  ["posts-by-tag"],
  cacheOptions(TAGS.posts)
);

// ---------------------------------------------------------------------------
// Everything else
// ---------------------------------------------------------------------------

export const getAbout = unstable_cache(
  async (locale: Locale): Promise<About | null> => {
    const [row] = await db
      .select({
        locale: abouts.locale,
        title: abouts.title,
        html: abouts.bodyHtml,
      })
      .from(abouts)
      .where(eq(abouts.locale, locale))
      .limit(1);
    if (row) return row;

    // Same fallback the posts get: show the other language rather than nothing.
    const [any] = await db
      .select({
        locale: abouts.locale,
        title: abouts.title,
        html: abouts.bodyHtml,
      })
      .from(abouts)
      .limit(1);
    return any ?? null;
  },
  ["about"],
  cacheOptions(TAGS.about)
);

export const getTimeline = unstable_cache(
  async (): Promise<TimelineEntry[]> =>
    db
      .select({
        key: timelineEntries.key,
        version: timelineEntries.version,
        date: timelineEntries.date,
        dateLabel: timelineEntries.dateLabel,
        title: timelineEntries.title,
        note: timelineEntries.note,
      })
      .from(timelineEntries)
      .orderBy(asc(timelineEntries.sort)),
  ["timeline"],
  cacheOptions(TAGS.timeline)
);

export const getApps = unstable_cache(
  async (): Promise<App[]> =>
    db
      .select({
        key: apps.key,
        name: apps.name,
        tagline: apps.tagline,
        description: apps.description,
        category: apps.category,
        website: apps.website,
        platforms: apps.platforms,
        accent: apps.accent,
        hue: apps.hue,
      })
      .from(apps)
      .orderBy(asc(apps.sort)),
  ["apps"],
  cacheOptions(TAGS.apps)
);

export const getWorks = unstable_cache(
  async (): Promise<Work[]> =>
    db
      .select({
        key: works.key,
        title: works.title,
        description: works.description,
        year: works.year,
        cover: works.cover,
        url: works.url,
        tags: works.tags,
      })
      .from(works)
      .orderBy(asc(works.sort)),
  ["works"],
  cacheOptions(TAGS.works)
);
