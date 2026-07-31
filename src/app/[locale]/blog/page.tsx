import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { getPosts, getAllTags } from "@/lib/content";
import { localeAlternates } from "@/lib/seo";
import { PostCard, groupPostsByYear } from "@/components/blog/PostCard";
import { TagPill } from "@/components/blog/TagPill";
import { Reveal } from "@/components/fx/Reveal";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "blog" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: localeAlternates("/blog", locale),
  };
}

/**
 * The magazine's table of contents: a 720px column of plain text lines,
 * bucketed by year, dates flush right in mono. No cards, no thumbnails —
 * at this volume a reader wants to scan titles, not browse tiles.
 */
export default async function BlogPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const posts = getPosts(locale as Locale);
  const tags = getAllTags(locale as Locale);
  const years = groupPostsByYear(posts);

  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-6 pb-28 pt-32 md:pt-40">
      <Reveal as="section" className="mb-12">
        <h1 className="text-display-sm">{t("title")}</h1>
        <p className="mt-4 max-w-[46ch] text-body text-fg-secondary">
          {t("subtitle")}
        </p>
        {posts.length > 0 && (
          <p className="mt-5 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
            {t("filterSummary", { count: posts.length })}
          </p>
        )}
      </Reveal>

      {tags.length > 0 && (
        <Reveal
          as="div"
          stagger={0.04}
          className="mb-16 flex flex-wrap items-center gap-x-3 gap-y-4"
        >
          {tags.map(({ tag, count }, i) => (
            <TagPill key={tag} tag={tag} count={count} variant="sticker" seed={i} />
          ))}
        </Reveal>
      )}

      {posts.length === 0 ? (
        <p className="text-body text-fg-secondary">{t("empty")}</p>
      ) : (
        years.map(({ year, posts: yearPosts }) => (
          <section
            key={year}
            aria-label={t("yearAria", { year })}
            className="mb-14 last:mb-0"
          >
            <h2 className="mb-3 font-mono text-meta uppercase tracking-meta text-fg-tertiary tabular-nums">
              {year}
            </h2>
            <Reveal as="ol" stagger={0.05} className="border-t border-line">
              {yearPosts.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </Reveal>
          </section>
        ))
      )}
    </main>
  );
}
