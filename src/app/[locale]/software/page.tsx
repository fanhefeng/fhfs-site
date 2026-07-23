import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getApps } from "@/lib/content";
import { localeAlternates } from "@/lib/seo";
import { AppCard } from "@/components/cards/AppCard";
import { SectionTitle } from "@/components/deco/SectionTitle";

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

const CATEGORY_ORDER = ["desktop", "tool", "game", "website"] as const;

export default async function SoftwarePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("software");
  const apps = getApps();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <SectionTitle title={t("title")} subtitle={t("subtitle")} />
      <div className="flex flex-col gap-16">
        {CATEGORY_ORDER.map((category) => {
          const group = apps.filter((app) => app.category === category);
          if (group.length === 0) return null;
          return (
            <section key={category}>
              <h2 className="mb-6 flex items-center gap-4 font-deco text-xl tracking-[0.2em] text-gold">
                <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/40" />
                {t(`categories.${category}`)}
                <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/40" />
              </h2>
              <div className="grid gap-6 sm:grid-cols-2">
                {group.map((app) => (
                  <AppCard
                    key={app._meta.path}
                    app={app}
                    locale={locale as Locale}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
