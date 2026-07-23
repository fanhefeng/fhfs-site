import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getAllSlugs, getPost } from "@/lib/content";
import { Mdx } from "@/components/blog/Mdx";
import { localeAlternates } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { site } from "@/config/site";
import { TagPill } from "@/components/blog/TagPill";
import { ArtDecoDivider } from "@/components/deco/ArtDecoDivider";

type Props = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = getPost(slug, locale as Locale);
  if (!post) return {};
  return {
    title: post.title,
    description: post.summary,
    alternates: localeAlternates(`/blog/${slug}`, locale),
  };
}

export default async function PostPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const format = await getFormatter();
  const post = getPost(slug, locale as Locale);
  if (!post) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
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
        <header className="mb-10 text-center">
          <h1 className="font-deco text-3xl leading-snug tracking-wide text-fg md:text-4xl">
            {post.title}
          </h1>
          <time dateTime={post.date} className="mt-3 block text-xs text-muted-fg">
            {t("publishedOn")}{" "}
            {format.dateTime(new Date(post.date), {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
          {post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {post.tags.map((tag) => (
                <TagPill key={tag} tag={tag} />
              ))}
            </div>
          )}
          <ArtDecoDivider className="mt-6" />
        </header>

        {post.isFallback && (
          <p className="mb-8 rounded border border-gold/30 bg-surface px-4 py-3 text-sm text-gold/90">
            {t("fallbackNotice")}
          </p>
        )}

        <Mdx code={post.mdx} />
      </article>

      <div className="mt-16 text-center">
        <Link
          href="/blog"
          className="text-sm text-neon-blue transition-all hover:[text-shadow:var(--glow-blue)]"
        >
          ← {t("backToList")}
        </Link>
      </div>
    </main>
  );
}
