import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { sectionMetadata } from "@/lib/seo";
import { Reveal } from "@/components/fx/Reveal";
import { RoomMusic } from "@/components/fx/RoomMusic";
import { OdysseyStills, type StillItem } from "@/components/odyssey/OdysseyStills";
import { ODYSSEY_FILMS, ODYSSEY_LINES, ODYSSEY_STILLS } from "@/components/odyssey/stills";

export const generateMetadata = sectionMetadata("odyssey", "/odyssey");

/**
 * 《大话西游》— a room for one film. Four movements: the title and who made
 * it; the two parts; the lines everyone remembers; the stills. Its own record
 * goes on at the door (`RoomMusic`): 一生所愛, the song over the end credits.
 * A wide page (1040px) for the pictures, the text at 720px like the rest.
 */
export default async function OdysseyPage({ params }: PageProps<"/[locale]/odyssey">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("odyssey");
  const tt = await getTranslations("tracks.odyssey");
  const tc = await getTranslations("common");

  const stills: StillItem[] = ODYSSEY_STILLS.map((still) => ({
    ...still,
    title: t(`stills.${still.id}.title`),
    meta: t(`stills.${still.id}.meta`),
    alt: t(`stills.${still.id}.alt`),
  }));

  return (
    <main id="main" className="mx-auto w-full max-w-[1040px] flex-1 px-6 pb-28 pt-32 md:pt-40">
      <Reveal as="header" className="mb-20 max-w-[720px]">
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">{t("kicker")}</p>
        <h1 className="mt-3 text-display">{t("title")}</h1>
        <p className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          <span className="text-accent">{t("latin")}</span>
          <span aria-hidden>·</span>
          <span>{t("meta")}</span>
        </p>
        <p className="mt-6 max-w-[52ch] text-body text-fg-secondary">{t("lede")}</p>
        <RoomMusic
          track="odyssey"
          tonight={tc("tonight")}
          title={tt("title")}
          artist={tt("artist")}
          fallbackArtist={tt("fallbackArtist")}
          className="mt-6"
        />
      </Reveal>

      {/* The two parts. */}
      <section aria-labelledby="odyssey-films" className="mb-24 max-w-[720px]">
        <Reveal className="mb-8">
          <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">{t("filmsKicker")}</p>
          <h2 id="odyssey-films" className="mt-3 text-title">
            {t("filmsTitle")}
          </h2>
        </Reveal>
        <Reveal as="ol" stagger={0.05} className="border-t border-line">
          {ODYSSEY_FILMS.map((id) => (
            <li key={id} className="grid gap-1 border-b border-line py-5 sm:grid-cols-[9rem_1fr] sm:gap-6">
              <span className="font-mono text-meta uppercase tracking-meta text-fg-tertiary tabular-nums">
                {t(`films.${id}.meta`)}
              </span>
              <div>
                <p className="text-heading text-fg">{t(`films.${id}.title`)}</p>
                <p className="mt-1 max-w-[56ch] text-caption text-fg-secondary">{t(`films.${id}.note`)}</p>
              </div>
            </li>
          ))}
        </Reveal>
      </section>

      {/* The lines. */}
      <section aria-labelledby="odyssey-lines" className="mb-24 max-w-[720px]">
        <Reveal className="mb-8">
          <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">{t("linesKicker")}</p>
          <h2 id="odyssey-lines" className="mt-3 text-title">
            {t("linesTitle")}
          </h2>
        </Reveal>
        <Reveal as="ul" stagger={0.08} className="space-y-10">
          {ODYSSEY_LINES.map((id) => (
            <li key={id}>
              <blockquote className="border-l-2 border-accent pl-5">
                <p
                  className={`font-serif text-[1.1875rem] leading-relaxed text-fg-secondary ${
                    locale === "en" ? "italic" : ""
                  }`}
                >
                  “{t(`lines.${id}.text`)}”
                </p>
                <footer className="mt-3 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                  {t(`lines.${id}.meta`)}
                </footer>
              </blockquote>
            </li>
          ))}
        </Reveal>
      </section>

      {/* The stills. */}
      <section aria-labelledby="odyssey-stills" className="mb-16">
        <Reveal className="mb-8 max-w-[720px]">
          <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">{t("stillsKicker")}</p>
          <h2 id="odyssey-stills" className="mt-3 text-title">
            {t("stillsTitle")}
          </h2>
          <p className="mt-4 max-w-[52ch] text-body text-fg-secondary">{t("stillsLede")}</p>
        </Reveal>
        <OdysseyStills stills={stills} />
      </section>

      <Reveal as="footer" className="max-w-[720px]">
        <p className="font-mono text-meta text-fg-tertiary">{t("credit")}</p>
      </Reveal>
    </main>
  );
}
