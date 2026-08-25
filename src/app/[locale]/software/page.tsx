import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getApps } from "@/lib/content";
import { getLatestReleases } from "@/lib/github";
import { sectionMetadata } from "@/lib/seo";
import { SoftwareGallery } from "@/components/software/SoftwareGallery";
import { toSoftwareApp } from "@/components/software/appMeta";

export const generateMetadata = sectionMetadata("software", "/software");

/**
 * Software — the keynote bento, and nothing after it. Stays a Server
 * Component: the apps come out of the cached `getApps()` read, their latest
 * versions out of GitHub, and both are flattened to a plain payload
 * (localized strings, CTA key, accent hue, version) before crossing into the
 * client island, so nothing about the data is client work. The device frames
 * that used to follow the grid now open the portfolio instead.
 */
export default async function SoftwarePage({ params }: PageProps<"/[locale]/software">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("software");

  const rows = await getApps();
  const releases = await getLatestReleases(rows.map((app) => app.repo));
  const apps = rows.map((app, i) => ({
    ...toSoftwareApp(app, i, locale),
    version: app.repo ? releases.get(app.repo)?.version : undefined,
  }));

  return (
    <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-6 pb-24 pt-16 sm:pt-20">
      <header className="mb-12 max-w-[42rem]">
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {t("kicker")}
        </p>
        <h1 className="mt-3 text-display-sm text-fg">{t("title")}</h1>
        <p className="mt-4 text-body text-fg-secondary">{t("subtitle")}</p>
      </header>

      <SoftwareGallery apps={apps} />
    </main>
  );
}
