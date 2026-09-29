import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page";
import { Link } from "@/i18n/navigation";
import { asset } from "@/lib/asset";
import { coverOf } from "@/lib/films";
import { inLocale } from "@/lib/localized";
import { getFilms } from "@/lib/server/content";
import { sectionMetadata } from "@/lib/server/seo";
import { Reveal } from "@/components/fx/Reveal";

export const generateMetadata = sectionMetadata("films", "/films");

/** The room's index: one card per film, a still large and the title under it. */
export default async function FilmsPage({ params }: PageProps<"/[locale]/films">) {
  const locale = await pageLocale(params);
  const t = await getTranslations("films");
  const tTracks = await getTranslations("tracks");
  const films = (await getFilms()).map((film) => inLocale(film, locale));

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
        {films.map((film, i) => {
          const cover = coverOf(film.stills, film.cover);
          // An odd one out at the end takes the whole row, cut panoramic,
          // instead of hanging alone in the left column.
          const lone = films.length % 2 === 1 && i === films.length - 1;
          return (
            <li key={film.key} className={lone ? "sm:col-span-2" : undefined}>
              <Link href={`/films/${film.key}`} className="group block">
                <span className="block overflow-hidden rounded-card bg-surface">
                  {cover ? (
                    <Image
                      src={asset(cover.src)}
                      width={cover.width}
                      height={cover.height}
                      // The title under it is the link's name; a sentence about
                      // the picture ahead of it only delayed it.
                      alt=""
                      sizes={
                        lone ? "(min-width: 640px) 672px, 100vw" : "(min-width: 640px) 340px, 100vw"
                      }
                      // The first card's picture is the page's largest paint.
                      loading={i === 0 ? "eager" : undefined}
                      fetchPriority={i === 0 ? "high" : undefined}
                      className={`${lone ? "aspect-[3/2] sm:aspect-[21/9]" : "aspect-[3/2]"} w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]`}
                    />
                  ) : (
                    // A film hung before its stills keeps the card's shape.
                    <span
                      className={`block ${lone ? "aspect-[3/2] sm:aspect-[21/9]" : "aspect-[3/2]"}`}
                    />
                  )}
                </span>
                <span className="mt-3 flex items-baseline justify-between gap-4">
                  <span className="text-heading text-fg transition-colors group-hover:text-accent">
                    {film.title}
                  </span>
                  <span className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                    {film.year}
                  </span>
                </span>
                <span className="mt-1.5 block max-w-[40ch] text-caption text-fg-secondary">
                  {film.subtitle}
                </span>
                <span className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                  <span className="tabular-nums">
                    {t("countStills", { count: film.stills.length })}
                  </span>
                  {film.track && (
                    <span>{t("record", { title: tTracks(`${film.track}.title`) })}</span>
                  )}
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
