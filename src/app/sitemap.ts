import type { MetadataRoute } from "next";
import { routing, type Locale } from "@/i18n/routing";
import { site } from "@/config/site";
import { localeLanguages } from "@/lib/seo";
import {
  getAllSecretSlugs,
  getAllSlugs,
  getAllTags,
  getNavItems,
  getPostEditions,
  getSecretEditions,
} from "@/lib/content";
import { LAB_ENTRIES } from "@/components/lab/entries";
import { IDOLS } from "@/components/idols/entries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  // Static pages carry no edit date of their own; the build date is the
  // closest honest answer, and it beats leaving the field out.
  const built = new Date();

  // The same nav table the header, footer and menu read — one place to add a
  // page, rather than four lists to remember to update.
  const staticPaths = (await getNavItems("sitemap")).map((item) =>
    item.href === "/" ? "" : item.href
  );

  for (const path of staticPaths) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${site.url}/${locale}${path}`,
        lastModified: built,
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
        lastModified: built,
        alternates: { languages: localeLanguages(path) },
        changeFrequency: "monthly",
      });
    }
  }

  // The idols hang one level below /idols, listed in code like the studies.
  for (const idol of IDOLS) {
    const path = `/idols/${idol.slug}`;
    for (const locale of routing.locales) {
      entries.push({
        url: `${site.url}/${locale}${path}`,
        lastModified: built,
        alternates: { languages: localeLanguages(path) },
        changeFrequency: "monthly",
      });
    }
  }

  // Every slug is *served* under both prefixes — the read layer falls back to
  // the other language rather than 404ing — but only the locales that have
  // their own version are listed. A fallback URL is a duplicate of the
  // original, and its hreflang would claim a translation that does not exist.
  //
  // Asked for all at once: awaiting inside the loop was one round trip per
  // article over the HTTP driver, in series, during the prerender — this file
  // is the one place on the site where the request count is the whole cost.
  const [postSlugs, secretSlugs] = await Promise.all([
    getAllSlugs(),
    getAllSecretSlugs(),
  ]);
  const [postEditions, secretEditions, tagsByLocale] = await Promise.all([
    Promise.all(postSlugs.map((slug) => getPostEditions(slug))),
    Promise.all(secretSlugs.map((slug) => getSecretEditions(slug))),
    Promise.all(routing.locales.map((locale) => getAllTags(locale))),
  ]);

  const pushEditions = (
    slugs: string[],
    editionsBySlug: { locale: Locale; date: string }[][],
    section: "blog" | "secrets"
  ) => {
    slugs.forEach((slug, i) => {
      const editions = editionsBySlug[i];
      const available: Locale[] = editions.map(({ locale }) => locale);
      for (const { locale, date } of editions) {
        entries.push({
          url: `${site.url}/${locale}/${section}/${slug}`,
          lastModified: new Date(date),
          alternates: {
            languages: localeLanguages(`/${section}/${slug}`, available),
          },
        });
      }
    });
  };

  pushEditions(postSlugs, postEditions, "blog");
  pushEditions(secretSlugs, secretEditions, "secrets");

  // Tags are per-locale strings, not translations of each other: a tag the
  // other locale never uses 404s there, so each locale lists only its own —
  // and no alternates, because there is no counterpart to point at.
  routing.locales.forEach((locale, i) => {
    for (const { tag } of tagsByLocale[i]) {
      entries.push({
        url: `${site.url}/${locale}/blog/tags/${encodeURIComponent(tag)}`,
      });
    }
  });

  return entries;
}
