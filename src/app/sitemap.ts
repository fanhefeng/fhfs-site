import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { site } from "@/config/site";
import { localeLanguages } from "@/lib/server/seo";
import {
  getAllTags,
  getFilms,
  getIdols,
  getNavItems,
  getSitemapEditions,
  type PublishedEdition,
} from "@/lib/server/content";
import { LAB_ENTRIES } from "@/components/lab/entries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  // Every slug is *served* under both prefixes — the read layer falls back to
  // the other language rather than 404ing — but only the locales that have
  // their own version are listed. A fallback URL is a duplicate of the
  // original, and its hreflang would claim a translation that does not exist.
  //
  // Edition metadata arrives as one batch; all other lists are independent.
  const [editions, tagsByLocale, nav, idols, films] = await Promise.all([
    getSitemapEditions(),
    Promise.all(routing.locales.map((locale) => getAllTags(locale))),
    getNavItems("sitemap"),
    getIdols(),
    getFilms(),
  ]);
  const newestPost = editions.posts
    .map(({ date }) => new Date(date))
    .reduce<Date | undefined>(
      (newest, date) => (newest && newest >= date ? newest : date),
      undefined,
    );

  // The same nav table the header, footer and menu read — one place to add a
  // page, rather than four lists to remember to update.
  const staticPaths = nav.map((item) => (item.href === "/" ? "" : item.href));

  for (const path of staticPaths) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${site.url}/${locale}${path}`,
        // The blog index changes when an article does. The other static
        // pages carry no edit date of their own, and the field is left out
        // rather than filled with the build date: a lastmod that moves on
        // every deploy is one crawlers learn to ignore, the articles' with it.
        lastModified: path === "/blog" ? newestPost : undefined,
        alternates: { languages: localeLanguages(path) },
        changeFrequency: path === "/blog" ? "weekly" : "monthly",
      });
    }
  }

  // The lab's studies live one level below /lab and are not in the nav table.
  // Iterated rather than listed so a new entry in entries.ts shows up here
  // without anyone remembering this file.
  for (const entry of LAB_ENTRIES) {
    const path = `/lab/${entry.slug}`;
    for (const locale of routing.locales) {
      entries.push({
        url: `${site.url}/${locale}${path}`,
        alternates: { languages: localeLanguages(path) },
        changeFrequency: "monthly",
      });
    }
  }

  // The idols and the films hang one level below their rooms, a page per row.
  const subPaths = [
    ...idols.map((idol) => `/idols/${idol.key}`),
    ...films.map((film) => `/films/${film.key}`),
  ];
  for (const path of subPaths) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${site.url}/${locale}${path}`,
        alternates: { languages: localeLanguages(path) },
        changeFrequency: "monthly",
      });
    }
  }

  const pushEditions = (rows: PublishedEdition[], section: "blog" | "secrets") => {
    const bySlug = new Map<string, PublishedEdition[]>();
    for (const row of rows) {
      const group = bySlug.get(row.slug);
      if (group) group.push(row);
      else bySlug.set(row.slug, [row]);
    }
    for (const [slug, versions] of bySlug) {
      const available = versions.map(({ locale }) => locale);
      for (const { locale, date } of versions) {
        entries.push({
          url: `${site.url}/${locale}/${section}/${slug}`,
          lastModified: new Date(date),
          alternates: {
            languages: localeLanguages(`/${section}/${slug}`, available),
          },
        });
      }
    }
  };

  pushEditions(editions.posts, "blog");
  pushEditions(editions.secrets, "secrets");

  // Tags are per-locale strings, not translations of each other: a tag the
  // other locale never uses 404s there, so each locale lists only its own —
  // and no alternates, because there is no counterpart to point at.
  routing.locales.forEach((locale, i) => {
    for (const { tag } of tagsByLocale[i]!) {
      entries.push({
        url: `${site.url}/${locale}/blog/tags/${encodeURIComponent(tag)}`,
      });
    }
  });

  return entries;
}
