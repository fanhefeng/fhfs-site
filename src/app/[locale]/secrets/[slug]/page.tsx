import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { routing, htmlLang } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import {
  getAdjacentSecrets,
  getAllSecretSlugs,
  getSecret,
  getSecretEditions,
} from "@/lib/content";
import { HAS_CJK } from "@/lib/reading";
import { Mdx } from "@/components/blog/Mdx";
import { PostTitle } from "@/components/blog/PostTitle";
import { RoomMusic } from "@/components/fx/RoomMusic";
import { localeAlternates } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { site } from "@/config/site";

/** Prerendered for what exists at build time; a new piece renders on first
 *  request — the same contract as /blog/[slug], for the same reason. */
export async function generateStaticParams() {
  return (await getAllSecretSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/secrets/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const secret = await getSecret(slug, locale);
  if (!secret) return {};
  const alternates = localeAlternates(
    `/secrets/${slug}`,
    locale,
    (await getSecretEditions(slug)).map((edition) => edition.locale)
  );
  if (secret.isFallback) {
    alternates.canonical = `${site.url}/${secret.locale}/secrets/${slug}`;
  }
  return { title: secret.title, description: secret.summary, alternates };
}

/**
 * One piece: an essay reads like an article; an episode puts its player
 * above the notes. The room's record stays on for an essay and stays *off*
 * for an episode — two things playing at once is not a secret, it is noise.
 */
export default async function SecretPage({ params }: PageProps<"/[locale]/secrets/[slug]">) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("secrets");
  const tt = await getTranslations("tracks.secret");
  const tc = await getTranslations("common");
  const format = await getFormatter();
  const secret = await getSecret(slug, locale);
  if (!secret) notFound();

  const { older, newer } = await getAdjacentSecrets(secret.slug, locale);
  const isPodcast = secret.kind === "podcast";

  return (
    <main id="main" className="mx-auto w-full max-w-[68ch] flex-1 px-6 pb-28 pt-32 md:pt-40">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": isPodcast ? "PodcastEpisode" : "BlogPosting",
          headline: secret.title,
          name: secret.title,
          description: secret.summary,
          datePublished: secret.date,
          author: { "@type": "Person", name: site.author },
          url: `${site.url}/${locale}/secrets/${secret.slug}`,
          ...(isPodcast && secret.audio
            ? { associatedMedia: { "@type": "MediaObject", contentUrl: secret.audio } }
            : {}),
        }}
      />
      <article lang={secret.isFallback ? htmlLang(secret.locale) : undefined}>
        <header className="mb-12">
          <p
            lang={secret.isFallback ? htmlLang(locale) : undefined}
            className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-meta uppercase tracking-meta text-fg-tertiary"
          >
            <Link href="/secrets" className="hit-ext transition-colors hover:text-accent">
              {t("title")}
            </Link>
            <span aria-hidden>·</span>
            <span className="text-accent">{t(isPodcast ? "kindPodcast" : "kindEssay")}</span>
            <span aria-hidden>·</span>
            <time dateTime={secret.date}>
              {format.dateTime(new Date(secret.date), {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
            {isPodcast
              ? secret.duration != null && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{t("duration", { minutes: secret.duration })}</span>
                  </>
                )
              : (
                  <>
                    <span aria-hidden>·</span>
                    <span>{t("readingTime", { minutes: secret.readingMinutes })}</span>
                  </>
                )}
          </p>

          <PostTitle title={secret.title} className="text-title md:text-display-sm" />

          {secret.summary && (
            <p
              className={`mt-5 font-serif text-[1.1875rem] leading-relaxed text-fg-secondary ${
                HAS_CJK.test(secret.summary) ? "" : "italic"
              }`}
            >
              {secret.summary}
            </p>
          )}

          {!isPodcast && (
            <RoomMusic
              track="secret"
              tonight={tc("tonight")}
              title={tt("title")}
              artist={tt("artist")}
              fallbackArtist={tt("fallbackArtist")}
              className="mt-6"
            />
          )}
        </header>

        {secret.isFallback && (
          <p lang={htmlLang(locale)} className="glass-thin vibrancy mb-10 rounded-card px-4 py-3 text-caption">
            {t("fallbackNotice")}
          </p>
        )}

        {isPodcast && secret.audio && (
          <figure className="mb-10 rounded-card border border-line bg-surface p-4">
            <figcaption className="mb-3 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
              {t("listen")}
            </figcaption>
            {/* The browser's own player: nothing to load, nothing to keep
                honest, and it works with the page's JavaScript off. An
                episode's text alternative is its notes, rendered right under
                it — there is no caption track to point a <track> at. */}
            {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls preload="none" src={secret.audio} className="w-full">
              {t("audioUnsupported")}
              <a href={secret.audio} className="text-accent underline">
                {t("audioOpen")}
              </a>
            </audio>
          </figure>
        )}

        {secret.html && <Mdx html={secret.html} />}
      </article>

      {(older || newer) && (
        <nav aria-label={t("postNavAria")} className="mt-20 grid gap-8 border-t border-line pt-8 sm:grid-cols-2">
          {older && (
            <Link href={`/secrets/${older.slug}`} className="group flex flex-col gap-1.5">
              <span className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                ← {t("prevPost")}
              </span>
              <span className="text-heading text-fg transition-colors duration-200 group-hover:text-accent">
                {older.title}
              </span>
            </Link>
          )}
          {newer && (
            <Link
              href={`/secrets/${newer.slug}`}
              className="group flex flex-col gap-1.5 sm:col-start-2 sm:items-end sm:text-right"
            >
              <span className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                {t("nextPost")} →
              </span>
              <span className="text-heading text-fg transition-colors duration-200 group-hover:text-accent">
                {newer.title}
              </span>
            </Link>
          )}
        </nav>
      )}

      <p className="mt-14">
        <Link
          href="/secrets"
          className="hit-ext relative font-mono text-meta uppercase tracking-meta text-fg-secondary transition-colors duration-200 hover:text-accent"
        >
          ← {t("backToList")}
        </Link>
      </p>
    </main>
  );
}
