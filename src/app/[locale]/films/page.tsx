import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page";
import { Link } from "@/i18n/navigation";
import { sectionMetadata } from "@/lib/seo";
import { FILMS, filmCover, stillSrc } from "@/components/films/entries";
import { Reveal } from "@/components/fx/Reveal";

export const generateMetadata = sectionMetadata("films", "/films");

/** The room's index: one card per film, a still large and the title under it. */
export default async function FilmsPage({ params }: PageProps<"/[locale]/films">) {
  await pageLocale(params);
  const t = await getTranslations("films");
  const tTracks = await getTranslations("tracks");

  return (
    <main id="main" className="mx-auto w-full max-w-[720px] flex-1 px-6 pb-28 pt-32 md:pt-40">
      <Reveal as="section" className="mb-12">
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {t("kicker")}
        </p>
        <h1 className="mt-3 text-display-sm">{t("title")}</h1>
        <p className="mt-4 max-w-[46ch] text-body text-fg-secondary">{t("subtitle")}</p>
      </Reveal>

      <Reveal as="ul" stagger={0.06} className="grid gap-8 sm:grid-cols-2 sm:gap-6">
        {FILMS.map((film, i) => {
          const cover = filmCover(film);
          return (
            <li key={film.slug}>
              <Link href={`/films/${film.slug}`} className="group block">
                <span className="block overflow-hidden rounded-card bg-surface">
                  <Image
                    src={stillSrc(film, cover)}
                    width={cover.width}
                    height={cover.height}
                    alt={t(`${film.slug}.stills.${cover.id}.alt`)}
                    sizes="(min-width: 640px) 340px, 100vw"
                    // The first card's picture is the page's largest paint.
                    loading={i === 0 ? "eager" : undefined}
                    fetchPriority={i === 0 ? "high" : undefined}
                    className="aspect-[3/2] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                  />
                </span>
                <span className="mt-3 flex items-baseline justify-between gap-4">
                  <span className="text-heading text-fg transition-colors group-hover:text-accent">
                    {t(`${film.slug}.title`)}
                  </span>
                  <span className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                    {film.year}
                  </span>
                </span>
                <span className="mt-1.5 block max-w-[40ch] text-caption text-fg-secondary">
                  {t(`${film.slug}.subtitle`)}
                </span>
                <span className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                  <span className="tabular-nums">
                    {t("countStills", { count: film.stills.length })}
                  </span>
                  <span>{t("record", { title: tTracks(`${film.track}.title`) })}</span>
                </span>
                <span className="mt-2 block font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                  {t("open")} →
                </span>
              </Link>
            </li>
          );
        })}
      </Reveal>
    </main>
  );
}
