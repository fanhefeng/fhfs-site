import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/lib/seo";
import { LAB_ENTRIES, labEntry } from "@/components/lab/entries";
import { ScrollVideoDemo } from "@/components/lab/ScrollVideoDemo";
import { DissolveDemo } from "@/components/lab/DissolveDemo";
import { MeltingTextDemo } from "@/components/lab/MeltingTextDemo";
import { GroveDemo } from "@/components/lab/GroveDemo";
import { LiquidMetalDemo } from "@/components/lab/LiquidMetalDemo";

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
 * One study per route. The page stays a Server Component and hands each demo
 * its already-translated strings — the client islands below carry GSAP and
 * (for the dissolve) three.js, and none of that is loaded by the lab index or
 * by any other page.
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

  return (
    <main className="flex-1">
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

      {entry.slug === "scroll-video" && (
        <ScrollVideoDemo
          accent={entry.accent}
          hint={t("hint")}
          loading={t(`${ns}.loading`)}
          captionOne={t(`${ns}.captionOne`)}
          captionOneBody={t(`${ns}.captionOneBody`)}
          captionTwo={t(`${ns}.captionTwo`)}
          captionTwoBody={t(`${ns}.captionTwoBody`)}
        />
      )}

      {entry.slug === "dissolve" && (
        <DissolveDemo
          accent={entry.accent}
          hint={t("hint")}
          headline={t(`${ns}.headline`)}
          body={t(`${ns}.body`)}
          tail={t(`${ns}.tail`)}
          fallbackNote={t(`${ns}.fallback`)}
        />
      )}

      {entry.slug === "melting-text" && (
        <MeltingTextDemo
          accent={entry.accent}
          sampleOne={t(`${ns}.sampleOne`)}
          sampleTwo={t(`${ns}.sampleTwo`)}
          sampleThree={t(`${ns}.sampleThree`)}
          labelLoad={t(`${ns}.labelLoad`)}
          labelInView={t(`${ns}.labelInView`)}
          labelScrub={t(`${ns}.labelScrub`)}
        />
      )}

      {entry.slug === "grove" && (
        <GroveDemo
          accent={entry.accent}
          hint={t("hint")}
          headline={t(`${ns}.headline`)}
          body={t(`${ns}.body`)}
          tail={t(`${ns}.tail`)}
          fallbackNote={t(`${ns}.fallback`)}
          stageScan={t(`${ns}.stageScan`)}
          stageGrow={t(`${ns}.stageGrow`)}
          stageSettle={t(`${ns}.stageSettle`)}
        />
      )}

      {entry.slug === "liquid-metal" && (
        <LiquidMetalDemo
          accent={entry.accent}
          hint={t("hint")}
          headline={t(`${ns}.headline`)}
          body={t(`${ns}.body`)}
          tail={t(`${ns}.tail`)}
          fallbackNote={t(`${ns}.fallback`)}
          label={t(`${ns}.label`)}
          stageField={t(`${ns}.stageField`)}
          stageMolten={t(`${ns}.stageMolten`)}
          stageBloom={t(`${ns}.stageBloom`)}
        />
      )}

      <section className="mx-auto w-full max-w-[680px] px-6 pb-28 pt-20">
        <p className="text-body text-fg-secondary">{t(`${ns}.note`)}</p>
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
