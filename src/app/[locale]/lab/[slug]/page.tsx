import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/lib/seo";
import { LAB_ENTRIES, labEntry } from "@/components/lab/entries";
import { LabStudy, type StudyText } from "@/components/lab/LabStudy";

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
  grove: ["headline", "body", "tail", "fallback", "stageScan", "stageGrow", "stageSettle"],
  liquidMetal: ["headline", "body", "tail", "fallback", "label", "stageField", "stageMolten", "stageBloom"],
  workstation: ["deskHint"],
};

/**
 * One study per route. The page stays a Server Component and hands the study
 * its already-translated strings; the study itself is loaded on the client,
 * as its own chunk, by `LabStudy`.
 */
export default async function LabDemoPage({
  params,
}: PageProps<"/[locale]/lab/[slug]">) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const entry = labEntry(slug);
  if (!entry) notFound();
  const t = await getTranslations("lab");

  const ns = `items.${entry.key}` as const;
  const text: StudyText = { hint: t("hint") };
  for (const key of STUDY_KEYS[entry.key] ?? []) {
    text[key] = t(`${ns}.${key}`);
  }

  return (
    <main id="main" className="flex-1">
      <header className="mx-auto w-full max-w-[680px] px-6 pt-24 pb-10">
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

      <section className="mx-auto w-full max-w-[680px] px-6 pb-28 pt-20">
        <p className="text-body text-fg-secondary">{t(`${ns}.note`)}</p>
        {entry.slug === "workstation" && (
          <p className="mt-4 font-mono text-meta text-fg-tertiary">
            {t(`${ns}.credit`)}
          </p>
        )}
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
