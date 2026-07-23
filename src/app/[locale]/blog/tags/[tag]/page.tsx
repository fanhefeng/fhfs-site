import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import { getAllTags, getPostsByTag } from "@/lib/content";
import { PostCard } from "@/components/blog/PostCard";
import { SectionTitle } from "@/components/deco/SectionTitle";

type Props = { params: Promise<{ locale: string; tag: string }> };

export function generateStaticParams() {
  // Tags can differ per locale; union across locales.
  const tags = new Set<string>();
  for (const locale of routing.locales) {
    for (const { tag } of getAllTags(locale)) tags.add(tag);
  }
  return [...tags].map((tag) => ({ tag }));
}

export const dynamicParams = false;

function decodeTag(tag: string) {
  try {
    return decodeURIComponent(tag);
  } catch {
    return tag;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, tag } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  return { title: t("taggedWith", { tag: decodeTag(tag) }) };
}

export default async function TagPage({ params }: Props) {
  const { locale, tag } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const decoded = decodeTag(tag);
  const posts = getPostsByTag(decoded, locale as Locale);
  if (posts.length === 0) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <SectionTitle title={t("taggedWith", { tag: decoded })} />
      <div className="flex flex-col gap-6">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </main>
  );
}
