import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { pageLocale } from "@/i18n/page";
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/lib/seo";
import {
  LAB_ENTRIES,
  labEntry,
  labNeighbours,
  sourceUrl,
  type LabEntry,
} from "@/components/lab/entries";
import { GROVE_PALETTE_KEYS, GROVE_PALETTES } from "@/lib/grove/palettes";
import { StudySpec, type SpecRow } from "@/components/lab/StudySpec";
import {
  BLADES_NEAR_WIDE,
  BLADES_NEAR_SMALL,
  BLADES_FAR_WIDE,
  BLADES_FAR_SMALL,
} from "@/lib/grove/geometry";
import { LENS_SLIDES } from "@/components/lab/lensSlides";
import { ODYSSEY_STILLS } from "@/components/films/odysseyStills";
import { LALA_STILLS } from "@/components/films/lalaStills";
import { KOBE_PHOTOS } from "@/components/idols/kobePhotos";
import { LabStudy, type StudyText } from "@/components/lab/LabStudy";
import type { ChangelogEntry } from "@/components/about/Changelog";
import { getPosts, getTimeline } from "@/lib/content";

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
const STUDY_KEYS: Record<LabEntry["key"], string[]> = {
  scrollVideo: [
    "loading",
    "failed",
    "captionOne",
    "captionOneBody",
    "captionTwo",
    "captionTwoBody",
  ],
  dissolve: ["headline", "body", "tail", "fallback", "saveData"],
  meltingText: ["label", "replay", "sample"],
  // The spec table is not here: the page renders it itself, below, and what
  // is listed here is serialized into the study's props.
  grove: [
    "headline",
    "body",
    "tail",
    "fallback",
    "saveData",
    "stageScan",
    "stageGrow",
    "stageSettle",
    "dressLegend",
    // One name per dress, by the message key the palette table carries.
    ...GROVE_PALETTE_KEYS.map((k) => GROVE_PALETTES[k].label),
  ],
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
  workstation: ["deskHint", "turnLeft", "turnRight", "deskSaveData", "deskFallback"],
  lensSlider: [
    "fallback",
    "saveData",
    "counterAria",
    "prev",
    "next",
    ...LENS_SLIDES.flatMap((name) => [`${name}Alt`, `${name}Title`, `${name}Body`, `${name}Meta`]),
  ],
  // The stills' captions and rights line are the La La Land room's, set below.
  neon: ["welcome", "signOn", "galleryKicker", "galleryTitle", "galleryLede", "credit"],
  sideways: ["lead", "lineOne", "lineTwo", "lineThree", "tail"],
  masthead: ["label", "replay", "lineOne", "lineTwo"],
  reveal: ["label", "replay", "itemOne", "itemTwo", "itemThree", "itemFour", "itemFive"],
  headline: ["label", "replay", "title"],
  unmask: ["label", "replay", "title"],
  magnetic: ["label", "weak", "medium", "strong", "reachNote", "touchNote"],
  glint: ["label", "cardKicker", "cardTitle", "cardBody", "touchNote"],
  dieCut: ["label", "sample"],
  stickerWall: ["label", "wallTitle", "wallHint", "wallAria"],
  peel: ["label", "peelHint", "peelAria", "secret"],
  scatter: ["label", "pointerHint", "text", "touchNote"],
  dotName: ["label", "pointerHint", "text", "touchNote"],
  // The kicker carries the study's own ordinal, filled in below.
  approach: ["lede", "title", "linkLabel"],
  segmented: ["label", "ariaLabel", "all", "writing", "software", "lab", "selected", "keyNote"],
  // The two readouts carry the demo's own placeholders; set below, raw.
  reshuffle: [
    "label",
    "lede",
    "filterName",
    "ariaLabel",
    "all",
    "round",
    "square",
    "line",
    "motionName",
    "motionAria",
    "motionSite",
    "motionSlow",
    "motionNone",
    "readoutIdle",
    "gridNote",
  ],
  // The shell, one piece per study; the hrefs and the share title are set below.
  lights: ["label", "body"],
  readingChip: ["label", "body"],
  radialFan: ["label", "body"],
  overture: ["label", "body", "action", "reducedNote"],
  door: ["label", "body", "action"],
  veil: ["label", "body", "action"],
  island: ["label", "body"],
  // The stage's own labels are the idols room's, set below.
  statue: [
    "label",
    "lede",
    "viewName",
    "viewAria",
    "viewBronze",
    "viewWire",
    "frameLabel",
    "stateDrawing",
    "stateIdle",
    "frameNote",
  ],
  changelog: ["lede"],
  screening: ["lede"],
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
  for (const key of STUDY_KEYS[entry.key]) {
    text[key] = t(`${ns}.${key}`);
  }
  let entries: ChangelogEntry[] | undefined;

  // The two cards standing in the approach are the home page's: the same
  // copy, and the plate in front is whatever was written last.
  if (entry.slug === "approach") {
    const tg = await getTranslations("grove");
    const latest = (await getPosts(locale))[0];
    Object.assign(text, {
      kicker: t(`${ns}.kicker`, { ordinal: entry.ordinal }),
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
      linkHref: `/${locale}/lab/grove`,
    });
  }

  // The screening room hangs the 大话西游 room's stills, and the neon sign
  // hangs the La La Land room's, so they read those rooms' copy
  // — the same captions and, importantly, the same rights line. Duplicating a
  // credit is how two copies of it end up disagreeing.
  if (entry.slug === "screening") {
    const to = await getTranslations("films.odyssey");
    for (const still of ODYSSEY_STILLS) {
      text[`${still.id}Title`] = to(`stills.${still.id}.title`);
      text[`${still.id}Meta`] = to(`stills.${still.id}.meta`);
      text[`${still.id}Alt`] = to(`stills.${still.id}.alt`);
    }
    text.credit = to("credit");
    const tf = await getTranslations("films");
    Object.assign(text, {
      open: tf("viewer.open"),
      close: tf("viewer.close"),
      prev: tf("viewer.prev"),
      next: tf("viewer.next"),
      // Raw: the placeholders are the viewer's to fill, not ICU's.
      counter: tf.raw("viewer.counter"),
      viewerHint: tf("viewer.hint"),
    });
  }
  if (entry.slug === "neon") {
    const tl = await getTranslations("films.lala");
    for (const still of LALA_STILLS) {
      text[`${still.id}Title`] = tl(`stills.${still.id}.title`);
      text[`${still.id}Meta`] = tl(`stills.${still.id}.meta`);
      text[`${still.id}Alt`] = tl(`stills.${still.id}.alt`);
    }
    // The sign keeps its own credit (the lettering's); the stills' is the room's.
    text.stillsCredit = tl("credit");
  }

  // The statue reads its own room's labels, and the photograph that stands
  // in for it is the same one that does on /idols/kobe.
  if (entry.slug === "statue") {
    const tk = await getTranslations("idols.kobe");
    const cover = KOBE_PHOTOS[0]!;
    Object.assign(text, {
      dragHint: tk("statueHint"),
      loading: tk("loading"),
      fallback: tk("statueFallback"),
      coverAlt: tk(`photos.${cover.id}.alt`),
      turnLeft: tk("turnLeft"),
      turnRight: tk("turnRight"),
      credit: tk("credit"),
    });
  }

  // Raw: the counts are the demo's to fill after each click, not ICU's.
  if (entry.slug === "reshuffle") {
    text.readout = t.raw(`${ns}.readout`);
    text.readoutNone = t.raw(`${ns}.readoutNone`);
  }

  // The door lands on the cover again, and the fan shares this page under
  // its own name.
  if (entry.slug === "door") text.homeHref = `/${locale}`;
  if (entry.slug === "radial-fan") text.shareTitle = t(`${ns}.name`);

  // The changelog shows the real one: the same rows /about localizes.
  if (entry.slug === "changelog") {
    const ta = await getTranslations("about");
    text.title = ta("changelogTitle");
    text.ariaLabel = ta("changelogAria");
    entries = (await getTimeline()).map((row) => {
      const dateText = row.date ?? row.dateLabel?.[locale] ?? "—";
      return {
        id: row.key,
        version: row.version,
        dateText,
        year: row.date ? row.date.slice(0, 4) : "—",
        dateAria: ta("changelogDot", { date: dateText }),
        title: row.title[locale],
        note: row.note[locale],
      };
    });
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

  /** The studies whose pictures carry a rights line. */
  const credit =
    entry.slug === "workstation"
      ? t(`${ns}.credit`)
      : entry.slug === "screening" || entry.slug === "statue"
        ? text.credit
        : null;

  const { prev, next } = labNeighbours(entry.slug);

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
        {/* The demo's own file, up front; every file it touches is listed at
            the foot. Plain <a>: an external address. `lab.test.ts` proves
            every study names at least one source. */}
        <a
          href={sourceUrl(entry.sources[0]!)}
          target="_blank"
          rel="noreferrer"
          className="hit-ext mt-5 inline-flex min-h-11 items-center gap-1.5 font-mono text-meta uppercase tracking-meta text-fg-tertiary transition-colors hover:text-accent"
        >
          {t("viewSource")}
          <span aria-hidden="true">↗</span>
        </a>
      </header>

      <LabStudy slug={entry.slug} accent={entry.accent} text={text} entries={entries} />

      <section className="mx-auto w-full max-w-[720px] px-6 pb-28 pt-20">
        <p className="text-body text-fg-secondary">{t(`${ns}.note`)}</p>
        {credit && <p className="mt-4 font-mono text-meta text-fg-tertiary">{credit}</p>}

        {spec && <StudySpec title={t(`${ns}.specTitle`)} rows={spec} />}

        {/* The files this study is made of, each a link to the repository.
            Plain <a>: an external address, which RouteTransition lets
            through on its own. */}
        <section className="mt-12" aria-labelledby="study-source">
          <h2
            id="study-source"
            className="font-mono text-meta uppercase tracking-meta text-fg-tertiary"
          >
            {t("source")}
          </h2>
          <p className="mt-3 text-caption text-fg-secondary">{t("sourceLede")}</p>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {entry.sources.map((path) => (
              <li key={path}>
                <a
                  href={sourceUrl(path)}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex min-h-11 items-center justify-between gap-4 py-2.5 font-mono text-caption text-fg transition-colors hover:text-accent"
                >
                  <span className="min-w-0 break-all">src/{path}</span>
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-fg-tertiary transition-colors group-hover:text-accent"
                  >
                    ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* The studies either side, in the index's order — ordinal and name —
            so the series reads through without a trip back to the index. */}
        <nav
          aria-label={t("studyNav")}
          className="mt-12 grid grid-cols-2 gap-6 border-y border-line"
        >
          {prev ? (
            <Neighbour
              entry={prev}
              label={t("prev")}
              name={t(`items.${prev.key}.name`)}
              side="prev"
            />
          ) : (
            <span aria-hidden="true" />
          )}
          {next ? (
            <Neighbour
              entry={next}
              label={t("next")}
              name={t(`items.${next.key}.name`)}
              side="next"
            />
          ) : (
            <span aria-hidden="true" />
          )}
        </nav>

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

/** One neighbour of the study — its ordinal and name, set to its own side. */
function Neighbour({
  entry,
  label,
  name,
  side,
}: {
  entry: LabEntry;
  label: string;
  name: string;
  side: "prev" | "next";
}) {
  const end = side === "next";
  return (
    <Link
      href={`/lab/${entry.slug}`}
      className={`group flex min-h-11 flex-col gap-1.5 py-5${end ? " items-end text-right" : ""}`}
    >
      <span className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
        {!end && <span aria-hidden="true">← </span>}
        {label} · {entry.ordinal}
        {end && <span aria-hidden="true"> →</span>}
      </span>
      <span className="text-body text-fg transition-colors group-hover:text-accent">{name}</span>
    </Link>
  );
}
