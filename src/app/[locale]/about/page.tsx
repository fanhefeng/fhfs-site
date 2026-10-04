import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page";
import { Link } from "@/i18n/navigation";
import { site } from "@/config/site";
import { getAbout, getAllNavItems, getChips, getResumeExperiences } from "@/lib/server/content";
import { sectionMetadata } from "@/lib/server/seo";
import { Mdx } from "@/components/blog/Mdx";
import { DotDoodle } from "@/components/fx/DotDoodle";
import { Reveal } from "@/components/fx/Reveal";
import { ManifestoBand } from "@/components/about/ManifestoBand";
import { StickerWall } from "@/components/about/StickerWall";
import { Changelog, type ChangelogEntry } from "@/components/about/Changelog";
import { Colophon } from "@/components/about/Colophon";

export const generateMetadata = sectionMetadata("about", "/about");

/**
 * About — a name, the slogan crossing the screen, three short paragraphs, the
 * career beside its rail of years, a wall of stickers you can throw around,
 * and the way on to the rest of the section.
 *
 * 关于 is the author's whole section, the way 生活 is the rooms': the two
 * pages that are also about me — the 3D intro and the résumé — hang off it
 * rather than standing beside it in the island, and the rows that close the
 * page are where a reader finds them. They read the nav table for that (`me`,
 * minus whatever the island carries itself), so a page added to the group
 * lists itself here. A row is a name and an arrow and nothing else: the index
 * that stood here before gave each page a number, a blurb and a count, which
 * was more page than two links are worth (DESIGN-LOG, 10-04).
 *
 * Everything interactive lives in its own client component; this file stays
 * a Server Component that only reads content and localizes it. The band is
 * the site's one pinned section — it used to open the home page, and moved
 * here when the grove took the cover. The 3D desk that used to sit under the
 * name is a lab study now (/lab/workstation), and so is the life numbered
 * like software that used to close the page (/lab/changelog) — the career
 * that took its place is the same list and rail, with a row per city.
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

  const [navRows, experiences] = await Promise.all([getAllNavItems(), getResumeExperiences()]);

  // The career is the résumé's own rows — one per city: where, when, and one
  // line of what — so the two pages cannot tell different stories. The rail
  // shows the year a row begins, read off its freeform `period`.
  const career: ChangelogEntry[] = experiences.map((row) => {
    const period = row.period[locale];
    return {
      id: row.key,
      label: period,
      year: /\d{4}/.exec(period)?.[0] ?? "—",
      title: row.company[locale],
      note: row.role[locale],
    };
  });

  // The rest of the section: the pages under 关于 that the island does not
  // carry itself, in the table's own order.
  const meRows = navRows.filter((row) => row.group === "me" && !row.surfaces.includes("header"));

  const column = "mx-auto w-full max-w-[720px] px-6";
  const kicker = "font-mono text-meta uppercase tracking-meta text-fg-tertiary";

  return (
    <main id="main" className="flex-1 pb-24">
      <header className={`${column} pt-24 sm:pt-32`}>
        <p className={kicker}>{t("title")}</p>
        {/* The name, set in a dot matrix that keeps it half-hidden until you
            point at it. The heading still *is* the name for anything that
            reads the page — the canvas is decoration layered over it. */}
        <h1 className="mt-5">
          <DotDoodle text={site.author} className="h-[clamp(3rem,13vw,5rem)]" />
          <span className="sr-only">{site.author}</span>
        </h1>
        <p className="accent-light mt-4 font-accent text-title leading-tight text-fg-secondary">
          {t("keywords")}
        </p>
        <p className="mt-6 max-w-[46ch] text-body text-fg-secondary">{t("lead")}</p>
      </header>

      {/* Full-bleed: the band writes its own 100vw stage on desktop. */}
      <ManifestoBand />

      <div className={column}>
        {about && <Mdx html={about.html} />}

        {career.length > 0 && (
          <Changelog
            entries={career}
            title={t("careerTitle")}
            ariaLabel={t("careerAria")}
            className="mt-20"
          />
        )}

        <StickerWall
          chips={chips}
          title={t("stickersTitle")}
          hint={t("stickersHint")}
          ariaLabel={t("stickersAria")}
          className="mt-20"
        />

        {/* The rest of 关于. The whole row is the link, so it is a target a
            thumb can hit without the name having to be long. */}
        {meRows.length > 0 && (
          <section aria-labelledby="about-more" className="mt-20">
            <h2 id="about-more" className={`${kicker} mb-4`}>
              {t("moreTitle")}
            </h2>
            <Reveal as="ul" role="list" stagger={0.06} className="border-t border-line">
              {meRows.map((row) => (
                <li key={row.href} className="border-b border-line">
                  <Link
                    href={row.href}
                    className="group flex min-h-14 items-center justify-between gap-4 text-heading text-fg transition-colors hover:text-accent"
                  >
                    {tNav(row.labelKey)}
                    <span
                      aria-hidden="true"
                      className="font-mono text-body font-normal text-fg-tertiary transition-[translate,color] duration-200 group-hover:translate-x-1 group-hover:text-accent"
                    >
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </Reveal>
          </section>
        )}

        <Colophon className="mt-24" />
      </div>
    </main>
  );
}
