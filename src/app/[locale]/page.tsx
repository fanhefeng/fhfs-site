import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { localeAlternates } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { site } from "@/config/site";
import { getPosts, getApps, getTimeline } from "@/lib/content";
import { getLatestReleases } from "@/lib/github";
import { toSoftwareApp } from "@/components/software/appMeta";
import { GroveHero } from "@/components/grove/GroveHero";
import type { DockItem } from "@/components/grove/NavDock";
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

/* Glyphs for the dock, drawn rather than imported: at 14u they are a dozen
   path commands each, and a sprite sheet for that is a request. */
const GLYPHS: Record<string, React.ReactNode> = {
  writing: (
    <svg viewBox="0 0 16 16">
      <path d="M4 2.4h5.3L12 5.1v8.5H4z" />
      <path d="M9.2 2.4V5h2.7" />
      <path d="M6 8.4h4M6 10.8h2.8" />
    </svg>
  ),
  software: (
    <svg viewBox="0 0 16 16">
      <path d="M2.6 3.6h10.8v7.2H2.6z" />
      <path d="M5.6 13.4h4.8" />
      <path d="m6.4 6.2 1.6 1.6-1.6 1.6" />
    </svg>
  ),
  about: (
    <svg viewBox="0 0 16 16">
      <circle cx="8" cy="5.4" r="2.6" />
      <path d="M3.2 13.4c.6-2.6 2.3-3.9 4.8-3.9s4.2 1.3 4.8 3.9" />
    </svg>
  ),
  lab: (
    <svg viewBox="0 0 16 16">
      <path d="M1.6 12.4c2.4-3.4 4.3-5.1 5.7-5.1 2 0 3 3.6 5 3.6 1.1 0 1.9-.5 2.4-1.4" />
      <path d="M4.3 6.2C5.5 4.4 6.6 3.5 7.6 3.5c1.5 0 2.2 2.4 3.7 2.4" />
    </svg>
  ),
};

/**
 * The cover of the issue is the grove: a full-viewport composition grown by
 * the lab, with the manifesto standing in front of it and its own dock for
 * navigation. Below it the magazine proper — recent writing, the software
 * shelf, a closing note — at the 680px measure. Everything on the cover is
 * real: the counts come from the database, the two cards point at the newest
 * thing written and at the study the moss came out of.
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const th = await getTranslations("grove");
  const ts = await getTranslations("software");
  const nav = await getTranslations("nav");

  const [allPosts, allApps, timeline] = await Promise.all([
    getPosts(locale),
    getApps(),
    getTimeline(),
  ]);
  const releases = await getLatestReleases(allApps.map((app) => app.repo));

  const latest = allPosts[0];

  const posts: WritingItem[] = allPosts.slice(0, POST_COUNT).map((post) => ({
    slug: post.slug,
    title: post.title,
    date: post.date.replaceAll("-", "."),
    readingTime: t("readingTime", { minutes: post.readingMinutes }),
  }));

  const apps: BentoItem[] = allApps.slice(0, APP_COUNT).map((app, i) => {
    const wide = i < 2;
    const version = app.repo ? releases.get(app.repo)?.version : undefined;
    return {
      name: app.name,
      tagline: app.tagline[locale],
      category: ts(`categories.${app.category}`),
      href: app.website,
      mock: wide ? toSoftwareApp(app, i, locale) : undefined,
      mockLabel: wide ? ts("mockAlt", { name: app.name }) : undefined,
      // Version beside platform on the two wide cards — the version is read
      // from the repo's latest GitHub release, so it keeps itself current.
      stat: wide ? [version, ...app.platforms].filter(Boolean).join(" · ") : undefined,
    };
  });

  // The cover's short version of the /about changelog: newest three releases,
  // dates trimmed to year.month the way the mono column likes them.
  const nowItems: NowItem[] = timeline.slice(0, NOW_COUNT).map((entry) => ({
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
    ...(site.social.email
      ? [{ label: "Email", href: `mailto:${site.social.email}` }]
      : []),
  ];

  /* The dock says where you are: the mark is this page, the four items are
     the site's main sections in the header's order. */
  const dockItems: DockItem[] = [
    { href: "/blog", label: nav("blog"), glyph: GLYPHS.writing },
    { href: "/software", label: nav("software"), glyph: GLYPHS.software },
    { href: "/about", label: nav("about"), glyph: GLYPHS.about },
    { href: "/lab", label: nav("lab"), glyph: GLYPHS.lab },
  ];

  return (
    <main id="main" className="flex-1">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: site.author,
          url: site.url,
          sameAs: [site.social.github],
          ...(site.social.email ? { email: site.social.email } : {}),
        }}
      />

      <GroveHero
        ghost={th("ghost")}
        headline={[th("headline1"), th("headline2")]}
        lede={th("lede")}
        cta={{ label: th("cta"), href: "/portfolio" }}
        play={{ label: th("play"), href: "/intro" }}
        stats={[
          { label: th("statPosts"), value: th("statPostsValue", { count: allPosts.length }) },
          { label: th("statApps"), value: th("statAppsValue", { count: allApps.length }) },
        ]}
        cards={[
          {
            label: th("cardLabLabel"),
            title: th("cardLabTitle"),
            href: "/lab/grove",
            src: "/grove/moss-plate.webp",
            alt: th("cardLabAlt"),
            linkLabel: th("cardLabLink"),
          },
          {
            label: th("cardPostLabel"),
            title: latest?.title ?? th("cardPostFallback"),
            href: latest ? `/blog/${latest.slug}` : "/blog",
            src: "/lab/dissolve/forest.jpg",
            alt: th("cardPostAlt"),
            linkLabel: th("cardPostLink"),
          },
        ]}
        scroll={{ label: th("scroll"), href: "#issue" }}
        dock={{
          ariaLabel: th("dockAria"),
          markLabel: th("markLabel"),
          markHref: "/",
          items: dockItems,
        }}
      />

      {/* The issue itself, at the 680px measure. */}
      <div
        id="issue"
        className="mx-auto flex w-full max-w-[680px] scroll-mt-24 flex-col gap-20 px-6 pt-20 pb-24 md:gap-24 md:pt-28 md:pb-32"
      >
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
