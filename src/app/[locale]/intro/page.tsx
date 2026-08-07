import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { site } from "@/config/site";
import { sectionMetadata } from "@/lib/seo";
import { getIntroNodes } from "@/lib/content";
import {
  INTRO_STICKERS,
  type IntroCopy,
  type IntroLink,
} from "@/lib/intro/stickers";
import { IntroStage } from "@/components/intro/IntroStage";

export const generateMetadata = sectionMetadata("intro", "/intro");

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

  // One card per sticker, in the order the camera visits them. The résumé's
  // words and the sticker's position are separate records joined by key: the
  // angles were calibrated against one head model and mean nothing to an
  // editor, while the prose changes without touching the scene. A node whose
  // key has no sticker simply isn't visited.
  const nodes = await getIntroNodes();
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const copy: IntroCopy[] = INTRO_STICKERS.flatMap((sticker) => {
    const node = byKey.get(sticker.id);
    if (!node) return [];
    return [
      {
        id: sticker.id,
        kicker: node.kicker[locale],
        title: node.title[locale],
        period: node.period?.[locale],
        body: node.body[locale],
        bullets: node.bullets[locale] ?? [],
      },
    ];
  });

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
