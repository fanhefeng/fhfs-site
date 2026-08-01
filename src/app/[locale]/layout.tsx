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
import { GrainLayer } from "@/components/fx/GrainLayer";
import { SmoothScroll } from "@/components/fx/SmoothScroll";
import { RouteTransition } from "@/components/fx/RouteTransition";
import { OvertureLight } from "@/components/fx/OvertureLight";
import { ProgressHud } from "@/components/fx/ProgressHud";
import "../globals.css";

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
      className={`${fontVariables} h-full antialiased`}
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
