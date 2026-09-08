import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { fontVariables } from "../fonts";
import { ThemeInitScript } from "../ThemeInitScript";
import { routing, htmlLang, type Locale } from "@/i18n/routing";
import { site } from "@/config/site";
import { getAllNavItems, getNavItems, type NavItem } from "@/lib/content";
import type { NavLink } from "@/lib/nav";
import { feedTypes } from "@/lib/seo";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AuroraLayer } from "@/components/fx/AuroraLayer";
import { ThemeKeeper } from "@/components/fx/ThemeKeeper";
import { GrainLayer } from "@/components/fx/GrainLayer";
import { SmoothScroll } from "@/components/fx/SmoothScroll";
import { RouteTransition } from "@/components/fx/RouteTransition";
import { OvertureLight } from "@/components/fx/OvertureLight";
import { ProgressHud } from "@/components/fx/ProgressHud";
import { Jukebox } from "@/components/fx/Jukebox";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * There is deliberately no `dynamicParams = false` here.
 *
 * It reads like a per-segment switch but Next ANDs it down the whole route:
 * leaving it on this layout would have pinned every nested dynamic segment to
 * "404 unless prerendered", no matter what those segments declared. Since
 * content now comes from a database that can gain a post between deploys,
 * unknown params have to be allowed through and answered at request time.
 *
 * An unmatched locale still 404s — `hasLocale` below sees to that.
 */

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { locale } = await params;
  const l: Locale = hasLocale(routing.locales, locale)
    ? locale
    : routing.defaultLocale;
  return {
    metadataBase: new URL(site.url),
    title: { default: site.title[l], template: `%s | ${site.signName}` },
    description: site.description[l],
    // A page that sets `alternates` replaces this object rather than merging
    // into it, which is why `localeAlternates()` in lib/seo.ts carries the
    // same feed link — this copy is for the pages that set none.
    alternates: { types: feedTypes(l) },
    openGraph: {
      type: "website",
      siteName: site.signName,
      locale: l === "zh" ? "zh_CN" : "en_US",
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const t = await getTranslations("layout");

  // One nav table, three surfaces. These used to be three constants that had
  // already drifted apart: /intro only ever reached the sitemap, and home only
  // ever reached the full-screen menu. A row is a "door" when it is on the
  // header surface — the menu hangs the rest of its group under it.
  const toLink = (row: NavItem): NavLink => ({
    href: row.href,
    labelKey: row.labelKey,
    group: row.group,
    door: row.surfaces.includes("header"),
  });
  // The whole table too: which rows hang under which door is a matter of
  // group, not of which surfaces a row happens to be ticked for, so the
  // island reads it off the full list rather than the menu's.
  const [headerLinks, footerLinks, menuLinks, allLinks] = (
    await Promise.all([
      getNavItems("header"),
      getNavItems("footer"),
      getNavItems("fullnav"),
      getAllNavItems(),
    ])
  ).map((rows) => rows.map(toLink));

  return (
    // No data-theme here on purpose. React only touches attributes it
    // renders, so leaving it out hands the attribute entirely to the script
    // below and to LightSwitch. Rendering it would reset the theme to this
    // value every time React re-renders <html> on the client — which is what
    // a locale switch does, and it used to drop dark-mode readers back onto
    // paper mid-session. globals.css treats "no attribute" as light, so the
    // pre-paint default is unchanged.
    <html
      lang={htmlLang(locale)}
      suppressHydrationWarning
      className={`${fontVariables} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col bg-bg text-fg">
        {/* Apply the saved theme before first paint — why this is an inline
            script wrapped in a div, and not next/script, is written out in
            ThemeInitScript.tsx. ThemeKeeper below owns every later change. */}
        <ThemeInitScript />
        <NextIntlClientProvider>
          <ThemeKeeper />
          <SmoothScroll />
          <RouteTransition />
          <OvertureLight />
          <ProgressHud />
          {/* The background music's player, behind every page: the signs
              (front door, /lab/neon, the note on the island) only switch it. */}
          <Jukebox />
          <AuroraLayer />
          <GrainLayer />
          {/* First tab stop on every page: a keyboard reader gets past the
              island and the menu in one press. Every page's <main> carries
              id="main"; a hash jump is one of the clicks RouteTransition
              deliberately leaves to the browser. */}
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-surface-raised focus:px-4 focus:py-2 focus:font-mono focus:text-meta focus:uppercase focus:tracking-meta focus:text-fg focus:shadow-lg focus:outline-2 focus:outline-accent"
          >
            {t("skipToContent")}
          </a>
          <Header links={headerLinks} menuLinks={menuLinks} allLinks={allLinks} />
          {children}
          <Footer items={footerLinks} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
