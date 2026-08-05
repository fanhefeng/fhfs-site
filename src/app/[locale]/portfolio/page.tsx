import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getApps, getExperiments, getWorks } from "@/lib/content";
import { localeAlternates } from "@/lib/seo";
import { WorkCard } from "@/components/cards/WorkCard";
import { BentoHero, type BentoItem } from "@/components/portfolio/BentoHero";
import { CraftList, type CraftEntry } from "@/components/portfolio/CraftList";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "portfolio" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: localeAlternates("/portfolio", locale),
  };
}

/**
 * Fallback cover tints, for an app saved without an accent of its own. There
 * are no screenshots in the repo, so a cover is colour + monogram + name —
 * deliberately editorial rather than a fake device mockup. Muted gallery
 * hues: every one of them reads on paper and after hours.
 *
 * The per-app colour used to live here as a lookup table keyed by file name,
 * while the software page derived a different one from list position — so the
 * same app wore two colours depending on which page you were on. It is one
 * stored column now.
 */
const ACCENT_CYCLE = ["#b45309", "#3e6d93", "#6b5ba8", "#4c7a5b", "#a8465f", "#2f6f72"];

/** "Photo Browser" → "PB", "Lumitext" → "Lu". */
function monogramOf(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length > 1) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2);
}

/** Fallback dot colour for an experiment saved without one. */
const CRAFT_ACCENT = "#4c7a5b";

export default async function PortfolioPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("portfolio");
  const l = locale as Locale;

  const works = await getWorks();

  // Name, sentence, status and colour arrive as one record now — the craft log
  // used to be a constant here plus two message keys per language.
  const craft: CraftEntry[] = (await getExperiments()).map((entry) => ({
    id: entry.key,
    name: entry.name[l],
    description: entry.description[l],
    status: entry.status,
    accent: entry.accent ?? CRAFT_ACCENT,
    href: entry.href ?? undefined,
    demo: entry.demo === "liquid-lens" ? "liquid-lens" : undefined,
  }));

  // The collage reuses the software data — one wall, two ways in.
  const covers: BentoItem[] = (await getApps()).map((app, i) => {
    return {
      id: app.key,
      name: app.name,
      kicker: app.platforms[0] ?? app.category,
      monogram: monogramOf(app.name),
      accent: app.accent ?? ACCENT_CYCLE[i % ACCENT_CYCLE.length],
      href: "/software",
      label: t("coverLabel", { name: app.name }),
    };
  });

  return (
    <main className="flex-1 pb-24">
      <header className="mx-auto w-full max-w-[680px] px-6 pt-24 pb-8">
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {t("kicker")}
        </p>
        <h1 className="mt-3 text-display-sm">{t("title")}</h1>
        <p className="mt-4 text-body text-fg-secondary">{t("subtitle")}</p>
      </header>

      <BentoHero
        items={covers}
        ariaLabel={t("galleryAria")}
        hint={t("scrollHint")}
      />

      {works.length === 0 ? (
        /* Nothing in the works collection yet: say so plainly and point at
           the wall that *is* hung. */
        <section className="mx-auto w-full max-w-[680px] px-6 pt-10">
          <div className="rounded-panel glass-thick p-8 text-center">
            <h2 className="text-title vibrancy">{t("emptyTitle")}</h2>
            <p className="mx-auto mt-3 max-w-[46ch] text-body text-fg-secondary">
              {t("empty")}
            </p>
            <Link
              href="/software"
              className="hit-ext mt-6 inline-flex min-h-11 items-center gap-2 rounded-chip border border-line px-4 py-2.5 text-caption text-fg transition-colors hover:border-accent hover:text-accent"
            >
              {t("emptyCta")}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      ) : (
        <section className="mx-auto w-full max-w-5xl px-6 pt-10">
          <h2 className="text-title">{t("worksTitle")}</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {works.map((work, i) => (
              <WorkCard
                key={work.key}
                work={work}
                locale={l}
                accent={ACCENT_CYCLE[i % ACCENT_CYCLE.length]}
              />
            ))}
          </div>
        </section>
      )}

      <div className="mx-auto w-full max-w-[680px] px-6 pt-20">
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
