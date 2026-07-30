import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getWorks } from "@/lib/content";
import { localeAlternates } from "@/lib/seo";
import { WorkCard } from "@/components/cards/WorkCard";
import { SectionTitle } from "@/components/deco/SectionTitle";
import { PosterLightbox } from "@/components/portfolio/PosterLightbox";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "portfolio" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: localeAlternates("/portfolio", locale),
  };
}

export default async function PortfolioPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("portfolio");
  const works = getWorks();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <SectionTitle title={t("title")} subtitle={t("subtitle")} />
      <PosterLightbox kicker={t("lightboxKicker")} />
      {works.length === 0 ? (
        <p className="text-center text-muted-fg">{t("empty")}</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {works.map((work) => (
            <WorkCard
              key={work._meta.path}
              work={work}
              locale={locale as Locale}
            />
          ))}
        </div>
      )}
    </main>
  );
}
