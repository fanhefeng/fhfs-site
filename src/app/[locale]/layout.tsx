import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Monoton, Poiret_One, Noto_Serif_SC, Inter } from "next/font/google";
import { routing, type Locale } from "@/i18n/routing";
import { site } from "@/config/site";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FilmGrain } from "@/components/fx/FilmGrain";
import "../globals.css";

const signFont = Monoton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-sign",
  display: "swap",
});

const decoFont = Poiret_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-deco",
  display: "swap",
});

const serifSC = Noto_Serif_SC({
  weight: ["400", "600", "900"],
  variable: "--font-serif-sc",
  display: "swap",
  preload: false,
});

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
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
      className={`${signFont.variable} ${decoFont.variable} ${serifSC.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col bg-bg text-fg">
        <NextIntlClientProvider>
          <FilmGrain />
          <Header />
          {children}
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
