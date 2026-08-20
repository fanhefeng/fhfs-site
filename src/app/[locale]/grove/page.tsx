import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { sectionMetadata } from "@/lib/seo";
import { getPosts, getApps } from "@/lib/content";
import { GroveHero } from "@/components/grove/GroveHero";
import type { DockItem } from "@/components/grove/NavDock";

export const generateMetadata = sectionMetadata("grove", "/grove");

/* Four glyphs for the dock, drawn rather than imported: at 14u they are a
   dozen path commands each, and a sprite sheet for that is a request. */
const GLYPHS: Record<string, React.ReactNode> = {
  grove: (
    <svg viewBox="0 0 16 16">
      <path d="M8 14V9" />
      <path d="M8 9c0-2.4 1.7-4.3 4-4.3.2 2.6-1.6 4.6-4 4.3Z" />
      <path d="M8 10.5C7.9 8.4 6.4 6.8 4.4 6.8 4.3 8.9 5.9 10.6 8 10.5Z" />
    </svg>
  ),
  writing: (
    <svg viewBox="0 0 16 16">
      <path d="M4 2.4h5.3L12 5.1v8.5H4z" />
      <path d="M9.2 2.4V5h2.7" />
      <path d="M6 8.4h4M6 10.8h2.8" />
    </svg>
  ),
  software: (
    <svg viewBox="0 0 16 16">
      <path d="M2.6 3.6h10.8v7.2H2.6z" />
      <path d="M5.6 13.4h4.8" />
      <path d="m6.4 6.2 1.6 1.6-1.6 1.6" />
    </svg>
  ),
  lab: (
    <svg viewBox="0 0 16 16">
      <path d="M1.6 12.4c2.4-3.4 4.3-5.1 5.7-5.1 2 0 3 3.6 5 3.6 1.1 0 1.9-.5 2.4-1.4" />
      <path d="M4.3 6.2C5.5 4.4 6.6 3.5 7.6 3.5c1.5 0 2.2 2.4 3.7 2.4" />
    </svg>
  ),
};

/**
 * The grove: a full-viewport hero standing on its own, with its own dock.
 *
 * Everything on it is real — the counts come from the database, the two cards
 * point at the newest thing written and at the study the moss came out of. It
 * is a different way into the same site rather than a picture of one.
 */
export default async function GrovePage({ params }: PageProps<"/[locale]/grove">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("grove");
  const nav = await getTranslations("nav");
  const [posts, apps] = await Promise.all([getPosts(locale), getApps()]);
  const latest = posts[0];

  /* The dock says where you are, so this page is in it and marked. The mark
     tile is the way back to the site proper, exactly as the logo is. */
  const items: DockItem[] = [
    { href: "/grove", label: nav("grove"), glyph: GLYPHS.grove, active: true },
    { href: "/blog", label: nav("blog"), glyph: GLYPHS.writing },
    { href: "/software", label: nav("software"), glyph: GLYPHS.software },
    { href: "/lab", label: nav("lab"), glyph: GLYPHS.lab },
  ];

  return (
    <GroveHero
      ghost={t("ghost")}
      headline={[t("headline1"), t("headline2")]}
      lede={t("lede")}
      cta={{ label: t("cta"), href: "/portfolio" }}
      play={{ label: t("play"), href: "/intro" }}
      stats={[
        { label: t("statPosts"), value: t("statPostsValue", { count: posts.length }) },
        { label: t("statApps"), value: t("statAppsValue", { count: apps.length }) },
      ]}
      cards={[
        {
          label: t("cardLabLabel"),
          title: t("cardLabTitle"),
          href: "/lab/grove",
          src: "/grove/moss-plate.webp",
          alt: t("cardLabAlt"),
          linkLabel: t("cardLabLink"),
        },
        {
          label: t("cardPostLabel"),
          title: latest?.title ?? t("cardPostFallback"),
          href: latest ? `/blog/${latest.slug}` : "/blog",
          src: "/lab/dissolve/forest.jpg",
          alt: t("cardPostAlt"),
          linkLabel: t("cardPostLink"),
        },
      ]}
      scrollLabel={t("scroll")}
      dock={{
        ariaLabel: t("dockAria"),
        markLabel: t("markLabel"),
        markHref: "/",
        items,
      }}
    />
  );
}
