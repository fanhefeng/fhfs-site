import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getPosts, getAllTags } from "@/lib/content";
import { localeAlternates } from "@/lib/seo";
import { PostCard } from "@/components/blog/PostCard";
import { TagPill } from "@/components/blog/TagPill";
import { SectionTitle } from "@/components/deco/SectionTitle";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: localeAlternates("/blog", locale),
  };
}

export default async function BlogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const posts = getPosts(locale as Locale);
  const tags = getAllTags(locale as Locale);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <SectionTitle title={t("title")} subtitle={t("subtitle")} />
      {tags.length > 0 && (
        <div className="mb-10 flex flex-wrap justify-center gap-2">
          {tags.map(({ tag }) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </div>
      )}
      {posts.length === 0 ? (
        <p className="text-center text-muted-fg">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </main>
  );
}
