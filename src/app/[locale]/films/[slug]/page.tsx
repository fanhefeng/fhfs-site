import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { pageLocale } from "@/i18n/page";
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/lib/seo";
import { Reveal } from "@/components/fx/Reveal";
import { RoomMusic } from "@/components/fx/RoomMusic";
import { FILMS, FILM_FACTS, filmEntry } from "@/components/films/entries";
import { FilmStills, type StillItem } from "@/components/films/FilmStills";

/** A fixed set of films — the whole list is known at build time. */
export const dynamicParams = false;

export function generateStaticParams() {
  return FILMS.map((film) => ({ slug: film.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/films/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const film = filmEntry(slug);
  if (!film) return {};
  const t = await getTranslations({ locale, namespace: `films.${film.slug}` });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: localeAlternates(`/films/${film.slug}`, locale),
  };
}

type Translator = { (key: string): string; has: (key: string) => boolean };

/** Numbered paragraphs under one stem — `story1`, `story2`, … — as many as the catalogue has. */
function paragraphs(t: Translator, stem: string): string[] {
  const out: string[] = [];
  for (let i = 1; t.has(`${stem}${i}`); i++) out.push(t(`${stem}${i}`));
  return out;
}

/**
 * One film, one room. The movements: the title and who made it, with the
 * film's own record going on at the door (`RoomMusic`); the facts; the story,
 * one paragraph of it; the parts, for a film released in two; the lines
 * everyone remembers; the stills. A wide page (1040px) for the pictures, the
 * text at 720px like the rest.
 *
 * There is no review movement: a page about a film people have seen is for
 * the film, not for an essay about it — the story says what it is, the lines
 * and the stills do the rest.
 */
export default async function FilmPage({ params }: PageProps<"/[locale]/films/[slug]">) {
  const locale = await pageLocale(params);
  const { slug } = await params;
  const film = filmEntry(slug);
  if (!film) notFound();
  const t = await getTranslations("films");
  const tf = await getTranslations(`films.${film.slug}`);
  const tt = await getTranslations(`tracks.${film.track}`);
  const tc = await getTranslations("common");

  const stills: StillItem[] = film.stills.map((still) => ({
    ...still,
    title: tf(`stills.${still.id}.title`),
    meta: tf(`stills.${still.id}.meta`),
    alt: tf(`stills.${still.id}.alt`),
  }));
  const story = paragraphs(tf, "story");
  const backToIndex = (
    <Link
      href="/films"
      className="hit-ext inline-flex min-h-11 items-center font-mono text-meta uppercase tracking-meta text-fg-tertiary transition-colors hover:text-accent"
    >
      {t("backToIndex")}
    </Link>
  );

  return (
    <main id="main" className="mx-auto w-full max-w-[1040px] flex-1 px-6 pb-28 pt-32 md:pt-40">
      <Reveal as="header" className="mb-16 max-w-[720px]">
        {backToIndex}
        <p className="mt-6 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {tf("kicker")}
        </p>
        <h1 className="mt-3 text-display">{tf("title")}</h1>
        <p className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          <span className="text-accent">{tf("latin")}</span>
          <span aria-hidden>·</span>
          <span>{tf("meta")}</span>
        </p>
        <p className="mt-6 max-w-[52ch] text-body text-fg-secondary">{tf("lede")}</p>
        <RoomMusic
          track={film.track}
          tonight={tc("tonight")}
          title={tt("title")}
          artist={tt("artist")}
          className="mt-6"
        />
      </Reveal>

      {/* The facts. */}
      <Reveal className="mb-24 max-w-[720px]">
        <dl className="border-t border-line">
          {FILM_FACTS.map((fact) => (
            <div
              key={fact}
              className="grid gap-1 border-b border-line py-3 sm:grid-cols-[9rem_1fr] sm:gap-6"
            >
              <dt className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                {t(`facts.${fact}`)}
              </dt>
              <dd className="text-caption text-fg">{tf(`facts.${fact}`)}</dd>
            </div>
          ))}
        </dl>
      </Reveal>

      {/* The story. */}
      <section aria-labelledby="film-story" className="mb-24 max-w-[720px]">
        <Reveal className="mb-8">
          <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
            {t("storyKicker")}
          </p>
          <h2 id="film-story" className="mt-3 text-title">
            {tf("storyTitle")}
          </h2>
        </Reveal>
        <Reveal as="div" stagger={0.08} className="space-y-5">
          {story.map((paragraph, i) => (
            <p key={i} className="max-w-[60ch] text-body text-fg-secondary">
              {paragraph}
            </p>
          ))}
        </Reveal>
      </section>

      {/* The parts, for a film released in two. */}
      {film.parts && (
        <section aria-labelledby="film-parts" className="mb-24 max-w-[720px]">
          <Reveal className="mb-8">
            <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
              {tf("partsKicker")}
            </p>
            <h2 id="film-parts" className="mt-3 text-title">
              {tf("partsTitle")}
            </h2>
          </Reveal>
          <Reveal as="ol" stagger={0.05} className="border-t border-line">
            {film.parts.map((id) => (
              <li
                key={id}
                className="grid gap-1 border-b border-line py-5 sm:grid-cols-[9rem_1fr] sm:gap-6"
              >
                <span className="font-mono text-meta uppercase tracking-meta text-fg-tertiary tabular-nums">
                  {tf(`parts.${id}.meta`)}
                </span>
                <div>
                  <p className="text-heading text-fg">{tf(`parts.${id}.title`)}</p>
                  <p className="mt-1 max-w-[56ch] text-caption text-fg-secondary">
                    {tf(`parts.${id}.note`)}
                  </p>
                </div>
              </li>
            ))}
          </Reveal>
        </section>
      )}

      {/* The lines. */}
      <section aria-labelledby="film-lines" className="mb-24 max-w-[720px]">
        <Reveal className="mb-8">
          <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
            {t("linesKicker")}
          </p>
          <h2 id="film-lines" className="mt-3 text-title">
            {tf("linesTitle")}
          </h2>
        </Reveal>
        <Reveal as="ul" stagger={0.08} className="space-y-10">
          {film.lines.map((id) => (
            <li key={id}>
              <blockquote className="border-l-2 border-accent pl-5">
                <p
                  className={`font-serif text-[1.1875rem] leading-relaxed text-fg-secondary ${
                    locale === "en" ? "italic" : ""
                  }`}
                >
                  “{tf(`lines.${id}.text`)}”
                </p>
                <footer className="mt-3 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                  {tf(`lines.${id}.meta`)}
                </footer>
              </blockquote>
            </li>
          ))}
        </Reveal>
      </section>

      {/* The stills. */}
      <section aria-labelledby="film-stills" className="mb-16">
        <Reveal className="mb-8 max-w-[720px]">
          <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
            {tf("stillsKicker")}
          </p>
          <h2 id="film-stills" className="mt-3 text-title">
            {tf("stillsTitle")}
          </h2>
          <p className="mt-4 max-w-[52ch] text-body text-fg-secondary">{tf("stillsLede")}</p>
        </Reveal>
        <FilmStills
          folder={film.slug}
          ratio={film.ratio}
          stills={stills}
          text={{
            open: t("viewer.open"),
            close: t("viewer.close"),
            prev: t("viewer.prev"),
            next: t("viewer.next"),
            // Raw: the placeholders are the viewer's to fill, not ICU's.
            counter: t.raw("viewer.counter"),
            hint: t("viewer.hint"),
          }}
        />
      </section>

      <Reveal as="footer" className="max-w-[720px]">
        <p className="font-mono text-meta text-fg-tertiary">{tf("credit")}</p>
        <Link
          href="/films"
          className="hit-ext mt-8 inline-flex min-h-11 items-center gap-2 rounded-chip border border-line px-4 py-2.5 text-caption text-fg transition-colors hover:border-accent hover:text-accent"
        >
          {t("backToIndex")}
        </Link>
      </Reveal>
    </main>
  );
}
