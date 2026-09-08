import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/lib/seo";
import { Reveal } from "@/components/fx/Reveal";
import { KobeStatueStage } from "@/components/idols/KobeStatueStage";
import { KobeGallery, type GalleryPhoto } from "@/components/idols/KobeGallery";
import { KOBE_PHOTOS, KOBE_TIMELINE } from "@/components/idols/kobePhotos";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/idols/kobe">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "idols.kobe" });
  return {
    title: t("name"),
    description: t("lede"),
    alternates: localeAlternates("/idols/kobe", locale),
  };
}

/**
 * The first idol on the wall. Four movements: the name and the numbers; the
 * statue, in code; the photographs, with their provenance; the milestones.
 * A wide page (1040px) for the statue and the pictures, the text narrower.
 */
export default async function KobePage({ params }: PageProps<"/[locale]/idols/kobe">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("idols");
  const tk = await getTranslations("idols.kobe");

  const photos: GalleryPhoto[] = KOBE_PHOTOS.map((photo) => ({
    ...photo,
    title: tk(`photos.${photo.id}.title`),
    meta: tk(`photos.${photo.id}.meta`),
    alt: tk(`photos.${photo.id}.alt`),
  }));
  const cover = photos[0];

  return (
    <main id="main" className="mx-auto w-full max-w-[1040px] flex-1 px-6 pb-28 pt-32 md:pt-40">
      <Reveal as="header" className="mb-16 max-w-[720px]">
        <Link
          href="/idols"
          className="hit-ext inline-flex min-h-11 items-center font-mono text-meta uppercase tracking-meta text-fg-tertiary transition-colors hover:text-accent"
        >
          {t("backToIndex")}
        </Link>
        <p className="mt-6 font-mono text-meta uppercase tracking-meta text-fg-tertiary">{tk("kicker")}</p>
        <h1 className="mt-3 text-display">{tk("name")}</h1>
        <p className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          <span>{tk("latin")}</span>
          <span aria-hidden>·</span>
          <span>{tk("years")}</span>
          <span aria-hidden>·</span>
          <span className="text-accent">{tk("numbers")}</span>
        </p>
        <p className="mt-6 max-w-[52ch] text-body text-fg-secondary">{tk("lede")}</p>
      </Reveal>

      {/* The statue. */}
      <section aria-labelledby="kobe-statue" className="mb-24">
        <Reveal className="mb-8 max-w-[720px]">
          <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">{tk("statueKicker")}</p>
          <h2 id="kobe-statue" className="mt-3 text-title">
            {tk("statueTitle")}
          </h2>
          <p className="mt-4 max-w-[60ch] text-body text-fg-secondary">{tk("statueBody")}</p>
        </Reveal>
        <KobeStatueStage
          hint={tk("statueHint")}
          loading={tk("loading")}
          fallbackNote={tk("statueFallback")}
          fallback={{ src: `/idols/kobe/${cover.file}`, width: cover.width, height: cover.height, alt: cover.alt }}
          turnLeft={tk("turnLeft")}
          turnRight={tk("turnRight")}
        />
        <Reveal className="mt-8 grid gap-6 border-t border-line pt-6 md:grid-cols-[auto_1fr] md:gap-12">
          <p className="font-mono text-heading tabular-nums text-fg">{tk("statuePlaque")}</p>
          <blockquote className="max-w-[60ch]">
            <p className="font-serif text-[1.1875rem] italic leading-relaxed text-fg-secondary">
              “{tk("statueQuote")}”
            </p>
            <footer className="mt-2 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
              {tk("statueQuoteMeta")}
            </footer>
          </blockquote>
        </Reveal>
      </section>

      {/* The photographs. */}
      <section aria-labelledby="kobe-gallery" className="mb-24">
        <Reveal className="mb-8 max-w-[720px]">
          <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">{tk("galleryKicker")}</p>
          <h2 id="kobe-gallery" className="mt-3 text-title">
            {tk("galleryTitle")}
          </h2>
          <p className="mt-4 max-w-[52ch] text-body text-fg-secondary">{tk("galleryLede")}</p>
        </Reveal>
        <KobeGallery photos={photos} />
      </section>

      {/* The milestones. */}
      <section aria-labelledby="kobe-timeline" className="mb-16 max-w-[720px]">
        <Reveal className="mb-8">
          <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">{tk("timelineKicker")}</p>
          <h2 id="kobe-timeline" className="mt-3 text-title">
            {tk("timelineTitle")}
          </h2>
        </Reveal>
        <Reveal as="ol" stagger={0.05} className="border-t border-line">
          {KOBE_TIMELINE.map((id) => (
            <li key={id} className="grid gap-1 border-b border-line py-4 sm:grid-cols-[9rem_1fr] sm:gap-6">
              <span className="font-mono text-meta uppercase tracking-meta text-fg-tertiary tabular-nums">
                {tk(`timeline.${id}.date`)}
              </span>
              <div>
                <p className="text-heading text-fg">{tk(`timeline.${id}.title`)}</p>
                <p className="mt-1 text-caption text-fg-secondary">{tk(`timeline.${id}.note`)}</p>
              </div>
            </li>
          ))}
        </Reveal>
      </section>

      <Reveal as="footer" className="max-w-[720px]">
        <p className="font-mono text-meta text-fg-tertiary">{tk("credit")}</p>
        <Link
          href="/idols"
          className="hit-ext mt-8 inline-flex min-h-11 items-center gap-2 rounded-chip border border-line px-4 py-2.5 text-caption text-fg transition-colors hover:border-accent hover:text-accent"
        >
          {t("backToIndex")}
        </Link>
      </Reveal>
    </main>
  );
}
