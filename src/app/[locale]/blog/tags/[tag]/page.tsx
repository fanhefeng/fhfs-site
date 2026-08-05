import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getAllTags, getPostsByTag } from "@/lib/content";
import { PostCard, groupPostsByYear } from "@/components/blog/PostCard";
import { Reveal } from "@/components/fx/Reveal";

type Props = { params: Promise<{ locale: string; tag: string }> };

/**
 * Every tag in use at build time gets a page. A tag that only appears on a
 * post written later is rendered on first request instead — hence no
 * `dynamicParams = false`; a tag nobody uses still 404s from `notFound()`.
 */
export async function generateStaticParams() {
  // Tags can differ per locale; union across locales.
  const tags = new Set<string>();
  for (const locale of routing.locales) {
    for (const { tag } of await getAllTags(locale)) tags.add(tag);
  }
  return [...tags].map((tag) => ({ tag }));
}

function decodeTag(tag: string) {
  try {
    return decodeURIComponent(tag);
  } catch {
    return tag;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, tag } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "blog" });
  return { title: t("taggedWith", { tag: decodeTag(tag) }) };
}

/**
 * The index, filtered. Same year-bucketed lines as /blog, with the filter
 * state stated plainly ("N posts · clear filter") so the way out is never
 * more than one tap away.
 */
export default async function TagPage({ params }: Props) {
  const { locale, tag } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const decoded = decodeTag(tag);
  const posts = await getPostsByTag(decoded, locale as Locale);
  if (posts.length === 0) notFound();
  const years = groupPostsByYear(posts);

  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-6 pb-28 pt-32 md:pt-40">
      <Reveal as="section" className="mb-12">
        <p className="mb-4 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {t("tags")}
        </p>
        <h1 className="text-display-sm">{t("taggedWith", { tag: decoded })}</h1>
        <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          <span>{t("filterSummary", { count: posts.length })}</span>
          <span aria-hidden>·</span>
          <Link
            href="/blog"
            className="hit-ext relative text-accent underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-200 hover:decoration-current"
          >
            {t("clearFilter")}
          </Link>
        </p>
      </Reveal>

      {years.map(({ year, posts: yearPosts }) => (
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
      ))}
    </main>
  );
}
