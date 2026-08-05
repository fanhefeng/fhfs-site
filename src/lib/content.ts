import {
  allPosts,
  allAbouts,
  allWorks,
  allApps,
  allTimelines,
  type Post,
} from "content-collections";
import type { Locale } from "@/i18n/routing";

export type LocalizedPost = Post & { isFallback: boolean };

function byDateDesc(a: Post, b: Post) {
  return b.date.localeCompare(a.date);
}

const publishedPosts = allPosts.filter((p) => !p.draft);

/** All posts for a locale, falling back to the other locale per slug. */
export function getPosts(locale: Locale): LocalizedPost[] {
  const slugs = new Set(publishedPosts.map((p) => p.slug));
  const result: LocalizedPost[] = [];
  for (const slug of slugs) {
    const post = getPost(slug, locale);
    if (post) result.push(post);
  }
  return result.sort(byDateDesc);
}

export function getPost(slug: string, locale: Locale): LocalizedPost | null {
  const variants = publishedPosts.filter((p) => p.slug === slug);
  if (variants.length === 0) return null;
  const exact = variants.find((p) => p.locale === locale);
  if (exact) return { ...exact, isFallback: false };
  return { ...variants[0], isFallback: true };
}

export function getAllSlugs(): string[] {
  return [...new Set(publishedPosts.map((p) => p.slug))];
}

export { readingMinutes } from "./reading";

export function getAllTags(locale: Locale): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const post of getPosts(locale)) {
    for (const tag of post.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export function getPostsByTag(tag: string, locale: Locale): LocalizedPost[] {
  return getPosts(locale).filter((p) => p.tags.includes(tag));
}

export function getAbout(locale: Locale) {
  return (
    allAbouts.find((a) => a.locale === locale) ?? allAbouts[0] ?? null
  );
}

export function getWorks() {
  return [...allWorks].sort((a, b) => a.order - b.order);
}

export function getApps() {
  return [...allApps].sort((a, b) => a.order - b.order);
}

export function getTimeline() {
  return [...allTimelines].sort((a, b) => a.order - b.order);
}
