import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { getApps } from "@/lib/content";
import { localeAlternates } from "@/lib/seo";
import { Reveal } from "@/components/fx/Reveal";
import { SoftwareGallery } from "@/components/software/SoftwareGallery";
import { DeviceShowcase } from "@/components/software/DeviceShowcase";
import { toSoftwareApp } from "@/components/software/appMeta";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "software" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: localeAlternates("/software", locale),
  };
}

/**
 * Software — the keynote bento. Stays a Server Component: the apps are read
 * from the YAML collection at build time and flattened to a plain payload
 * (localized strings, CTA key, accent hue) before crossing into the two
 * client islands, so nothing about the data is client work.
 */
export default async function SoftwarePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("software");

  const apps = getApps().map((app, i) => toSoftwareApp(app, i, locale as Locale));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-24 pt-16 sm:pt-20">
      <header className="mb-12 max-w-[42rem]">
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {t("kicker")}
        </p>
        <h1 className="mt-3 text-display-sm text-fg">{t("title")}</h1>
        <p className="mt-4 text-body text-fg-secondary">{t("subtitle")}</p>
      </header>

      <SoftwareGallery apps={apps} />

      {apps.length > 0 && (
        <Reveal as="section" className="mt-28">
          <div className="mb-8 max-w-[42rem]">
            <h2 className="text-title text-fg">{t("deviceTitle")}</h2>
            <p className="mt-3 text-body text-fg-secondary">{t("deviceSub")}</p>
          </div>
          <DeviceShowcase apps={apps} />
        </Reveal>
      )}
    </main>
  );
}
