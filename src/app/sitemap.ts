import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { site } from "@/config/site";
import { localeLanguages } from "@/lib/seo";
import { getAllSlugs, getAllTags, getNavItems, getPost } from "@/lib/content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // The same nav table the header, footer and menu read — one place to add a
  // page, rather than four lists to remember to update.
  const staticPaths = (await getNavItems("sitemap")).map((item) =>
    item.href === "/" ? "" : item.href
  );

  for (const path of staticPaths) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${site.url}/${locale}${path}`,
        alternates: { languages: localeLanguages(path) },
        changeFrequency: path === "/blog" ? "weekly" : "monthly",
      });
    }
  }

  // Both locales exist for every slug: the read layer falls back to the other
  // language rather than 404ing, so each URL renders.
  const slugs = await getAllSlugs();
  entries.push(
    ...(await Promise.all(
      slugs.flatMap((slug) =>
        routing.locales.map(async (locale) => {
          const post = await getPost(slug, locale);
          return {
            url: `${site.url}/${locale}/blog/${slug}`,
            lastModified: post ? new Date(post.date) : undefined,
            alternates: { languages: localeLanguages(`/blog/${slug}`) },
          };
        })
      )
    ))
  );

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
