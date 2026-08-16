import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { localeAlternates } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { site } from "@/config/site";
import { getPosts, getApps, getTimeline } from "@/lib/content";
import { toSoftwareApp } from "@/components/software/appMeta";
import { HomeHero } from "@/components/home/HomeHero";
import { ManifestoBand } from "@/components/home/ManifestoBand";
import { RecentWriting, type WritingItem } from "@/components/home/RecentWriting";
import { MiniBento, type BentoItem } from "@/components/home/MiniBento";
import {
  AboutTeaser,
  type ContactLink,
  type NowItem,
} from "@/components/home/AboutTeaser";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return { alternates: localeAlternates("", locale) };
}

/** How many entries each section of the issue carries. */
const POST_COUNT = 4;
const APP_COUNT = 6;
const NOW_COUNT = 3;

/**
 * The proof line on the two wide bento cards — version beside the platform.
 * TODO(user): these version numbers are placeholders; put the real ones in
 * (or drop an app from the map to hide its line).
 */
const APP_VERSIONS: Record<string, string> = {
  portreaper: "v1.0",
  "photo-browser": "v1.0",
};

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const ts = await getTranslations("software");

  const posts: WritingItem[] = (await getPosts(locale))
    .slice(0, POST_COUNT)
    .map((post) => ({
      slug: post.slug,
      title: post.title,
      date: post.date.replaceAll("-", "."),
      readingTime: t("readingTime", { minutes: post.readingMinutes }),
    }));

  const apps: BentoItem[] = (await getApps())
    .slice(0, APP_COUNT)
    .map((app, i) => {
      const wide = i < 2;
      const version = APP_VERSIONS[app.key];
      return {
        name: app.name,
        tagline: app.tagline[locale],
        category: ts(`categories.${app.category}`),
        href: app.website,
        mock: wide ? toSoftwareApp(app, i, locale) : undefined,
        mockLabel: wide ? ts("mockAlt", { name: app.name }) : undefined,
        stat:
          wide && version
            ? [version, ...app.platforms].join(" · ")
            : undefined,
      };
    });

  // The cover's short version of the /about changelog: newest three releases,
  // dates trimmed to year.month the way the mono column likes them.
  const nowItems: NowItem[] = (await getTimeline())
    .slice(0, NOW_COUNT)
    .map((entry) => ({
      key: entry.key,
      version: entry.version,
      title: entry.title[locale],
      date: entry.date
        ? entry.date.slice(0, 7).replace("-", ".")
        : (entry.dateLabel?.[locale] ?? ""),
    }));

  const contacts: ContactLink[] = [
    { label: "GitHub", href: site.social.github, external: true },
    { label: "RSS", href: `/${locale}/rss.xml` },
    // The email stays out of the row until site.ts carries a real one — the
    // same rule the footer sticker follows.
    ...(site.social.email
      ? [{ label: "Email", href: `mailto:${site.social.email}` }]
      : []),
  ];

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
          index="01"
        />
        <MiniBento
          items={apps}
          title={t("featuredWorks")}
          viewAllLabel={t("viewAllSoftware")}
          index="02"
        />
        <AboutTeaser
          title={t("aboutTitle")}
          index="03"
          lead1={t("aboutLead1")}
          lead2={t("aboutLead2")}
          linkLabel={t("aboutLink")}
          nowItems={nowItems}
          nowTitle={t("nowTitle")}
          nowBadge={t("nowBadge")}
          contactTitle={t("contactTitle")}
          contacts={contacts}
        />
      </div>
    </main>
  );
}
