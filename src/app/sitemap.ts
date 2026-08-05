import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { site } from "@/config/site";
import { getAllSlugs, getAllTags, getNavItems, getPost } from "@/lib/content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // The same nav table the header, footer and menu read — one place to add a
  // page, rather than four lists to remember to update.
  const staticPaths = (await getNavItems("sitemap")).map((item) =>
    item.href === "/" ? "" : item.href
  );

  const alternatesFor = (path: string) => ({
    languages: Object.fromEntries(
      routing.locales.map((l) => [
        l === "zh" ? "zh-CN" : "en",
        `${site.url}/${l}${path}`,
      ])
    ),
  });

  for (const path of staticPaths) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${site.url}/${locale}${path}`,
        alternates: alternatesFor(path),
        changeFrequency: path === "/blog" ? "weekly" : "monthly",
      });
    }
  }

  for (const slug of await getAllSlugs()) {
    for (const locale of routing.locales) {
      const post = await getPost(slug, locale);
      entries.push({
        url: `${site.url}/${locale}/blog/${slug}`,
        lastModified: post ? new Date(post.date) : undefined,
        alternates: alternatesFor(`/blog/${slug}`),
      });
    }
  }

  const tags = new Set<string>();
  for (const locale of routing.locales) {
    for (const { tag } of await getAllTags(locale)) tags.add(tag);
  }
  for (const tag of tags) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${site.url}/${locale}/blog/tags/${encodeURIComponent(tag)}`,
      });
    }
  }

  return entries;
}
