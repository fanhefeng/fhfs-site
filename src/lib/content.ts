import { unstable_cache } from "next/cache";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  abouts,
  apps,
  chips,
  copyBlocks,
  experiments,
  introNodes,
  navItems,
  posts,
  resumeExperiences,
  resumeProfiles,
  timelineEntries,
  works,
  type Localized,
  type LocalizedLines,
  type ResumeProject,
  type SkillGroup,
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
 * **Nothing request-variable is captured from module scope.** `unstable_cache`
 * keys on a function's arguments but not on the variables it closes over, so
 * anything that differs between calls — locale, slug, tag, surface — must
 * arrive as a parameter, and does. What the getters do close over (`db`, the
 * column sets, the sort helpers) is constant for every entry by design.
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
  copy: "copy",
  chips: "chips",
  experiments: "experiments",
  intro: "intro",
  nav: "nav",
  resume: "resume",
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
  accent: string | null;
};

export type App = {
  key: string;
  name: string;
  tagline: Localized;
  description: Localized;
  category: "desktop" | "tool" | "game" | "website";
  website: string;
  /** GitHub "owner/name", when the app has a public repo. */
  repo: string | null;
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

/**
 * What "this locale's index" means, in one place.
 *
 * Four queries below select different columns out of the same idea: one
 * published row per slug, preferring the asked-for locale. `DISTINCT ON (slug)`
 * keeps the first row per slug and `localeFirst` decides which that is, so a
 * post written only in Chinese still appears on the English index — flagged,
 * so the article page can say so.
 *
 * Drizzle's builder cannot be wrapped in a generic helper without its column
 * types collapsing, so what is shared here is the *rule* rather than the query
 * skeleton: change the fallback or what counts as published, and there is
 * still only one place to change it.
 */
const publishedOnly = eq(posts.draft, false);

const indexOrder = (locale: Locale) =>
  [posts.slug, sql`(${posts.locale} = ${locale}) desc`, asc(posts.id)] as const;

/** For a single post, where `DISTINCT ON` is one `LIMIT 1` instead. */
const localeFirst = (locale: Locale) => sql`(${posts.locale} = ${locale}) desc`;

/** Newest first. ISO dates sort correctly as strings. */
const byDateDesc = <T extends { date: string }>(rows: T[]) =>
  rows.sort((a, b) => b.date.localeCompare(a.date));

export const getPosts = unstable_cache(
  async (locale: Locale): Promise<PostSummary[]> => {
    const rows = await db
      .selectDistinctOn([posts.slug], summaryColumns)
      .from(posts)
      .where(publishedOnly)
      .orderBy(...indexOrder(locale));

    return byDateDesc(
      rows.map((row) => ({ ...row, isFallback: row.locale !== locale }))
    );
  },
  ["posts-by-locale"],
  cacheOptions(TAGS.posts)
);

export const getPost = unstable_cache(
  async (slug: string, locale: Locale): Promise<Post | null> => {
    const [row] = await db
      .select({ ...summaryColumns, html: posts.bodyHtml })
      .from(posts)
      .where(and(eq(posts.slug, slug), publishedOnly))
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
      .where(publishedOnly)
      .orderBy(posts.slug);
    return rows.map((row) => row.slug);
  },
  ["all-slugs"],
  cacheOptions(TAGS.posts)
);

/**
 * The languages a slug was actually written in, with each edition's date.
 *
 * The sitemap, the article's hreflang and the OG card all need to know which
 * locales really have a version — `getPost` never misses for a slug that
 * exists in *some* language, so "exists" has to be read off the table. They
 * used to ask `getPost` once per locale and throw the body away; this is the
 * same question without the 28 KB answer.
 */
export const getPostEditions = unstable_cache(
  async (slug: string): Promise<{ locale: Locale; date: string }[]> =>
    db
      .select({ locale: posts.locale, date: posts.date })
      .from(posts)
      .where(and(eq(posts.slug, slug), publishedOnly))
      .orderBy(asc(posts.locale)),
  ["post-editions"],
  cacheOptions(TAGS.posts)
);

/**
 * The previous and next article by publication date.
 *
 * Deliberately its own query rather than an index lookup into `getPosts()`:
 * it still walks every published row to find the neighbours, but fetches only
 * slug/title/date — not the summaries, tags and reading times the full index
 * carries.
 */
export const getAdjacentPosts = unstable_cache(
  async (
    slug: string,
    locale: Locale
  ): Promise<{
    older: { slug: string; title: string } | null;
    newer: { slug: string; title: string } | null;
  }> => {
    const ordered = byDateDesc(
      await db
        .selectDistinctOn([posts.slug], {
          slug: posts.slug,
          title: posts.title,
          date: posts.date,
        })
        .from(posts)
        .where(publishedOnly)
        .orderBy(...indexOrder(locale))
    );
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
      .where(publishedOnly)
      .orderBy(...indexOrder(locale));

    // Counted newest-first so that tags sharing a count come out in the order
    // a reader meets them down the index, rather than in slug order.
    const counts = new Map<string, number>();
    for (const row of byDateDesc(rows)) {
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
      .where(publishedOnly)
      .orderBy(...indexOrder(locale));

    return byDateDesc(
      rows
        .filter((row) => row.tags.includes(tag))
        .map((row) => ({ ...row, isFallback: row.locale !== locale }))
    );
  },
  ["posts-by-tag"],
  cacheOptions(TAGS.posts)
);

// ---------------------------------------------------------------------------
// Everything else
// ---------------------------------------------------------------------------

const aboutColumns = {
  locale: abouts.locale,
  title: abouts.title,
  html: abouts.bodyHtml,
};

export const getAbout = unstable_cache(
  async (locale: Locale): Promise<About | null> => {
    // Same fallback the posts get: this language first, else the other one
    // rather than nothing. One query — two rows at most.
    const [row] = await db
      .select(aboutColumns)
      .from(abouts)
      .orderBy(sql`(${abouts.locale} = ${locale}) desc`, asc(abouts.locale))
      .limit(1);
    return row ?? null;
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
      // `sort` collides (several rows default to 0), so every list here orders
      // by sort *and* a unique column — equal sorts otherwise reorder between
      // deploys. Same pattern in each getter below.
      .orderBy(asc(timelineEntries.sort), asc(timelineEntries.key)),
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
        repo: apps.repo,
        platforms: apps.platforms,
        accent: apps.accent,
        hue: apps.hue,
      })
      .from(apps)
      .orderBy(asc(apps.sort), asc(apps.key)),
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
        accent: works.accent,
      })
      .from(works)
      .orderBy(asc(works.sort), asc(works.key)),
  ["works"],
  cacheOptions(TAGS.works)
);

// ---------------------------------------------------------------------------
// What used to be hard-coded in components
// ---------------------------------------------------------------------------

export type Chip = { label: Localized; tone: "paper" | "ink" | "accent" };

export const getChips = unstable_cache(
  async (): Promise<Chip[]> =>
    db
      .select({ label: chips.label, tone: chips.tone })
      .from(chips)
      .orderBy(asc(chips.sort), asc(chips.id)),
  ["chips"],
  cacheOptions(TAGS.chips)
);

export type Experiment = {
  key: string;
  name: Localized;
  description: Localized;
  status: "live" | "wip" | "planned";
  accent: string | null;
  href: string | null;
  demo: string | null;
};

export const getExperiments = unstable_cache(
  async (): Promise<Experiment[]> =>
    db
      .select({
        key: experiments.key,
        name: experiments.name,
        description: experiments.description,
        status: experiments.status,
        accent: experiments.accent,
        href: experiments.href,
        demo: experiments.demo,
      })
      .from(experiments)
      .orderBy(asc(experiments.sort), asc(experiments.key)),
  ["experiments"],
  cacheOptions(TAGS.experiments)
);

export type IntroNode = {
  key: string;
  kicker: Localized;
  title: Localized;
  period: Localized | null;
  body: Localized;
  bullets: { zh: string[]; en: string[] };
};

// `stickerLabel`/`stickerIcon` are deliberately not selected: the 3D scene
// still reads label and icon from `INTRO_STICKERS` — see the note on the
// table in db/schema.ts.
export const getIntroNodes = unstable_cache(
  async (): Promise<IntroNode[]> =>
    db
      .select({
        key: introNodes.key,
        kicker: introNodes.kicker,
        title: introNodes.title,
        period: introNodes.period,
        body: introNodes.body,
        bullets: introNodes.bullets,
      })
      .from(introNodes)
      .orderBy(asc(introNodes.sort), asc(introNodes.key)),
  ["intro-nodes"],
  cacheOptions(TAGS.intro)
);

export type ResumeProfile = {
  name: Localized;
  tagline: Localized;
  intro: LocalizedLines;
  highlights: LocalizedLines;
  skills: { zh: SkillGroup[]; en: SkillGroup[] };
  projects: LocalizedLines;
  education: LocalizedLines;
  email: string | null;
  github: string | null;
  website: string | null;
  location: Localized | null;
  note: Localized | null;
  /** When the profile was last saved, as an ISO string — the cache stores
   *  JSON, so a Date would come back as one anyway. The page prints it. */
  updatedAt: string;
};

export type ResumeExperience = {
  key: string;
  company: Localized;
  role: Localized;
  period: Localized;
  url: string | null;
  summary: Localized | null;
  bullets: LocalizedLines;
  projects: { zh: ResumeProject[]; en: ResumeProject[] };
};

/** Everything on /resume apart from the jobs. Null until the profile is
 *  first saved in /admin — the page renders its quiet empty state rather
 *  than inventing a person. */
export const getResumeProfile = unstable_cache(
  async (): Promise<ResumeProfile | null> => {
    const [row] = await db
      .select({
        name: resumeProfiles.name,
        tagline: resumeProfiles.tagline,
        intro: resumeProfiles.intro,
        highlights: resumeProfiles.highlights,
        skills: resumeProfiles.skills,
        projects: resumeProfiles.projects,
        education: resumeProfiles.education,
        email: resumeProfiles.email,
        github: resumeProfiles.github,
        website: resumeProfiles.website,
        location: resumeProfiles.location,
        note: resumeProfiles.note,
        updatedAt: resumeProfiles.updatedAt,
      })
      .from(resumeProfiles)
      .where(eq(resumeProfiles.key, "main"))
      .limit(1);
    return row ? { ...row, updatedAt: row.updatedAt.toISOString() } : null;
  },
  ["resume-profile"],
  cacheOptions(TAGS.resume)
);

export const getResumeExperiences = unstable_cache(
  async (): Promise<ResumeExperience[]> =>
    db
      .select({
        key: resumeExperiences.key,
        company: resumeExperiences.company,
        role: resumeExperiences.role,
        period: resumeExperiences.period,
        url: resumeExperiences.url,
        summary: resumeExperiences.summary,
        bullets: resumeExperiences.bullets,
        projects: resumeExperiences.projects,
      })
      .from(resumeExperiences)
      .orderBy(asc(resumeExperiences.sort), asc(resumeExperiences.key)),
  ["resume-experiences"],
  cacheOptions(TAGS.resume)
);

/**
 * Site copy that has been lifted out of the message catalogues, as a nested
 * object shaped like them (`home.heroLine1` becomes `{ home: { heroLine1 } }`).
 *
 * This is an *override layer*: the JSON files remain the defaults and this is
 * merged on top in `i18n/request.ts`. An empty table therefore reads exactly
 * like the site did before any of this existed.
 */
const loadCopyOverrides = unstable_cache(
  async (locale: Locale): Promise<Record<string, unknown>> => {
    const rows = await db
      .select({ key: copyBlocks.key, zh: copyBlocks.zh, en: copyBlocks.en })
      .from(copyBlocks);

    // Null-prototype nodes plus a segment blacklist. The keys come out of a
    // table, and a `__proto__` segment would otherwise walk this loop straight
    // onto Object.prototype — and `merge()` in i18n/request.ts assigns these
    // keys onto plain objects, where `__proto__` is a setter.
    const out: Record<string, unknown> = Object.create(null);
    const unsafe = new Set(["__proto__", "constructor", "prototype"]);
    for (const row of rows) {
      const path = row.key.split(".");
      if (path.some((segment) => !segment || unsafe.has(segment))) {
        console.error(`copy override skipped, unsafe key: ${row.key}`);
        continue;
      }
      let node = out;
      for (const segment of path.slice(0, -1)) {
        if (typeof node[segment] !== "object" || node[segment] === null) {
          node[segment] = Object.create(null);
        }
        node = node[segment] as Record<string, unknown>;
      }
      node[path.at(-1)!] = row[locale];
    }
    return out;
  },
  ["copy-overrides"],
  cacheOptions(TAGS.copy)
);

/**
 * The one query on every page's render path, so it fails soft.
 *
 * The catch sits *outside* the cache on purpose: an error must not be stored.
 * Neon's free tier sleeps, and a cold-start timeout cached under
 * `revalidate: false` would pin an empty override layer in place for a year.
 * Failing here instead means the page falls back to the JSON catalogue for
 * this request and tries again on the next one — the site reads slightly out
 * of date rather than not at all.
 */
export async function getCopyOverrides(
  locale: Locale
): Promise<Record<string, unknown>> {
  try {
    return await loadCopyOverrides(locale);
  } catch (error) {
    console.error("copy overrides unavailable, using message catalogue", error);
    return {};
  }
}

export type NavItem = { href: string; labelKey: string; surfaces: string[] };

/**
 * Where a link is allowed to appear. A union rather than a string, because a
 * typo would otherwise return an empty list and silently remove a whole nav.
 */
export type NavSurface = "header" | "footer" | "fullnav" | "sitemap";

/** The whole nav table, in display order — one cache entry rather than one
 *  per surface, since the layout asks for three surfaces on every render. */
export const getAllNavItems = unstable_cache(
  async (): Promise<NavItem[]> =>
    db
      .select({
        href: navItems.href,
        labelKey: navItems.labelKey,
        surfaces: navItems.surfaces,
      })
      .from(navItems)
      .orderBy(asc(navItems.sort), asc(navItems.id)),
  ["nav-items"],
  cacheOptions(TAGS.nav)
);

/** One list, filtered per surface — Header, Footer, FullNav and the sitemap.
 *  Not cached itself: it only filters the cached list above. */
export async function getNavItems(surface: NavSurface): Promise<NavItem[]> {
  const rows = await getAllNavItems();
  return rows.filter((row) => row.surfaces.includes(surface));
}
