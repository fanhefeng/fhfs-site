import Image from "next/image";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { sectionMetadata } from "@/lib/seo";
import { IDOLS } from "@/components/idols/entries";
import { Reveal } from "@/components/fx/Reveal";

export const generateMetadata = sectionMetadata("idols", "/idols");

/** The wall: one card per idol, the picture large and the name under it. */
export default async function IdolsPage({ params }: PageProps<"/[locale]/idols">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("idols");

  return (
    <main id="main" className="mx-auto w-full max-w-[720px] flex-1 px-6 pb-28 pt-32 md:pt-40">
      <Reveal as="section" className="mb-12">
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">{t("kicker")}</p>
        <h1 className="mt-3 text-display-sm">{t("title")}</h1>
        <p className="mt-4 max-w-[46ch] text-body text-fg-secondary">{t("subtitle")}</p>
      </Reveal>

      <Reveal as="ul" stagger={0.06} className="grid gap-6 sm:grid-cols-2">
        {IDOLS.map((idol) => (
          <li key={idol.slug}>
            <Link href={`/idols/${idol.slug}`} className="group block">
              <span className="block overflow-hidden rounded-card bg-surface">
                <Image
                  src={idol.cover.src}
                  width={idol.cover.width}
                  height={idol.cover.height}
                  alt={t(idol.cover.altKey)}
                  sizes="(min-width: 640px) 340px, 100vw"
                  // The wall's first picture is the page's largest paint.
                  loading="eager"
                  fetchPriority="high"
                  className="aspect-[4/5] w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                />
              </span>
              <span className="mt-3 flex items-baseline justify-between gap-4">
                <span className="text-heading text-fg transition-colors group-hover:text-accent">
                  {t(`${idol.key}.name`)}
                </span>
                <span className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                  {t(`${idol.key}.years`)}
                </span>
              </span>
              <span className="mt-1 block font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                {t("open")} →
              </span>
            </Link>
          </li>
        ))}
      </Reveal>
    </main>
  );
}
