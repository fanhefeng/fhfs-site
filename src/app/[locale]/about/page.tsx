import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getAbout } from "@/lib/content";
import { localeAlternates } from "@/lib/seo";
import { Mdx } from "@/components/blog/Mdx";
import { Timeline } from "@/components/about/Timeline";
import { SectionTitle } from "@/components/deco/SectionTitle";
import { ArtDecoDivider } from "@/components/deco/ArtDecoDivider";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: localeAlternates("/about", locale),
  };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const about = getAbout(locale as Locale);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <SectionTitle title={t("title")} subtitle={t("subtitle")} />
      {about && <Mdx code={about.mdx} />}

      <h2 className="mb-2 mt-16 text-center font-deco text-2xl tracking-widest text-gold">
        {t("timeline")}
      </h2>
      <ArtDecoDivider className="mb-10" />
      <Timeline locale={locale as Locale} />
    </main>
  );
}
