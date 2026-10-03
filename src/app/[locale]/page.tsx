import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { htmlLang, routing } from "@/i18n/routing";
import { pageLocale } from "@/i18n/page";
import { localeAlternates } from "@/lib/server/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { site } from "@/config/site";
import { getPosts, getApps, getMoments } from "@/lib/server/content";
import { getLatestReleases, type Release } from "@/lib/server/github";
import { newestSaid, stampInZone } from "@/lib/moments";
import { newestLabEntry } from "@/components/lab/entries";
import { Chibi } from "@/components/chibi/Chibi";
import { Opening, type OpeningMeta, type ContactLink } from "@/components/home/Opening";
import { NeonSplash } from "@/components/home/NeonSplash";
import { RecentWriting, type WritingItem } from "@/components/home/RecentWriting";
import { NowStrip, type NowItem } from "@/components/home/NowStrip";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return { alternates: localeAlternates("", locale) };
}

/** How many posts the issue carries. */
const POST_COUNT = 4;

/**
 * The cover, and the issue.
 *
 * First paper: the manifesto on a full screen with the person beside it —
 * one line on who he is, the site's one primary control (to /software —
 * what was built is behind that button, so the issue does not list it a
 * second time), and a mono line of where he lives and where to find him.
 * Then the issue itself at the 720px measure: what was written, and what is
 * newest in the rooms the issue does not otherwise reach.
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await pageLocale(params);

  const t = await getTranslations("home");
  const th = await getTranslations("grove");
  const td = await getTranslations("splash");
  const tn = await getTranslations("nav");
  const tl = await getTranslations("lab");

  const [allPosts, allApps, moments] = await Promise.all([
    getPosts(locale),
    getApps(),
    getMoments(),
  ]);
  const releases = await getLatestReleases(allApps.map((app) => app.repo));

  const posts: WritingItem[] = allPosts.slice(0, POST_COUNT).map((post) => ({
    slug: post.slug,
    title: post.title,
    lang: post.isFallback ? htmlLang(post.locale) : undefined,
    date: post.date.replaceAll("-", "."),
    readingTime: t("readingTime", { minutes: post.readingMinutes }),
  }));

  // Now: the newest thing in each room. The newest line on the board by the
  // clock — not the pinned one, which getMoments puts first for the board's
  // own sake, and not one that is only a picture, since the row quotes words;
  // the study that went up last; and the most recent release, which only
  // exists when GitHub answered and dated it.
  const said = newestSaid(moments);
  const study = newestLabEntry();
  let latest: { name: string; release: Release } | undefined;
  for (const app of allApps) {
    const release = app.repo ? releases.get(app.repo) : undefined;
    if (!release?.publishedAt) continue;
    if (!latest || release.publishedAt > latest.release.publishedAt!) {
      latest = { name: app.name, release };
    }
  }
  const now: NowItem[] = [
    ...(said
      ? [
          {
            label: tn("moments"),
            title: said.content,
            // The board is written in Chinese only.
            lang: locale === "zh" ? undefined : htmlLang("zh"),
            stamp: stampInZone(said.postedAt, site.timeZone).time,
            href: "/moments",
          },
        ]
      : []),
    {
      label: tn("lab"),
      title: tl(`items.${study.key}.name`),
      stamp: study.added.replaceAll("-", "."),
      href: `/lab/${study.slug}`,
    },
    ...(latest
      ? [
          {
            label: tn("software"),
            title: `${latest.name} ${latest.release.version}`,
            stamp: stampInZone(latest.release.publishedAt!, site.timeZone).time.slice(0, 10),
            href: latest.release.url,
            external: true,
          },
        ]
      : []),
  ];

  const contacts: ContactLink[] = [
    { label: "GitHub", href: site.social.github, external: true },
    { label: "RSS", href: `/${locale}/rss.xml` },
    ...(site.social.email ? [{ label: "Email", email: site.social.email }] : []),
  ];

  const meta: OpeningMeta[] = [{ label: th("metaPlaceLabel"), value: th("metaPlace") }];

  return (
    <>
      {/* The front door, once per session on a hard landing: the neon over
          the door of fhf's, and the way in through its ring. A sibling of
          <main>, not a child — RouteTransition scales <main> on a reveal,
          and a transformed ancestor would pin this fixed wall to it. */}
      <NeonSplash
        label={td("label")}
        welcome={td("welcome")}
        sign={td("sign")}
        enter={td("enter")}
        enterHint={td("enterHint")}
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
          // The one primary control goes to /software (DESIGN-LOG, 10-03) —
          // back from the lab, where it spent a week. The issue below used to
          // open with the same six apps as cards; with the button pointing at
          // them that section said it twice, and it is gone.
          cta={{ label: th("cta"), href: `/${locale}/software` }}
          meta={meta}
          contactTitle={t("contactTitle")}
          contacts={contacts}
          aboutLink={{ label: t("aboutLink") }}
          avatar={<Chibi label={t("chibiAria")} hint={t("chibiHint")} />}
        />

        {/* The issue itself, at the site's 720px reading measure. */}
        <div
          id="issue"
          className="mx-auto flex w-full max-w-[720px] scroll-mt-24 flex-col gap-20 px-6 pt-8 pb-24 md:gap-24 md:pt-12 md:pb-32"
        >
          <RecentWriting
            items={posts}
            title={t("latestPosts")}
            viewAllLabel={t("viewAllPosts")}
            index="01"
          />
          <NowStrip items={now} title={t("nowTitle")} index="02" />
        </div>
      </main>
    </>
  );
}
