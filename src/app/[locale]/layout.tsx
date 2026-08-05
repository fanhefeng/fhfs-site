import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { fontVariables } from "../fonts";
import { routing, type Locale } from "@/i18n/routing";
import { site } from "@/config/site";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AuroraLayer } from "@/components/fx/AuroraLayer";
import { ThemeKeeper } from "@/components/fx/ThemeKeeper";
import { GrainLayer } from "@/components/fx/GrainLayer";
import { SmoothScroll } from "@/components/fx/SmoothScroll";
import { RouteTransition } from "@/components/fx/RouteTransition";
import { OvertureLight } from "@/components/fx/OvertureLight";
import { ProgressHud } from "@/components/fx/ProgressHud";
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
  const l = (hasLocale(routing.locales, locale) ? locale : "zh") as Locale;
  return {
    metadataBase: new URL(site.url),
    title: { default: site.title[l], template: `%s | ${site.signName}` },
    description: site.description[l],
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    // No data-theme here on purpose. React only touches attributes it
    // renders, so leaving it out hands the attribute entirely to the script
    // below and to LightSwitch. Rendering it would reset the theme to this
    // value every time React re-renders <html> on the client — which is what
    // a locale switch does, and it used to drop dark-mode readers back onto
    // paper mid-session. globals.css treats "no attribute" as light, so the
    // pre-paint default is unchanged.
    <html
      lang={locale === "zh" ? "zh-CN" : "en"}
      suppressHydrationWarning
      className={`${fontVariables} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col bg-bg text-fg">
        {/* Apply the saved theme before first paint — warm paper (light) is
            the default; a stored choice wins, otherwise the OS preference.
            Contract: localStorage 'fhfs-theme' + data-theme + 'fhfs:theme'.

            Must stay a raw <script>. next/script defers even
            beforeInteractive through the self.__next_s queue: measured here,
            that lands the theme 15ms *after* first paint (a white flash for
            dark-mode readers), where this inline tag lands 8ms before it.

            React 19 logs "Encountered a script tag while rendering" on every
            locale switch, since that re-renders this layout on the client.
            Measured: 1 in `next dev`, 0 in a production build — it is a
            development warning. It is also accurate and harmless here: the
            script only ever needs to run for the initial document, and
            ThemeKeeper below covers every later re-render.

            Alternatives, all measured and all worse: next/script (theme lands
            15ms after first paint), moving this into <head> (same warning,
            and Next asks you not to hand-write <head>), hoisting the document
            to a top-level app/layout.tsx (loses the per-locale <html lang> in
            the SSR output), dropping the script for ThemeKeeper alone (first
            paint flashes for anyone whose choice differs from their OS). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("fhfs-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})()`,
          }}
        />
        <NextIntlClientProvider>
          <ThemeKeeper />
          <SmoothScroll />
          <RouteTransition />
          <OvertureLight />
          <ProgressHud />
          <AuroraLayer />
          <GrainLayer />
          <Header />
          {children}
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
