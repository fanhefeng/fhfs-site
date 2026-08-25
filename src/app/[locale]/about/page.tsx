import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { site } from "@/config/site";
import { getAbout, getChips, getTimeline } from "@/lib/content";
import { sectionMetadata } from "@/lib/seo";
import { Mdx } from "@/components/blog/Mdx";
import { DotDoodle } from "@/components/fx/DotDoodle";
import { ManifestoBand } from "@/components/home/ManifestoBand";
import { StickerWall } from "@/components/about/StickerWall";
import { Changelog, type ChangelogEntry } from "@/components/about/Changelog";
import { Colophon } from "@/components/about/Colophon";

export const generateMetadata = sectionMetadata("about", "/about");

/**
 * About — a name, the slogan crossing the screen, the essay, a wall of
 * stickers you can throw around, and a life numbered like software.
 * Everything interactive lives in its own client component; this file stays
 * a Server Component that only reads content and localizes it. The band is
 * the site's one pinned section — it used to open the home page, and moved
 * here when the grove took the cover. The 3D desk that used to sit under the
 * name is a lab study now (/lab/workstation).
 */
export default async function AboutPage({
  params,
}: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("about");
  const about = await getAbout(locale);

  // Resolved to one language here so the wall — a client island — never sees
  // a `{zh,en}` pair it has no use for.
  const chips = (await getChips()).map((chip) => ({
    label: chip.label[locale],
    tone: chip.tone,
  }));

  // Localize the changelog here so the client component ships plain strings.
  // An entry without a real `date` shows its placeholder label instead — the
  // page never invents a date it cannot source.
  const entries: ChangelogEntry[] = (await getTimeline()).map((entry) => {
    const dateText = entry.date ?? entry.dateLabel?.[locale] ?? "—";
    return {
      id: entry.key,
      version: entry.version,
      dateText,
      year: entry.date ? entry.date.slice(0, 4) : "—",
      dateAria: t("changelogDot", { date: dateText }),
      title: entry.title[locale],
      note: entry.note[locale],
    };
  });

  const column = "mx-auto w-full max-w-[720px] px-6";

  return (
    <main id="main" className="flex-1 pb-24">
      <header className={`${column} pt-24 sm:pt-32`}>
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {t("title")}
        </p>
        {/* The name, set in a dot matrix that keeps it half-hidden until you
            point at it. The heading still *is* the name for anything that
            reads the page — the canvas is decoration layered over it. */}
        <h1 className="mt-5">
          <DotDoodle text={site.author} className="h-[clamp(3rem,13vw,5rem)]" />
          <span className="sr-only">{site.author}</span>
        </h1>
        <p className="no-cjk-oblique mt-4 font-serif text-title italic leading-tight text-fg-secondary">
          {t("keywords")}
        </p>
        <p className="mt-6 max-w-[46ch] text-body text-fg-secondary">
          {t("lead")}
        </p>

        {/* The same person, told the other way round — a head you scroll
            around instead of a column you read. */}
        <Link
          href="/intro"
          className="hit-ext mt-7 inline-flex min-h-11 items-center gap-2 rounded-chip border border-line px-4 py-2.5 text-caption text-fg transition-colors hover:border-accent hover:text-accent"
        >
          <span className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
            {t("introTitle")}
          </span>
          {t("introLink")} →
        </Link>
      </header>

      {/* Full-bleed: the band writes its own 100vw stage on desktop. */}
      <ManifestoBand />

      <div className={column}>
        {about && <Mdx html={about.html} />}

        <StickerWall
          chips={chips}
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
      </div>
    </main>
  );
}
