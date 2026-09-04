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
import { Opening, type OpeningMeta } from "@/components/home/Opening";
import { NeonSplash } from "@/components/home/NeonSplash";
import { GroveApproach } from "@/components/grove/GroveApproach";
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
 * The cover of the issue, in three movements.
 *
 * First paper: the manifesto alone on a full screen, the site's one primary
 * control under it, and a mono line of facts the database can vouch for.
 * Then the approach — a window the scrollbar opens onto the grove, and the
 * paper of the issue coming back down over it. Then the issue itself at the
 * 680px measure: what was written, what was built, and where to find the
 * person who did it.
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const th = await getTranslations("grove");
  const ts = await getTranslations("software");
  const td = await getTranslations("splash");

  const [allPosts, allApps, timeline] = await Promise.all([
    getPosts(locale),
    getApps(),
    getTimeline(),
  ]);
  const releases = await getLatestReleases(allApps.map((app) => app.repo));

  /** The plate in front of the moss is whatever was written last. */
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

  /* The counts on the masthead are the same two the stat pair used to carry,
     read off the database rather than typed. */
  const meta: OpeningMeta[] = [
    { label: th("metaPlaceLabel"), value: th("metaPlace") },
    { label: th("metaCraftLabel"), value: th("metaCraft") },
    { label: th("statPosts"), value: th("statPostsValue", { count: allPosts.length }) },
    { label: th("statApps"), value: th("statAppsValue", { count: allApps.length }) },
  ];

  return (
    <>
      {/* The front door, once per session on a hard landing: the neon over
          the door of fhf's, and the way in through its ring. A sibling of
          <main>, not a child — RouteTransition scales <main> on a reveal,
          and a transformed ancestor would pin this fixed wall to it. */}
      <NeonSplash
        label={td("label")}
        welcome={td("welcome")}
        signOn={td("signOn")}
        signOff={td("signOff")}
        toggleHint={td("toggleHint")}
        enter={td("enter")}
        enterHint={td("enterHint")}
        tonight={td("tonight")}
        trackTitle={td("trackTitle")}
        trackArtist={td("trackArtist")}
        fallbackTrackArtist={td("fallbackTrackArtist")}
      />
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

      <Opening
        headline={[th("headline1"), th("headline2")]}
        lede={th("lede")}
        cta={{ label: th("cta"), href: `/${locale}/portfolio` }}
        meta={meta}
      />

      <GroveApproach
        kicker={th("cardLabLabel")}
        title={th("cardLabTitle")}
        link={{ label: th("approachLink"), href: `/${locale}/lab/grove` }}
        cards={[
          {
            label: th("cardLabLabel"),
            title: th("cardLabTitle"),
            href: `/${locale}/lab/grove`,
            src: "/grove/moss-plate.webp",
            alt: th("cardLabAlt"),
            linkLabel: th("cardLabLink"),
          },
          {
            label: th("cardPostLabel"),
            title: latest?.title ?? th("cardPostFallback"),
            href: latest ? `/${locale}/blog/${latest.slug}` : `/${locale}/blog`,
            src: "/lab/dissolve/forest.jpg",
            alt: th("cardPostAlt"),
            linkLabel: th("cardPostLink"),
          },
        ]}
      />

      {/* The issue itself, at the 680px measure. */}
      <div
        id="issue"
        className="mx-auto flex w-full max-w-[680px] scroll-mt-24 flex-col gap-20 px-6 pt-24 pb-24 md:gap-24 md:pt-32 md:pb-32"
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
    </>
  );
}
