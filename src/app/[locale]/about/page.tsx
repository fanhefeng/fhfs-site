import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { site } from "@/config/site";
import { getAbout, getTimeline } from "@/lib/content";
import { localeAlternates } from "@/lib/seo";
import { Mdx } from "@/components/blog/Mdx";
import { Workstation } from "@/components/about/Workstation";
import { StickerWall } from "@/components/about/StickerWall";
import { Changelog, type ChangelogEntry } from "@/components/about/Changelog";
import { Colophon } from "@/components/about/Colophon";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "about" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: localeAlternates("/about", locale),
  };
}

/**
 * About — the narrow column (720px): a name, the desk, the essay, a wall of
 * stickers you can throw around, and a life numbered like software.
 * Everything interactive lives in its own client component; this file stays
 * a Server Component that only reads content and localizes it.
 */
export default async function AboutPage({
  params,
}: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("about");
  const about = getAbout(locale);

  // Localize the changelog here so the client component ships plain strings.
  // An entry without a real `date` shows its placeholder label instead — the
  // page never invents a date it cannot source.
  const entries: ChangelogEntry[] = getTimeline().map((entry) => {
    const dateText = entry.date ?? entry.dateLabel?.[locale] ?? "—";
    return {
      id: entry._meta.path,
      version: entry.version,
      dateText,
      year: entry.date ? entry.date.slice(0, 4) : "—",
      dateAria: t("changelogDot", { date: dateText }),
      title: entry.title[locale],
      note: entry.note[locale],
    };
  });

  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-6 pb-24 pt-24 sm:pt-32">
      <header>
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {t("title")}
        </p>
        <h1 className="mt-5 text-display-sm">{site.author}</h1>
        <p className="mt-4 font-serif text-title italic leading-tight text-fg-secondary">
          {t("keywords")}
        </p>
        <p className="mt-6 max-w-[46ch] text-body text-fg-secondary">
          {t("lead")}
        </p>
      </header>

      {/* The 3D desk, kept from the old portfolio. Loads only when scrolled
          near, and holds a single still frame under reduced motion. */}
      <Workstation hint={t("deskHint")} className="mt-16" />

      {about && <Mdx code={about.mdx} />}

      <StickerWall
        locale={locale}
        title={t("stickersTitle")}
        hint={t("stickersHint")}
        ariaLabel={t("stickersAria")}
        className="mt-20"
      />

      <Changelog
        entries={entries}
        title={t("changelogTitle")}
        ariaLabel={t("changelogAria")}
        className="mt-24"
      />

      <Colophon className="mt-24" />
    </main>
  );
}
