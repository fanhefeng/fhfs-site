import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { localeAlternates } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { site } from "@/config/site";
import { getPosts, getApps } from "@/lib/content";
import { HomeHero } from "@/components/home/HomeHero";
import { ManifestoBand } from "@/components/home/ManifestoBand";
import { RecentWriting, type WritingItem } from "@/components/home/RecentWriting";
import { MiniBento, type BentoItem } from "@/components/home/MiniBento";
import { AboutTeaser } from "@/components/home/AboutTeaser";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: localeAlternates("", locale) };
}

/** How many entries each section of the issue carries. */
const POST_COUNT = 4;
const APP_COUNT = 6;

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const ts = await getTranslations("software");

  const posts: WritingItem[] = (await getPosts(locale as Locale))
    .slice(0, POST_COUNT)
    .map((post) => ({
      slug: post.slug,
      title: post.title,
      date: post.date.slice(0, 10).replaceAll("-", "."),
      readingTime: t("readingTime", { minutes: post.readingMinutes }),
    }));

  const apps: BentoItem[] = (await getApps())
    .slice(0, APP_COUNT)
    .map((app) => ({
      name: app.name,
      tagline: app.tagline[locale as Locale],
      category: ts(`categories.${app.category}`),
      href: app.website,
    }));

  return (
    <main className="flex-1">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: site.author,
          url: site.url,
          sameAs: [site.social.github],
        }}
      />

      {/* The cover: masthead, manifesto, the cord that turns the lamp on. */}
      <HomeHero />

      {/* The one pinned act of the site — a slogan crossing the screen. */}
      <ManifestoBand />

      {/* Back to the 680px measure for the rest of the issue. */}
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-20 px-6 pt-8 pb-24 md:gap-24 md:pb-32">
        <RecentWriting
          items={posts}
          title={t("latestPosts")}
          viewAllLabel={t("viewAllPosts")}
        />
        <MiniBento
          items={apps}
          title={t("featuredWorks")}
          viewAllLabel={t("viewAllSoftware")}
        />
        <AboutTeaser
          title={t("aboutTitle")}
          lead1={t("aboutLead1")}
          lead2={t("aboutLead2")}
          linkLabel={t("aboutLink")}
        />
      </div>
    </main>
  );
}
