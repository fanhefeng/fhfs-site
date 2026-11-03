import "server-only";
import { unstable_cache } from "next/cache";
import { and, asc, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  abouts,
  appCategoryEnum,
  apps,
  chipToneEnum,
  chips,
  copyBlocks,
  films,
  idols,
  introNodes,
  moments,
  navItems,
  posts,
  resumeExperiences,
  resumeProfiles,
  secretKindEnum,
  secrets,
  timelineEntries,
  type Localized,
  type LocalizedLines,
  type ResumeProject,
  type SkillGroup,
} from "@/db/schema";
import type { Locale } from "@/i18n/routing";
import type { MomentMedia } from "@/lib/moments";
import type { NoteDetails, NoteFormat } from "@/lib/notebook";
import { getImportedArticle, getImportedSummaries, mergeImported } from "./notebook";
import { isNavGroup, type NavGroup } from "@/lib/nav";

/**
 * Every read the site does, in one file.
 *
 * Two things are deliberate here:
 *
 * **All of it is cached with tags.** Pages stay statically generated; the tags
 * a getter declares get collected into that page's ISR entry, so one
 * `updateTag("content")` from the admin invalidates the pages, the sitemap,
 * the feed and the OG images together. Tags only belong to this deployment;
 * a 30-second revalidation window also picks up edits made by fhfs against
 * the shared database, without a call between the two applications.
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
  intro: "intro",
  nav: "nav",
  resume: "resume",
  moments: "moments",
  secrets: "secrets",
  films: "films",
  idols: "idols",
} as const;

const cacheOptions = (...tags: string[]) => ({
  tags: [TAGS.content, ...tags],
  revalidate: 30,
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
  /** A calendar day, or null when the imported original has no recorded date. */
  date: string | null;
  format?: NoteFormat;
  summary: string;
  tags: string[];
  readingMinutes: number;
  /** True when this locale has no version of its own and another stood in. */
  isFallback: boolean;
};

export type Post = PostSummary & { html: string; note?: NoteDetails };

export type About = { locale: Locale; title: string; html: string };

export type TimelineEntry = {
  key: string;
  version: string;
  date: string | null;
  dateLabel: Localized | null;
  title: Localized;
  note: Localized;
};

export type App = {
  key: string;
  name: string;
  tagline: Localized;
  description: Localized;
  category: (typeof appCategoryEnum.enumValues)[number];
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
 * Public indexes prefer a published row, then the requested locale.
 * A draft-only slug remains an ownership marker until publicRows removes it,
 * preventing a static import from resurfacing. `DISTINCT ON (slug)` keeps
 * one row per address; a published translation can still provide a fallback.
 *
 * Drizzle's builder cannot be wrapped in a generic helper without its column
 * types collapsing, so what is shared here is the *rule* rather than the query
 * skeleton: change the fallback or what counts as published, and there is
 * still only one place to change it.
 */
const indexOrder = (locale: Locale) =>
  [posts.slug, asc(posts.draft), sql`(${posts.locale} = ${locale}) desc`, asc(posts.id)] as const;

/** For a single post, where `DISTINCT ON` is one `LIMIT 1` instead. */
const localeFirst = (locale: Locale) => sql`(${posts.locale} = ${locale}) desc`;

/** Newest first. ISO dates sort correctly as strings. */
const byDateDesc = <T extends { date: string | null }>(rows: T[]) =>
  rows.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

/** Keep draft ownership internal; never return draft fields to public callers. */
function publicRows<T extends { draft: boolean }>(rows: T[]): Omit<T, "draft">[] {
  return rows.filter((row) => !row.draft).map(({ draft: _draft, ...row }) => row);
}

export const getPosts = unstable_cache(
  async (locale: Locale): Promise<PostSummary[]> => {
    const rows = await db
      .selectDistinctOn([posts.slug], { ...summaryColumns, draft: posts.draft })
      .from(posts)
      .orderBy(...indexOrder(locale));

    return byDateDesc(
      mergeImported<PostSummary>(
        publicRows(rows).map((row) => ({ ...row, isFallback: row.locale !== locale })),
        getImportedSummaries("/blog", locale),
        rows,
      ),
    );
  },
  ["posts-by-locale"],
  cacheOptions(TAGS.posts),
);

/** One article, in this locale if it has it. `drafts` is for Draft Mode
 *  (`app/admin/preview`), where it is the only way a draft is ever read; the
 *  mode bypasses this cache, so a draft never lands in it. */
export const getPost = unstable_cache(
  async (slug: string, locale: Locale, drafts = false): Promise<Post | null> => {
    const [row] = await db
      .select({ ...summaryColumns, html: posts.bodyHtml, draft: posts.draft })
      .from(posts)
      .where(eq(posts.slug, slug))
      .orderBy(...(drafts ? [] : [asc(posts.draft)]), localeFirst(locale), asc(posts.id))
      .limit(1);

    if (!row) return getImportedArticle("/blog", slug, locale);
    if (row.draft && !drafts) return null;
    const { draft: _draft, ...post } = row;
    return { ...post, isFallback: post.locale !== locale };
  },
  ["post"],
  cacheOptions(TAGS.posts),
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
  async (slug: string): Promise<{ locale: Locale; date: string | null }[]> => {
    const rows = await db
      .select({ locale: posts.locale, date: posts.date, draft: posts.draft })
      .from(posts)
      .where(eq(posts.slug, slug))
      .orderBy(asc(posts.locale));
    return rows.length
      ? publicRows(rows)
      : getImportedSummaries("/blog", "zh")
          .filter((note) => note.slug === slug)
          .map(({ locale, date }) => ({ locale, date }));
  },
  ["post-editions"],
  cacheOptions(TAGS.posts),
);

/** Neighbours use the same dated-then-undated order as the public index. */
// Derived views share the index cache, without extending its 30-second lifetime.
export async function getAdjacentPosts(slug: string, locale: Locale) {
  return neighbours(await getPosts(locale), slug);
}

function neighbours<T extends { slug: string; title: string; locale: Locale }>(
  ordered: T[],
  slug: string,
) {
  const index = ordered.findIndex((row) => row.slug === slug);
  const pick = (row?: T) => (row ? { slug: row.slug, title: row.title, locale: row.locale } : null);
  return index < 0
    ? { older: null, newer: null }
    : { older: pick(ordered[index + 1]), newer: pick(ordered[index - 1]) };
}

/**
 * Tags with their counts, most used first.
 *
 * Tags are per-locale strings rather than translations of each other — the
 * Chinese post carries 手札, the English one carries notes — so this counts
 * within one locale's view of the index.
 */
export async function getAllTags(locale: Locale): Promise<{ tag: string; count: number }[]> {
  const rows = await getPosts(locale);
  // Count in the order a reader meets the tags down the index.
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const tag of row.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

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
export async function getPostsByTag(tag: string, locale: Locale): Promise<PostSummary[]> {
  return (await getPosts(locale)).filter((row) => row.tags.includes(tag));
}

// ---------------------------------------------------------------------------
// Secrets — 《不能说的秘密》, the essays and episodes
// ---------------------------------------------------------------------------

export type SecretKind = (typeof secretKindEnum.enumValues)[number];

export type SecretSummary = {
  slug: string;
  locale: Locale;
  kind: SecretKind;
  title: string;
  /** A calendar day, or null when the imported original has no recorded date. */
  date: string | null;
  format?: NoteFormat;
  summary: string;
  /** Imported originals retain their topic keywords for search. */
  tags?: string[];
  audio: string | null;
  /** Minutes, for an episode; null when unknown or not an episode. */
  duration: number | null;
  readingMinutes: number;
  isFallback: boolean;
};

export type Secret = SecretSummary & { html: string; note?: NoteDetails };

const secretColumns = {
  slug: secrets.slug,
  locale: secrets.locale,
  kind: secrets.kind,
  title: secrets.title,
  date: secrets.date,
  summary: secrets.summary,
  audio: secrets.audio,
  duration: secrets.duration,
  readingMinutes: secrets.readingMinutes,
};

/* As with posts: published editions first, locale second; drafts still own
   their slug so an unpublished replacement cannot expose the static original. */
const secretIndexOrder = (locale: Locale) =>
  [
    secrets.slug,
    asc(secrets.draft),
    sql`(${secrets.locale} = ${locale}) desc`,
    asc(secrets.id),
  ] as const;
const secretLocaleFirst = (locale: Locale) => sql`(${secrets.locale} = ${locale}) desc`;

const importedSecrets = (locale: Locale): SecretSummary[] =>
  getImportedSummaries("/secrets", locale).map((note) => ({
    ...note,
    kind: "essay",
    audio: null,
    duration: null,
  }));

export const getSecrets = unstable_cache(
  async (locale: Locale): Promise<SecretSummary[]> => {
    const rows = await db
      .selectDistinctOn([secrets.slug], { ...secretColumns, draft: secrets.draft })
      .from(secrets)
      .orderBy(...secretIndexOrder(locale));
    return byDateDesc(
      mergeImported<SecretSummary>(
        publicRows(rows).map((row) => ({ ...row, isFallback: row.locale !== locale })),
        importedSecrets(locale),
        rows,
      ),
    );
  },
  ["secrets-by-locale"],
  cacheOptions(TAGS.secrets),
);

/** One secret — `drafts` as for `getPost`. */
export const getSecret = unstable_cache(
  async (slug: string, locale: Locale, drafts = false): Promise<Secret | null> => {
    const [row] = await db
      .select({ ...secretColumns, html: secrets.bodyHtml, draft: secrets.draft })
      .from(secrets)
      .where(eq(secrets.slug, slug))
      .orderBy(...(drafts ? [] : [asc(secrets.draft)]), secretLocaleFirst(locale), asc(secrets.id))
      .limit(1);
    if (!row) {
      const note = await getImportedArticle("/secrets", slug, locale);
      return note ? { ...note, kind: "essay", audio: null, duration: null } : null;
    }
    if (row.draft && !drafts) return null;
    const { draft: _draft, ...secret } = row;
    return { ...secret, isFallback: secret.locale !== locale };
  },
  ["secret"],
  cacheOptions(TAGS.secrets),
);

/** Which languages a secret was really written in — see `getPostEditions`. */
export const getSecretEditions = unstable_cache(
  async (slug: string): Promise<{ locale: Locale; date: string | null }[]> => {
    const rows = await db
      .select({ locale: secrets.locale, date: secrets.date, draft: secrets.draft })
      .from(secrets)
      .where(eq(secrets.slug, slug))
      .orderBy(asc(secrets.locale));
    return rows.length
      ? publicRows(rows)
      : getImportedSummaries("/secrets", "zh")
          .filter((note) => note.slug === slug)
          .map(({ locale, date }) => ({ locale, date }));
  },
  ["secret-editions"],
  cacheOptions(TAGS.secrets),
);

export type PublishedEdition = { slug: string; locale: Locale; date: string | null };

/** All actual editions for the sitemap, in one HTTP batch regardless of slug count. */
export const getSitemapEditions = unstable_cache(
  async (): Promise<{ posts: PublishedEdition[]; secrets: PublishedEdition[] }> => {
    const [postEditions, secretEditions] = await db.batch([
      db
        .select({ slug: posts.slug, locale: posts.locale, date: posts.date, draft: posts.draft })
        .from(posts)
        .orderBy(asc(posts.slug), asc(posts.locale)),
      db
        .select({
          slug: secrets.slug,
          locale: secrets.locale,
          date: secrets.date,
          draft: secrets.draft,
        })
        .from(secrets)
        .orderBy(asc(secrets.slug), asc(secrets.locale)),
    ]);
    const editions = (destination: "/blog" | "/secrets") =>
      getImportedSummaries(destination, "zh").map(({ slug, locale, date }) => ({
        slug,
        locale,
        date,
      }));
    return {
      posts: mergeImported<PublishedEdition>(
        publicRows(postEditions),
        editions("/blog"),
        postEditions,
      ),
      secrets: mergeImported<PublishedEdition>(
        publicRows(secretEditions),
        editions("/secrets"),
        secretEditions,
      ),
    };
  },
  ["sitemap-editions"],
  cacheOptions(TAGS.posts, TAGS.secrets),
);

export async function getAdjacentSecrets(slug: string, locale: Locale) {
  return neighbours(await getSecrets(locale), slug);
}

// ---------------------------------------------------------------------------
// Moments — 《多的是你不知道的事》, the board
// ---------------------------------------------------------------------------

export type Moment = {
  key: string;
  content: string;
  /** An ISO instant — the cache stores JSON, so a Date would come back as one anyway. */
  postedAt: string;
  collection: string | null;
  original: boolean;
  attribution: string | null;
  source: string | null;
  mood: string | null;
  /** Site paths and media-site addresses as stored — the page resolves the hashed ones. */
  media: MomentMedia[];
  pinned: boolean;
};

/** The whole board, pinned lines first and then newest first. One entry: the
 *  page filters and pages through it on the client, and the home page's card
 *  picks the newest line out of it by the clock, pinned or not. */
export const getMoments = unstable_cache(
  async (): Promise<Moment[]> => {
    const rows = await db
      .select({
        key: moments.key,
        content: moments.content,
        postedAt: moments.postedAt,
        collection: moments.collection,
        original: moments.original,
        attribution: moments.attribution,
        source: moments.source,
        mood: moments.mood,
        media: moments.media,
        pinned: moments.pinned,
      })
      .from(moments)
      .where(eq(moments.draft, false))
      // Two lines posted in the same second still need a fixed order — the
      // key breaks the tie, same reason as every list below.
      .orderBy(desc(moments.pinned), desc(moments.postedAt), asc(moments.key));
    return rows.map((row) => ({ ...row, postedAt: row.postedAt.toISOString() }));
  },
  ["moments"],
  cacheOptions(TAGS.moments),
);

// ---------------------------------------------------------------------------
// The films and the idols — a room each, a page per row
// ---------------------------------------------------------------------------

// Every column but the row's bookkeeping: the pages read all of it, and the
// lists (the index, /life, the sitemap, search) are three films and one idol.
const { id: _filmId, draft: _filmDraft, sort: _filmSort, ...filmColumns } = getTableColumns(films);
const { id: _idolId, draft: _idolDraft, sort: _idolSort, ...idolColumns } = getTableColumns(idols);

export type Film = { [K in keyof typeof filmColumns]: (typeof films.$inferSelect)[K] };
export type Idol = { [K in keyof typeof idolColumns]: (typeof idols.$inferSelect)[K] };

/** The films on the wall, in the room's order. */
export const getFilms = unstable_cache(
  async (): Promise<Film[]> =>
    db
      .select(filmColumns)
      .from(films)
      .where(eq(films.draft, false))
      .orderBy(asc(films.sort), asc(films.key)),
  ["films"],
  cacheOptions(TAGS.films),
);

/** One film — `drafts` as for `getPost`. */
export const getFilm = unstable_cache(
  async (key: string, drafts = false): Promise<Film | null> => {
    const [row] = await db
      .select(filmColumns)
      .from(films)
      .where(and(eq(films.key, key), drafts ? undefined : eq(films.draft, false)))
      .limit(1);
    return row ?? null;
  },
  ["film"],
  cacheOptions(TAGS.films),
);

/** The idols on the wall, in its order. */
export const getIdols = unstable_cache(
  async (): Promise<Idol[]> =>
    db
      .select(idolColumns)
      .from(idols)
      .where(eq(idols.draft, false))
      .orderBy(asc(idols.sort), asc(idols.key)),
  ["idols"],
  cacheOptions(TAGS.idols),
);

/** One idol — `drafts` as for `getPost`. */
export const getIdol = unstable_cache(
  async (key: string, drafts = false): Promise<Idol | null> => {
    const [row] = await db
      .select(idolColumns)
      .from(idols)
      .where(and(eq(idols.key, key), drafts ? undefined : eq(idols.draft, false)))
      .limit(1);
    return row ?? null;
  },
  ["idol"],
  cacheOptions(TAGS.idols),
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
  cacheOptions(TAGS.about),
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
  cacheOptions(TAGS.timeline),
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
  cacheOptions(TAGS.apps),
);

// The `works` table has no getter: /portfolio went offline (it 308s to
// /software) and nothing out front reads the shelf. /admin/works still edits
// it; the day a page hangs a first work, its getter goes here with the
// `works` tag `saveWork` already invalidates.

// ---------------------------------------------------------------------------
// What used to be hard-coded in components
// ---------------------------------------------------------------------------

export type Chip = { label: Localized; tone: (typeof chipToneEnum.enumValues)[number] };

export const getChips = unstable_cache(
  async (): Promise<Chip[]> =>
    db
      .select({ label: chips.label, tone: chips.tone })
      .from(chips)
      .orderBy(asc(chips.sort), asc(chips.id)),
  ["chips"],
  cacheOptions(TAGS.chips),
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
  cacheOptions(TAGS.intro),
);

export type ResumeProfile = {
  name: Localized;
  tagline: Localized;
  sections: { zh: ResumeProject[]; en: ResumeProject[] };
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
        sections: resumeProfiles.sections,
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
  cacheOptions(TAGS.resume),
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
  cacheOptions(TAGS.resume),
);

/**
 * Site copy that has been lifted out of the message catalogues, as a nested
 * object shaped like them (`home.heroLine1` becomes `{ home: { heroLine1 } }`).
 *
 * This is an *override layer*: the JSON files remain the defaults and this is
 * merged on top in `i18n/request.ts`. An empty table therefore reads exactly
 * like the site did before any of this existed — and so does a row whose
 * column for this language is null, which is how a line edited in one language
 * leaves the other one following the file.
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
      const value = row[locale];
      if (value === null) continue;
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
      node[path.at(-1)!] = value;
    }
    return out;
  },
  ["copy-overrides"],
  cacheOptions(TAGS.copy),
);

/**
 * The one query on every page's render path, so it fails soft.
 *
 * The catch sits *outside* the cache on purpose: an error must not be stored.
 * Neon's free tier sleeps, and caching a cold-start timeout would replace
 * working overrides with the catalogue's defaults for the cache window.
 * Failing here instead means the render falls back to the JSON catalogue and
 * the next read of this function tries the table again — the site reads
 * slightly out of date rather than not at all.
 *
 * What "the next read" is depends on the page. A request-time render (draft
 * preview, an error page) asks again on the next request. A prerendered page
 * does not: if this one query fails while a save is regenerating it, the page
 * can temporarily use the catalogue's lines until its next revalidation.
 * Keep the error visible so repeated database failures can be investigated.
 */
export async function getCopyOverrides(locale: Locale): Promise<Record<string, unknown>> {
  try {
    return await loadCopyOverrides(locale);
  } catch (error) {
    console.error("copy overrides unavailable, using message catalogue", error);
    return {};
  }
}

export type NavItem = {
  href: string;
  labelKey: string;
  surfaces: string[];
  /** The wing the row belongs to (`src/lib/nav.ts`); a value the code does
   *  not know is read as none, so a stray string in the column cannot break
   *  a surface. */
  group: NavGroup | null;
};

/**
 * Where a link is allowed to appear. A union rather than a string, because a
 * typo would otherwise return an empty list and silently remove a whole nav.
 */
export type NavSurface = "header" | "footer" | "fullnav" | "sitemap";

/** The whole nav table, in display order — one cache entry rather than one
 *  per surface, since the layout asks for three surfaces on every render. */
export const getAllNavItems = unstable_cache(
  async (): Promise<NavItem[]> => {
    const rows = await db
      .select({
        href: navItems.href,
        labelKey: navItems.labelKey,
        surfaces: navItems.surfaces,
        group: navItems.group,
      })
      .from(navItems)
      .orderBy(asc(navItems.sort), asc(navItems.id));
    return rows.map((row) => ({ ...row, group: isNavGroup(row.group) ? row.group : null }));
  },
  ["nav-items"],
  cacheOptions(TAGS.nav),
);

/** One list, filtered per surface — Header, Footer, FullNav and the sitemap.
 *  Not cached itself: it only filters the cached list above. */
export async function getNavItems(surface: NavSurface): Promise<NavItem[]> {
  const rows = await getAllNavItems();
  return rows.filter((row) => row.surfaces.includes(surface));
}

/** Build-time routes use the same public index and database ownership rules. */
export async function getAllSlugs(): Promise<string[]> {
  return (await getPosts("zh")).map((row) => row.slug);
}

export async function getAllSecretSlugs(): Promise<string[]> {
  return (await getSecrets("zh")).map((row) => row.slug);
}
