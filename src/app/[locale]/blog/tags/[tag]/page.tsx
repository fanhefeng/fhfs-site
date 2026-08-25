import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { site } from "@/config/site";
import { feedTypes } from "@/lib/seo";
import { getAllTags, getPostsByTag } from "@/lib/content";
import { YearIndex } from "@/components/blog/PostCard";
import { Reveal } from "@/components/fx/Reveal";

/**
 * Every tag in use at build time gets a page. A tag that only appears on a
 * post written later is rendered on first request instead — hence no
 * `dynamicParams = false`; a tag nobody uses still 404s from `notFound()`.
 *
 * `params.tag` arrives already URL-decoded (the route matcher runs
 * `decodeURIComponent` on every dynamic segment), so a Chinese tag reads as
 * itself here and only the *outgoing* URL below needs encoding.
 */
export async function generateStaticParams() {
  // Tags can differ per locale; union across locales.
  const tags = new Set<string>();
  for (const locale of routing.locales) {
    for (const { tag } of await getAllTags(locale)) tags.add(tag);
  }
  return [...tags].map((tag) => ({ tag }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/blog/tags/[tag]">): Promise<Metadata> {
  const { locale, tag } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "blog" });
  const posts = await getPostsByTag(tag, locale);
  return {
    title: t("taggedWith", { tag }),
    description: `${t("taggedWith", { tag })} · ${t("filterSummary", { count: posts.length })}`,
    // Tags are per-locale strings, not translations of each other, so there
    // is no hreflang to declare — only this page's own canonical.
    alternates: {
      canonical: `${site.url}/${locale}/blog/tags/${encodeURIComponent(tag)}`,
      types: feedTypes(locale),
    },
  };
}

/**
 * The index, filtered. Same year-bucketed lines as /blog, with the filter
 * state stated plainly ("N posts · clear filter") so the way out is never
 * more than one tap away.
 */
export default async function TagPage({ params }: PageProps<"/[locale]/blog/tags/[tag]">) {
  const { locale, tag } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const posts = await getPostsByTag(tag, locale);
  if (posts.length === 0) notFound();

  return (
    <main id="main" className="mx-auto w-full max-w-[720px] flex-1 px-6 pb-28 pt-32 md:pt-40">
      <Reveal as="section" className="mb-12">
        <p className="mb-4 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {t("tags")}
        </p>
        <h1 className="text-display-sm">{t("taggedWith", { tag })}</h1>
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

      <YearIndex posts={posts} yearAria={(year) => t("yearAria", { year })} />
    </main>
  );
}
