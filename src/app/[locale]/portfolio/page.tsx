import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getApps, getExperiments, getWorks } from "@/lib/content";
import { sectionMetadata } from "@/lib/seo";
import { WorkCard } from "@/components/cards/WorkCard";
import { DissolveHero } from "@/components/portfolio/DissolveHero";
import { CraftList, type CraftEntry } from "@/components/portfolio/CraftList";
import { DeviceShowcase } from "@/components/software/DeviceShowcase";
import { toSoftwareApp } from "@/components/software/appMeta";
import { Reveal } from "@/components/fx/Reveal";

export const generateMetadata = sectionMetadata("portfolio", "/portfolio");

/**
 * Fallback cover tints, for a work saved without an accent of its own —
 * muted gallery hues that read on paper and after hours.
 */
const ACCENT_CYCLE = ["#b45309", "#3e6d93", "#6b5ba8", "#4c7a5b", "#a8465f", "#2f6f72"];

/** Fallback dot colour for an experiment saved without one. */
const CRAFT_ACCENT = "#4c7a5b";

/**
 * The cover of the portfolio. A photograph of a lamp left on in a dark room
 * (Sixteen Miles Out, Unsplash License) — the site's own line, taken
 * literally — that scrolling dissolves into the page.
 */
const COVER = "/portfolio/lamp.jpg";

/**
 * Craft — three acts. The cover: a photograph that scrolling turns into the
 * page (the lab's dissolve, brought home). Then the apps framed on a Mac and
 * an iPhone, one channel at a time. Then the craft log: one line per motion
 * study built into this site. Works hang between the first two acts once
 * there are any; until then that wall is simply not there.
 */
export default async function PortfolioPage({ params }: PageProps<"/[locale]/portfolio">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("portfolio");
  const ts = await getTranslations("software");

  const [works, experiments, apps] = await Promise.all([
    getWorks(),
    getExperiments(),
    getApps(),
  ]);

  const craft: CraftEntry[] = experiments.map((entry) => ({
    id: entry.key,
    name: entry.name[locale],
    description: entry.description[locale],
    status: entry.status,
    accent: entry.accent ?? CRAFT_ACCENT,
    href: entry.href ?? undefined,
    demo: entry.demo === "liquid-lens" ? "liquid-lens" : undefined,
  }));

  const softwareApps = apps.map((app, i) => toSoftwareApp(app, i, locale));

  return (
    <main id="main" className="flex-1 pb-24">
      <DissolveHero
        src={COVER}
        alt={t("coverAlt")}
        kicker={t("kicker")}
        headline={t("title")}
        body={t("subtitle")}
        tail={t("heroTail")}
        hint={t("scrollHint")}
        fallbackNote={t("heroFallback")}
      />

      {works.length > 0 && (
        <Reveal as="section" className="mx-auto w-full max-w-5xl px-6 pt-24">
          <h2 className="text-title">{t("worksTitle")}</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {works.map((work, i) => (
              <WorkCard
                key={work.key}
                work={work}
                locale={locale}
                accent={work.accent ?? ACCENT_CYCLE[i % ACCENT_CYCLE.length]}
              />
            ))}
          </div>
        </Reveal>
      )}

      {softwareApps.length > 0 && (
        <Reveal as="section" className="mx-auto w-full max-w-5xl px-6 pt-24">
          <div className="mb-8 max-w-[42rem]">
            <h2 className="text-title text-fg">{ts("deviceTitle")}</h2>
            <p className="mt-3 text-body text-fg-secondary">{ts("deviceSub")}</p>
          </div>
          <DeviceShowcase apps={softwareApps} />
        </Reveal>
      )}

      <div className="mx-auto w-full max-w-[680px] px-6 pt-24">
        <CraftList
          entries={craft}
          title={t("experimentsTitle")}
          subtitle={t("experimentsSub")}
          lensLinkHref={`/${locale}/software`}
        />
      </div>
    </main>
  );
}
