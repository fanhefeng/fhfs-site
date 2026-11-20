import type { Locale } from "@/i18n/routing";
import { isNavGroup } from "@/lib/nav";
import type { Post, PostSummary, Secret, SecretSummary } from "./content";
import type { PublicSnapshot } from "./snapshotSource";

type Row = { slug: string; locale: Locale; date: string | null };

function editions<T extends Row>(rows: T[], locale: Locale): T[] {
  const bySlug = new Map<string, T>();
  for (const row of rows) {
    if (!bySlug.has(row.slug) || row.locale === locale) bySlug.set(row.slug, row);
  }
  return [...bySlug.values()].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

function siblingEditions(rows: Row[], slug: string) {
  return rows.filter((row) => row.slug === slug).map(({ locale, date }) => ({ locale, date }));
}

// Published-only exports don't carry draft ownership. Use only their
// recorded article editions so a missing row can't unhide an imported draft.
function postSummary(
  {
    slug,
    title,
    locale,
    date,
    summary,
    tags,
    readingMinutes,
  }: PublicSnapshot["tables"]["posts"][number],
  requested: Locale,
  snapshotAt: string,
): PostSummary {
  return {
    slug,
    title,
    locale,
    date,
    summary,
    tags,
    readingMinutes,
    isFallback: locale !== requested,
    snapshotAt,
  };
}

function secretSummary(
  {
    slug,
    title,
    locale,
    date,
    summary,
    kind,
    duration,
    audio,
    readingMinutes,
  }: PublicSnapshot["tables"]["secrets"][number],
  requested: Locale,
): SecretSummary {
  return {
    slug,
    title,
    locale,
    date,
    summary,
    kind,
    duration,
    audio,
    readingMinutes,
    isFallback: locale !== requested,
  };
}

function ordered<T extends { sort: number }>(rows: T[]): T[] {
  return rows.toSorted((a, b) => a.sort - b.sort);
}

function films(snapshot: PublicSnapshot) {
  return ordered(snapshot.tables.films).map(({ draft: _draft, sort: _sort, ...row }) => row);
}
function idols(snapshot: PublicSnapshot) {
  return ordered(snapshot.tables.idols).map(({ draft: _draft, sort: _sort, ...row }) => row);
}

export const snapshotContent = {
  posts(this: void, snapshot: PublicSnapshot, locale: Locale) {
    return editions(snapshot.tables.posts, locale).map((row) =>
      postSummary(row, locale, snapshot.publishedAt),
    );
  },
  post(
    this: void,
    snapshot: PublicSnapshot,
    slug: string,
    locale: Locale,
    drafts = false,
  ): Post | undefined {
    if (drafts) return;
    const rows = snapshot.tables.posts.filter((row) => row.slug === slug);
    const row = rows.find((entry) => entry.locale === locale) ?? rows[0];
    if (!row) return;
    return {
      ...postSummary(row, locale, snapshot.publishedAt),
      html: row.bodyHtml,
    };
  },
  postEditions(this: void, snapshot: PublicSnapshot, slug: string) {
    return siblingEditions(snapshot.tables.posts, slug);
  },
  secrets(this: void, snapshot: PublicSnapshot, locale: Locale) {
    return editions(snapshot.tables.secrets, locale).map((row) => secretSummary(row, locale));
  },
  secret(
    this: void,
    snapshot: PublicSnapshot,
    slug: string,
    locale: Locale,
    drafts = false,
  ): Secret | undefined {
    if (drafts) return;
    const rows = snapshot.tables.secrets.filter((row) => row.slug === slug);
    const row = rows.find((entry) => entry.locale === locale) ?? rows[0];
    if (!row) return;
    return { ...secretSummary(row, locale), html: row.bodyHtml };
  },
  secretEditions(this: void, snapshot: PublicSnapshot, slug: string) {
    return siblingEditions(snapshot.tables.secrets, slug);
  },
  sitemapEditions(this: void, snapshot: PublicSnapshot) {
    const project = (rows: Row[]) => rows.map(({ slug, locale, date }) => ({ slug, locale, date }));
    return { posts: project(snapshot.tables.posts), secrets: project(snapshot.tables.secrets) };
  },
  moments(this: void, snapshot: PublicSnapshot) {
    return snapshot.tables.moments
      .map(({ draft: _draft, ...row }) => row)
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          b.postedAt.localeCompare(a.postedAt) ||
          a.key.localeCompare(b.key),
      );
  },
  films,
  film(this: void, snapshot: PublicSnapshot, key: string, drafts = false) {
    return drafts ? undefined : films(snapshot).find((row) => row.key === key);
  },
  idols,
  idol(this: void, snapshot: PublicSnapshot, key: string, drafts = false) {
    return drafts ? undefined : idols(snapshot).find((row) => row.key === key);
  },
  about(this: void, snapshot: PublicSnapshot, language: Locale) {
    const rows = snapshot.tables.abouts;
    const row = rows.find((entry) => entry.locale === language) ?? rows[0];
    return row ? { locale: row.locale, title: row.title, html: row.bodyHtml } : null;
  },
  timeline(this: void, snapshot: PublicSnapshot) {
    return ordered(snapshot.tables.timelineEntries).map(({ sort: _sort, ...row }) => row);
  },
  apps(this: void, snapshot: PublicSnapshot) {
    return ordered(snapshot.tables.apps).map(({ sort: _sort, ...row }) => row);
  },
  chips(this: void, snapshot: PublicSnapshot) {
    return ordered(snapshot.tables.chips).map(({ label, tone }) => ({ label, tone }));
  },
  introNodes(this: void, snapshot: PublicSnapshot) {
    return ordered(snapshot.tables.introNodes).map(
      ({ key, kicker, title, period, body, bullets }) => ({
        key,
        kicker,
        title,
        period,
        body,
        bullets,
      }),
    );
  },
  resumeProfile(this: void, snapshot: PublicSnapshot) {
    const row = snapshot.tables.resumeProfiles.find((item) => item.key === "main");
    if (!row) return null;
    const { key: _key, ...fields } = row;
    return { ...fields, updatedAt: snapshot.publishedAt };
  },
  resumeExperiences(this: void, snapshot: PublicSnapshot) {
    return ordered(snapshot.tables.resumeExperiences).map(({ sort: _sort, ...row }) => row);
  },
  navItems(this: void, snapshot: PublicSnapshot) {
    return ordered(snapshot.tables.navItems).map(({ href, labelKey, surfaces, group }) => ({
      href,
      labelKey,
      surfaces,
      group: isNavGroup(group) ? group : null,
    }));
  },
  search(this: void, snapshot: PublicSnapshot, locale: Locale) {
    return {
      nav: snapshotContent.navItems(snapshot),
      posts: snapshotContent.posts(snapshot, locale),
      secrets: snapshotContent.secrets(snapshot, locale),
      apps: snapshotContent.apps(snapshot),
      films: snapshotContent.films(snapshot),
      idols: snapshotContent.idols(snapshot),
      moments: snapshotContent.moments(snapshot),
    };
  },
};
