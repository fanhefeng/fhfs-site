import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import {
  Inter,
  Instrument_Serif,
  Geist_Mono,
  Noto_Sans_SC,
  Noto_Serif_SC,
} from "next/font/google";
import { routing, type Locale } from "@/i18n/routing";
import { site } from "@/config/site";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AuroraLayer } from "@/components/fx/AuroraLayer";
import { GrainLayer } from "@/components/fx/GrainLayer";
import { SmoothScroll } from "@/components/fx/SmoothScroll";
import { RouteTransition } from "@/components/fx/RouteTransition";
import { OvertureLight } from "@/components/fx/OvertureLight";
import { ProgressHud } from "@/components/fx/ProgressHud";
import "../globals.css";

/* Editorial type trio + CJK fallbacks. globals.css assembles the runtime
 * stacks from these variables (system PingFang/Songti take priority for CJK,
 * so the Noto webfonts stay non-preloaded fallbacks). */
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const serif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const sansSC = Noto_Sans_SC({
  weight: ["400", "500", "600"],
  variable: "--font-noto-sans-sc",
  display: "swap",
  preload: false,
});

const serifSC = Noto_Serif_SC({
  weight: ["400", "600"],
  variable: "--font-noto-serif-sc",
  display: "swap",
  preload: false,
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const dynamicParams = false;

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
    <html
      lang={locale === "zh" ? "zh-CN" : "en"}
      data-theme="light"
      suppressHydrationWarning
      className={`${sans.variable} ${serif.variable} ${mono.variable} ${sansSC.variable} ${serifSC.variable} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col bg-bg text-fg">
        {/* Apply the saved theme before first paint — warm paper (light) is
            the default; a stored choice wins, otherwise the OS preference.
            Contract: localStorage 'fhfs-theme' + data-theme + 'fhfs:theme'.

            Must stay a raw <script>, despite React 19's dev-only "script tag
            while rendering" warning. next/script defers even
            beforeInteractive through the self.__next_s queue: measured here,
            that lands the theme 15ms *after* first paint (a white flash for
            dark-mode readers), where this inline tag lands 8ms before it. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("fhfs-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})()`,
          }}
        />
        <NextIntlClientProvider>
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
