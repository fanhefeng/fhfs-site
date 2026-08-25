import type { MetadataRoute } from "next";
import { routing, type Locale } from "@/i18n/routing";
import { site } from "@/config/site";
import { localeLanguages } from "@/lib/seo";
import { getAllSlugs, getAllTags, getNavItems, getPost } from "@/lib/content";
import { LAB_ENTRIES } from "@/components/lab/entries";

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

  // Every slug is *served* under both prefixes — the read layer falls back to
  // the other language rather than 404ing — but only the locales that have
  // their own version are listed. A fallback URL is a duplicate of the
  // original, and its hreflang would claim a translation that does not exist.
  const slugs = await getAllSlugs();
  for (const slug of slugs) {
    const versions = await Promise.all(
      routing.locales.map(async (locale) => ({
        locale,
        post: await getPost(slug, locale),
      }))
    );
    const real = versions.filter(({ post }) => post && !post.isFallback);
    const available: Locale[] = real.map(({ locale }) => locale);
    for (const { locale, post } of real) {
      entries.push({
        url: `${site.url}/${locale}/blog/${slug}`,
        lastModified: post ? new Date(post.date) : undefined,
        alternates: { languages: localeLanguages(`/blog/${slug}`, available) },
      });
    }
  }

  // Tags are per-locale strings, not translations of each other: a tag the
  // other locale never uses 404s there, so each locale lists only its own —
  // and no alternates, because there is no counterpart to point at.
  for (const locale of routing.locales) {
    for (const { tag } of await getAllTags(locale)) {
      entries.push({
        url: `${site.url}/${locale}/blog/tags/${encodeURIComponent(tag)}`,
      });
    }
  }

  return entries;
}
