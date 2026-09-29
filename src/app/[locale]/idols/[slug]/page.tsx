import { Fragment } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { pageLocale } from "@/i18n/page";
import { Link } from "@/i18n/navigation";
import { asset } from "@/lib/asset";
import { STATUE_IDOL } from "@/lib/idols";
import { inLocale } from "@/lib/localized";
import { getIdol, getIdols } from "@/lib/server/content";
import { showDrafts } from "@/lib/server/auth/session";
import { localeAlternates } from "@/lib/server/seo";
import { Reveal } from "@/components/fx/Reveal";
import { KobeStatueStage } from "@/components/idols/KobeStatueStage";
import { IdolGallery, type GalleryPhoto } from "@/components/idols/IdolGallery";
import { statueStandIn } from "@/components/idols/statue";

/** As for the films: prerendered from the wall, a new idol rendered on its first request. */
export async function generateStaticParams() {
  return (await getIdols()).map((idol) => ({ slug: idol.key }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/idols/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const idol = await getIdol(slug, await showDrafts());
  if (!idol) return {};
  return {
    title: inLocale(idol.name, locale),
    description: inLocale(idol.lede, locale),
    alternates: localeAlternates(`/idols/${idol.key}`, locale),
  };
}

/**
 * One idol, one page. Up to four movements: the name and the numbers; the
 * statue, for the one idol who has one in code (`STATUE_IDOL`); the
 * photographs, with their provenance; the milestones. A wide page (1040px)
 * for the statue and the pictures, the text narrower.
 */
export default async function IdolPage({ params }: PageProps<"/[locale]/idols/[slug]">) {
  const locale = await pageLocale(params);
  const { slug } = await params;
  const row = await getIdol(slug, await showDrafts());
  if (!row) notFound();
  const idol = inLocale(row, locale);
  const t = await getTranslations("idols");
  const tk = await getTranslations("idols.kobe");

  const photos: GalleryPhoto[] = idol.photos.map((photo) => ({ ...photo, src: asset(photo.src) }));

  return (
    <main id="main" className="mx-auto w-full max-w-[1040px] flex-1 px-6 pb-28 pt-32 md:pt-40">
      <Reveal as="header" className="mb-16 max-w-[720px]">
        <Link
          href="/idols"
          className="hit-ext inline-flex min-h-11 items-center font-mono text-meta uppercase tracking-meta text-fg-tertiary transition-colors hover:text-accent"
        >
          {t("backToIndex")}
        </Link>
        <p className="mt-6 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {idol.kicker}
        </p>
        <h1 className="mt-3 text-display">{idol.name}</h1>
        <p className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {[
            { text: idol.latin, accent: false },
            { text: idol.years, accent: false },
            { text: idol.numbers, accent: true },
          ]
            .filter((part) => part.text)
            .map((part, i) => (
              <Fragment key={i}>
                {i > 0 && <span aria-hidden>·</span>}
                <span className={part.accent ? "text-accent" : undefined}>{part.text}</span>
              </Fragment>
            ))}
        </p>
        <p className="mt-6 max-w-[52ch] text-body text-fg-secondary">{idol.lede}</p>
      </Reveal>

      {/* The statue — code, and only his. */}
      {idol.key === STATUE_IDOL && (
        <section aria-labelledby="kobe-statue" className="mb-24">
          <Reveal className="mb-8 max-w-[720px]">
            <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
              {tk("statueKicker")}
            </p>
            <h2 id="kobe-statue" className="mt-3 text-title">
              {tk("statueTitle")}
            </h2>
            <p className="mt-4 max-w-[60ch] text-body text-fg-secondary">{tk("statueBody")}</p>
          </Reveal>
          <KobeStatueStage
            hint={tk("statueHint")}
            loading={tk("loading")}
            fallbackNote={tk("statueFallback")}
            fallback={{ ...statueStandIn(), alt: tk("statueAlt") }}
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
      )}

      {/* The photographs. */}
      {photos.length > 0 && (
        <section aria-labelledby="kobe-gallery" className="mb-24">
          <Reveal className="mb-8 max-w-[720px]">
            <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
              {idol.galleryKicker}
            </p>
            <h2 id="kobe-gallery" className="mt-3 text-title">
              {idol.galleryTitle}
            </h2>
            <p className="mt-4 max-w-[52ch] text-body text-fg-secondary">{idol.galleryLede}</p>
          </Reveal>
          <IdolGallery photos={photos} />
        </section>
      )}

      {/* The milestones. */}
      {idol.timeline.length > 0 && (
        <section aria-labelledby="kobe-timeline" className="mb-16 max-w-[720px]">
          <Reveal className="mb-8">
            <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
              {idol.timelineKicker}
            </p>
            <h2 id="kobe-timeline" className="mt-3 text-title">
              {idol.timelineTitle}
            </h2>
          </Reveal>
          <Reveal as="ol" stagger={0.05} className="border-t border-line">
            {idol.timeline.map((milestone, i) => (
              <li
                key={i}
                className="grid gap-1 border-b border-line py-4 sm:grid-cols-[9rem_1fr] sm:gap-6"
              >
                <span className="font-mono text-meta uppercase tracking-meta text-fg-tertiary tabular-nums">
                  {milestone.date}
                </span>
                <div>
                  <p className="text-heading text-fg">{milestone.title}</p>
                  <p className="mt-1 text-caption text-fg-secondary">{milestone.note}</p>
                </div>
              </li>
            ))}
          </Reveal>
        </section>
      )}

      <Reveal as="footer" className="max-w-[720px]">
        <p className="font-mono text-meta text-fg-tertiary">{idol.credit}</p>
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
