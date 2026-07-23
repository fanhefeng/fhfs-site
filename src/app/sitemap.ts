import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { site } from "@/config/site";
import { getAllSlugs, getAllTags, getPost } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  const staticPaths = ["", "/blog", "/about", "/portfolio", "/software"];

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

  for (const slug of getAllSlugs()) {
    for (const locale of routing.locales) {
      const post = getPost(slug, locale);
      entries.push({
        url: `${site.url}/${locale}/blog/${slug}`,
        lastModified: post ? new Date(post.date) : undefined,
        alternates: alternatesFor(`/blog/${slug}`),
      });
    }
  }

  const tags = new Set<string>();
  for (const locale of routing.locales) {
    for (const { tag } of getAllTags(locale)) tags.add(tag);
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
