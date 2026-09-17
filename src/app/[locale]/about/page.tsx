import { getFormatter, getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page";
import { Link } from "@/i18n/navigation";
import { site } from "@/config/site";
import {
  getAbout,
  getAllNavItems,
  getChips,
  getIntroNodes,
  getResumeExperiences,
  getResumeProfile,
  getTimeline,
} from "@/lib/content";
import { sectionMetadata } from "@/lib/seo";
import { Mdx } from "@/components/blog/Mdx";
import { DotDoodle } from "@/components/fx/DotDoodle";
import { Reveal } from "@/components/fx/Reveal";
import { ManifestoBand } from "@/components/home/ManifestoBand";
import { StickerWall } from "@/components/about/StickerWall";
import { Changelog, type ChangelogEntry } from "@/components/about/Changelog";
import { Colophon } from "@/components/about/Colophon";

export const generateMetadata = sectionMetadata("about", "/about");

/**
 * About — a name, the slogan crossing the screen, the essay, the other two
 * pages about the same person, a wall of stickers you can throw around, and a
 * life numbered like software.
 *
 * 关于 is the author's whole section, the way 生活 is the rooms': the two
 * pages that are also about me — the 3D intro and the résumé — hang off it
 * rather than standing beside it in the island, and the index below the essay
 * is where a reader finds them. It reads the nav table for that (`me`, minus
 * whatever the island carries itself), so a page added to the group lists
 * itself here.
 *
 * Everything interactive lives in its own client component; this file stays
 * a Server Component that only reads content and localizes it. The band is
 * the site's one pinned section — it used to open the home page, and moved
 * here when the grove took the cover. The 3D desk that used to sit under the
 * name is a lab study now (/lab/workstation).
 */
export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const locale = await pageLocale(params);

  const t = await getTranslations("about");
  const tNav = await getTranslations("nav");
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

  // The rest of the section: the pages under 关于 that the island does not
  // carry itself, in the table's own order, each with something countable to
  // show for itself.
  const [navRows, introNodes, experiences, profile, format] = await Promise.all([
    getAllNavItems(),
    getIntroNodes(),
    getResumeExperiences(),
    getResumeProfile(),
    getFormatter(),
  ]);
  const meRows = navRows.filter((row) => row.group === "me" && !row.surfaces.includes("header"));
  const meMeta = (href: string): string[] => {
    switch (href) {
      case "/intro":
        return [t("meStops", { count: introNodes.length })];
      case "/resume":
        if (!profile) return [];
        return [
          t("meRoles", { count: experiences.length }),
          t("meUpdated", {
            date: format.dateTime(new Date(profile.updatedAt), {
              year: "numeric",
              month: "long",
            }),
          }),
        ];
      default:
        return [];
    }
  };

  const column = "mx-auto w-full max-w-[720px] px-6";

  return (
    <main id="main" className="flex-1 pb-24">
      <header className={`${column} pt-24 sm:pt-32`}>
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">{t("title")}</p>
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
        <p className="mt-6 max-w-[46ch] text-body text-fg-secondary">{t("lead")}</p>
      </header>

      {/* Full-bleed: the band writes its own 100vw stage on desktop. */}
      <ManifestoBand />

      <div className={column}>
        {about && <Mdx html={about.html} />}

        {/* The rest of 关于: the same person, told two other ways. */}
        {meRows.length > 0 && (
          <section aria-labelledby="about-me" className="mt-24">
            <Reveal className="mb-8">
              <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                {t("meKicker")}
              </p>
              <h2 id="about-me" className="mt-3 text-title">
                {t("meTitle")}
              </h2>
            </Reveal>
            <Reveal as="ol" role="list" stagger={0.06} className="border-t border-line">
              {meRows.map((row, i) => {
                const meta = meMeta(row.href);
                return (
                  <li
                    key={row.href}
                    className="about-me-row relative grid grid-cols-[auto_1fr] gap-x-4 border-b border-line py-6 sm:gap-x-6"
                  >
                    <span
                      className="pt-1 font-mono text-[0.6875rem] tracking-[0.08em] text-fg-tertiary"
                      aria-hidden="true"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={row.href}
                        className="hit-ext text-heading text-fg transition-colors hover:text-accent"
                      >
                        {tNav(row.labelKey)}
                      </Link>
                      {t.has(`meItems.${row.labelKey}`) && (
                        <p className="mt-1.5 max-w-[52ch] text-caption text-fg-secondary">
                          {t(`meItems.${row.labelKey}`)}
                        </p>
                      )}
                      {meta.length > 0 && (
                        <p className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                          {meta.map((line) => (
                            <span key={line} className="tabular-nums">
                              {line}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </Reveal>
            <style href="about-me-index" precedence="medium">
              {ROW_CSS}
            </style>
          </section>
        )}

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

/** The same accent rule 生活's corridor and the lab index draw: it appears on
 *  the left on hover, and is the only motion a text row gets. */
const ROW_CSS = `
.about-me-row::before {
  content: "";
  position: absolute;
  left: -1rem;
  top: 1.5rem;
  bottom: 1.5rem;
  width: 2px;
  border-radius: 2px;
  background: var(--accent);
  opacity: 0;
  transition: opacity 0.25s ease-out;
}
.about-me-row:hover::before,
.about-me-row:focus-within::before { opacity: 0.75; }
`;
