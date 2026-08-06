import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import {
  setRequestLocale,
  getTranslations,
  getFormatter,
} from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getAdjacentPosts, getAllSlugs, getPost } from "@/lib/content";
import { HAS_CJK } from "@/lib/reading";
import { Mdx } from "@/components/blog/Mdx";
import { PostTitle } from "@/components/blog/PostTitle";
import { TagPill } from "@/components/blog/TagPill";
import { RadialFab } from "@/components/fx/RadialFab";
import { localeAlternates } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { site } from "@/config/site";

/**
 * Every post that exists at build time is prerendered. Anything published
 * afterwards is rendered on first request and then cached — which is why
 * there is no `dynamicParams = false` here any more: the admin needs a new
 * article to be reachable without a redeploy. An unknown slug still 404s,
 * from `notFound()` below rather than from the router.
 */
export async function generateStaticParams() {
  return (await getAllSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/blog/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const post = await getPost(slug, locale);
  if (!post) return {};
  return {
    title: post.title,
    description: post.summary,
    alternates: localeAlternates(`/blog/${slug}`, locale),
  };
}

/**
 * Progressive-blur scrim (the Apple depth-of-field trick): five stacked
 * backdrop-filter layers whose masks hand over to each other, so text sliding
 * under the island dissolves into focus loss instead of hitting a hard edge.
 * Blur doubles per layer while the mask reveals it higher up the strip; the
 * accumulated result is strongest right under the island. Kept to five layers
 * and 5rem of height — this rides above a scrolling article on phones.
 */
const SCRIM_LAYERS = [
  { blur: "backdrop-blur-[1px]", from: 0, to: 17 },
  { blur: "backdrop-blur-[2px]", from: 17, to: 34 },
  { blur: "backdrop-blur-[4px]", from: 34, to: 51 },
  { blur: "backdrop-blur-[8px]", from: 51, to: 68 },
  { blur: "backdrop-blur-[16px]", from: 68, to: 85 },
];

function TopScrim() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-20 md:h-24 print:hidden"
    >
      {SCRIM_LAYERS.map((layer) => {
        const mask = `linear-gradient(to top, transparent ${layer.from}%, black ${layer.to}%, black 100%)`;
        return (
          <div
            key={layer.blur}
            className={`absolute inset-0 ${layer.blur} reduced-transparency:backdrop-blur-none`}
            style={{ maskImage: mask, WebkitMaskImage: mask }}
          />
        );
      })}
    </div>
  );
}

/**
 * The article: one 68ch column, mono meta line, and nothing that moves while
 * you read. The headline decodes once (Latin) or masks in line by line
 * (Chinese); everything below it is static by design.
 */
export default async function PostPage({ params }: PageProps<"/[locale]/blog/[slug]">) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const format = await getFormatter();
  const post = await getPost(slug, locale);
  if (!post) notFound();

  // Neighbours come from the same date-descending index the list page shows,
  // so "previous" always means the post published before this one. Fetched as
  // titles only — this page has no use for the other articles' bodies.
  const { older, newer } = await getAdjacentPosts(post.slug, locale);
  const minutes = post.readingMinutes;

  return (
    <>
      <TopScrim />
      <main className="mx-auto w-full max-w-[68ch] flex-1 px-6 pb-28 pt-32 md:pt-40">
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.summary,
            datePublished: post.date,
            author: { "@type": "Person", name: site.author },
            url: `${site.url}/${locale}/blog/${post.slug}`,
          }}
        />
        <article>
          <header className="mb-12">
            <p className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
              <time dateTime={post.date}>
                {format.dateTime(new Date(post.date), {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
              <span aria-hidden>·</span>
              <span>{t("readingTime", { minutes })}</span>
              {post.tags.map((tag) => (
                <TagPill key={tag} tag={tag} />
              ))}
            </p>

            <PostTitle title={post.title} className="text-title md:text-display-sm" />

            {post.summary && (
              <p
                className={`mt-5 font-serif text-[1.1875rem] leading-relaxed text-fg-secondary ${
                  // Serif italic is the editorial voice change — but CJK has
                  // no true italic, and the synthesised slant reads as broken.
                  HAS_CJK.test(post.summary) ? "" : "italic"
                }`}
              >
                {post.summary}
              </p>
            )}
          </header>

          {post.isFallback && (
            <p className="glass-thin vibrancy mb-10 rounded-card px-4 py-3 text-caption">
              {t("fallbackNotice")}
            </p>
          )}

          <Mdx html={post.html} />
        </article>

        {(older || newer) && (
          <nav
            aria-label={t("postNavAria")}
            className="mt-20 grid gap-8 border-t border-line pt-8 sm:grid-cols-2"
          >
            {older && (
              <Link
                href={`/blog/${older.slug}`}
                className="group flex flex-col gap-1.5"
              >
                <span className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                  ← {t("prevPost")}
                </span>
                <span className="text-heading text-fg transition-colors duration-200 group-hover:text-accent">
                  {older.title}
                </span>
              </Link>
            )}
            {newer && (
              <Link
                href={`/blog/${newer.slug}`}
                className="group flex flex-col gap-1.5 sm:col-start-2 sm:items-end sm:text-right"
              >
                <span className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                  {t("nextPost")} →
                </span>
                <span className="text-heading text-fg transition-colors duration-200 group-hover:text-accent">
                  {newer.title}
                </span>
              </Link>
            )}
          </nav>
        )}

        <p className="mt-14">
          <Link
            href="/blog"
            className="hit-ext relative font-mono text-meta uppercase tracking-meta text-fg-secondary transition-colors duration-200 hover:text-accent"
          >
            ← {t("backToList")}
          </Link>
        </p>
      </main>
      <RadialFab shareTitle={post.title} />
    </>
  );
}
