import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page";
import { getApps } from "@/lib/content";
import { getLatestReleases } from "@/lib/github";
import { sectionMetadata } from "@/lib/seo";
import { SoftwareGallery } from "@/components/software/SoftwareGallery";
import { DeviceShowcase } from "@/components/software/DeviceShowcase";
import { toSoftwareApp } from "@/components/software/appMeta";
import { Reveal } from "@/components/fx/Reveal";

export const generateMetadata = sectionMetadata("software", "/software");

/**
 * Software — the keynote bento, then the same apps framed on a Mac and an
 * iPhone, one channel at a time. Stays a Server Component: the apps come out
 * of the cached `getApps()` read, their latest versions out of GitHub, and
 * both are flattened to a plain payload (localized strings, CTA key, accent
 * hue, version) before crossing into the client islands, so nothing about
 * the data is client work. The device frames used to open the portfolio;
 * that page is gone, and this is the one shelf everything made stands on.
 */
export default async function SoftwarePage({ params }: PageProps<"/[locale]/software">) {
  const locale = await pageLocale(params);
  const t = await getTranslations("software");

  const rows = await getApps();
  const releases = await getLatestReleases(rows.map((app) => app.repo));
  const apps = rows.map((app, i) => ({
    ...toSoftwareApp(app, i, locale),
    version: app.repo ? releases.get(app.repo)?.version : undefined,
  }));

  return (
    <main id="main" className="mx-auto w-full max-w-[1040px] flex-1 px-6 pb-24 pt-16 sm:pt-20">
      <header className="mb-12 max-w-[42rem]">
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {t("kicker")}
        </p>
        <h1 className="mt-3 text-display-sm text-fg">{t("title")}</h1>
        <p className="mt-4 text-body text-fg-secondary">{t("subtitle")}</p>
      </header>

      <SoftwareGallery apps={apps} />

      {apps.length > 0 && (
        <Reveal as="section" className="pt-24">
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
