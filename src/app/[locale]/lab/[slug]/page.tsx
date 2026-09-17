import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { pageLocale } from "@/i18n/page";
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/lib/seo";
import { LAB_ENTRIES, labEntry } from "@/components/lab/entries";
import { GROVE_PALETTE_KEYS, GROVE_PALETTES } from "@/lib/grove/palettes";
import { StudySpec, type SpecRow } from "@/components/lab/StudySpec";
import {
  BLADES_NEAR_WIDE,
  BLADES_NEAR_SMALL,
  BLADES_FAR_WIDE,
  BLADES_FAR_SMALL,
} from "@/lib/grove/geometry";
import { LENS_SLIDES } from "@/components/lab/lensSlides";
import { NEON_STILLS } from "@/components/lab/neonStills";
import { ODYSSEY_STILLS } from "@/components/films/odysseyStills";
import { LabStudy, type StudyText } from "@/components/lab/LabStudy";
import { getPosts } from "@/lib/content";

/** A fixed set of studies — the whole list is known at build time. */
export const dynamicParams = false;

export function generateStaticParams() {
  return LAB_ENTRIES.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/lab/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const entry = labEntry(slug);
  if (!entry) return {};
  const t = await getTranslations({ locale, namespace: "lab" });
  return {
    title: t(`items.${entry.key}.name`),
    description: t(`items.${entry.key}.summary`),
    alternates: localeAlternates(`/lab/${slug}`, locale),
  };
}

/**
 * The strings each study reads, by message key under `lab.items.<key>`. The
 * page translates exactly these and hands them across as plain text, so the
 * client chunk carries no catalogue and no study ever asks for a key that is
 * not in the file.
 */
const STUDY_KEYS: Record<string, string[]> = {
  scrollVideo: ["loading", "captionOne", "captionOneBody", "captionTwo", "captionTwoBody"],
  dissolve: ["headline", "body", "tail", "fallback"],
  meltingText: ["sampleOne", "sampleTwo", "sampleThree", "labelLoad", "labelInView", "labelScrub"],
  grove: [
    "headline",
    "body",
    "tail",
    "fallback",
    "stageScan",
    "stageGrow",
    "stageSettle",
    "dressLegend",
    "specTitle",
    "specRuntime",
    "specRuntimeValue",
    "specPasses",
    "specPassesValue",
    "specAssets",
    "specAssetsValue",
    "specGeometry",
    "specPixelRatio",
    "specPixelRatioValue",
    "specFallback",
    "specFallbackValue",
    "specVariants",
    // One name per dress, by the message key the palette table carries.
    ...GROVE_PALETTE_KEYS.map((k) => GROVE_PALETTES[k].label),
  ],
  groveStage: ["pointerHint", "fallback"],
  album: ["hint", "prev", "next", "counterAria"],
  liquidMetal: [
    "headline",
    "body",
    "tail",
    "fallback",
    "label",
    "stageField",
    "stageMolten",
    "stageBloom",
  ],
  workstation: ["deskHint"],
  lensSlider: [
    "fallback",
    "counterAria",
    "prev",
    "next",
    ...LENS_SLIDES.flatMap((name) => [`${name}Alt`, `${name}Title`, `${name}Body`, `${name}Meta`]),
  ],
  neon: [
    "welcome",
    "signOn",
    "signOff",
    "galleryKicker",
    "galleryTitle",
    "galleryLede",
    "credit",
    ...NEON_STILLS.flatMap((still) => [`${still.id}Title`, `${still.id}Meta`, `${still.id}Alt`]),
  ],
};

/**
 * One study per route. The page stays a Server Component and hands the study
 * its already-translated strings; the study itself is loaded on the client,
 * as its own chunk, by `LabStudy`.
 */
export default async function LabDemoPage({ params }: PageProps<"/[locale]/lab/[slug]">) {
  const locale = await pageLocale(params);
  const { slug } = await params;
  const entry = labEntry(slug);
  if (!entry) notFound();
  const t = await getTranslations("lab");

  const ns = `items.${entry.key}` as const;
  const text: StudyText = { hint: t("hint") };
  for (const key of STUDY_KEYS[entry.key] ?? []) {
    text[key] = t(`${ns}.${key}`);
  }

  // The two cards standing in the stage study are the home page's: the same
  // copy, and the plate in front is whatever was written last.
  if (entry.slug === "grove-stage") {
    const tg = await getTranslations("grove");
    const latest = (await getPosts(locale))[0];
    Object.assign(text, {
      cardALabel: tg("cardLabLabel"),
      cardATitle: tg("cardLabTitle"),
      cardAHref: `/${locale}/lab/grove`,
      cardAAlt: tg("cardLabAlt"),
      cardALink: tg("cardLabLink"),
      cardBLabel: tg("cardPostLabel"),
      cardBTitle: latest?.title ?? tg("cardPostFallback"),
      cardBHref: latest ? `/${locale}/blog/${latest.slug}` : `/${locale}/blog`,
      cardBAlt: tg("cardPostAlt"),
      cardBLink: tg("cardPostLink"),
    });
  }

  // The album binds the 大话西游 room's stills, so it reads that room's copy —
  // the same captions and, importantly, the same rights line. Duplicating a
  // credit is how two copies of it end up disagreeing.
  if (entry.slug === "album") {
    const to = await getTranslations("films.odyssey");
    for (const still of ODYSSEY_STILLS) {
      text[`${still.id}Title`] = to(`stills.${still.id}.title`);
      text[`${still.id}Meta`] = to(`stills.${still.id}.meta`);
      text[`${still.id}Alt`] = to(`stills.${still.id}.alt`);
    }
    text.credit = to("credit");
  }

  /**
   * The spec table, for the studies that have one. Only the grove so far.
   *
   * The blade count and the number of dresses are read from the modules that
   * define them, not typed into the catalogue: those are exactly the two
   * numbers that change when the scene does, and a table that quietly goes
   * stale is worse than no table.
   */
  const spec: SpecRow[] | null =
    entry.slug === "grove"
      ? [
          { label: t(`${ns}.specRuntime`), value: t(`${ns}.specRuntimeValue`) },
          { label: t(`${ns}.specPasses`), value: t(`${ns}.specPassesValue`) },
          { label: t(`${ns}.specAssets`), value: t(`${ns}.specAssetsValue`) },
          {
            label: t(`${ns}.specGeometry`),
            value: t(`${ns}.specGeometryValue`, {
              blades: BLADES_NEAR_WIDE + BLADES_FAR_WIDE,
              bladesSmall: BLADES_NEAR_SMALL + BLADES_FAR_SMALL,
            }),
          },
          {
            label: t(`${ns}.specVariants`),
            value: t(`${ns}.specVariantsValue`, { count: GROVE_PALETTE_KEYS.length }),
          },
          { label: t(`${ns}.specPixelRatio`), value: t(`${ns}.specPixelRatioValue`) },
          { label: t(`${ns}.specFallback`), value: t(`${ns}.specFallbackValue`) },
        ]
      : null;

  return (
    <main id="main" className="flex-1">
      <header className="mx-auto w-full max-w-[720px] px-6 pt-24 pb-10">
        <Link
          href="/lab"
          className="hit-ext inline-flex min-h-11 items-center font-mono text-meta uppercase tracking-meta text-fg-tertiary transition-colors hover:text-accent"
        >
          {t("backToIndex")}
        </Link>
        <p className="mt-6 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {t(`${ns}.tagline`)}
        </p>
        <h1 className="mt-3 text-display-sm text-fg">{t(`${ns}.name`)}</h1>
        <p className="mt-4 text-body text-fg-secondary">{t(`${ns}.summary`)}</p>
      </header>

      <LabStudy slug={entry.slug} accent={entry.accent} text={text} />

      <section className="mx-auto w-full max-w-[720px] px-6 pb-28 pt-20">
        <p className="text-body text-fg-secondary">{t(`${ns}.note`)}</p>
        {entry.slug === "workstation" && (
          <p className="mt-4 font-mono text-meta text-fg-tertiary">{t(`${ns}.credit`)}</p>
        )}

        {spec && <StudySpec title={t(`${ns}.specTitle`)} rows={spec} />}
        <Link
          href="/lab"
          className="hit-ext mt-8 inline-flex min-h-11 items-center gap-2 rounded-chip border border-line px-4 py-2.5 text-caption text-fg transition-colors hover:border-accent hover:text-accent"
        >
          {t("back")}
          <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}
