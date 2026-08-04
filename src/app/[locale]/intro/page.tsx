import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { site } from "@/config/site";
import { localeAlternates } from "@/lib/seo";
import {
  INTRO_STICKERS,
  type IntroCopy,
  type IntroLink,
} from "@/lib/intro/stickers";
import { IntroStage } from "@/components/intro/IntroStage";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/intro">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "intro" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: localeAlternates("/intro", locale),
  };
}

/**
 * Intro — the same person as /about, told the other way round: a head you
 * scroll around, with a sticker for every thing worth mentioning.
 *
 * This file stays a Server Component. It localizes every string up front so
 * the client bundle ships plain text and the Canvas never re-renders on a
 * locale change; the geometry it pairs them with lives in
 * `lib/intro/stickers.ts`.
 */
export default async function IntroPage({
  params,
}: PageProps<"/[locale]/intro">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("intro");

  // One card per sticker, in the order the camera visits them. `t.raw` is the
  // way to reach the bullet arrays — next-intl's `t` only returns strings.
  // `period` is optional per node, and asking for a key that isn't there logs
  // an error and yields the key path as text, so it goes through `t.has`
  // first — that is a silent lookup, and it keeps the messages files from
  // carrying empty strings whose only job is to keep the lookup quiet.
  const copy: IntroCopy[] = INTRO_STICKERS.map((sticker) => ({
    id: sticker.id,
    kicker: t(`nodes.${sticker.id}.kicker`),
    title: t(`nodes.${sticker.id}.title`),
    period: t.has(`nodes.${sticker.id}.period`)
      ? t(`nodes.${sticker.id}.period`)
      : undefined,
    body: t(`nodes.${sticker.id}.body`),
    bullets: (t.raw(`nodes.${sticker.id}.bullets`) as string[]) ?? [],
  }));

  // The email is deliberately empty in site config until there is a real
  // public address, so it is left out rather than faked.
  const links: IntroLink[] = [
    { label: "GitHub", href: site.social.github, external: true },
    { label: t("linkAbout"), href: `/${locale}/about` },
    { label: t("linkWriting"), href: `/${locale}/blog` },
  ];

  return (
    <main className="flex-1">
      <IntroStage
        text={{
          name: site.author,
          role: t("role"),
          meta: t("meta"),
          tagline: t("tagline"),
          scrollHint: t("scrollHint"),
          outroTitle: t("outroTitle"),
          outroBody: t("outroBody"),
          resumeRegion: t("resumeRegion"),
        }}
        copy={copy}
        links={links}
        loadingLabel={t("loading")}
      />
    </main>
  );
}
