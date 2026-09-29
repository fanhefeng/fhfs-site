import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page";
import { Link } from "@/i18n/navigation";
import { asset } from "@/lib/asset";
import { coverOf } from "@/lib/films";
import { inLocale } from "@/lib/localized";
import { getIdols } from "@/lib/server/content";
import { sectionMetadata } from "@/lib/server/seo";
import { Reveal } from "@/components/fx/Reveal";

export const generateMetadata = sectionMetadata("idols", "/idols");

/** The wall: one card per idol, the picture large and the name under it. */
export default async function IdolsPage({ params }: PageProps<"/[locale]/idols">) {
  const locale = await pageLocale(params);
  const t = await getTranslations("idols");
  const idols = (await getIdols()).map((idol) => inLocale(idol, locale));

  return (
    <main id="main" className="mx-auto w-full max-w-[720px] flex-1 px-6 pb-28 pt-32 md:pt-40">
      <Reveal as="section" className="mb-12">
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {t("kicker")}
        </p>
        <h1 className="mt-3 text-display-sm">{t("title")}</h1>
        <p className="mt-4 max-w-[46ch] text-body text-fg-secondary">{t("subtitle")}</p>
      </Reveal>

      <Reveal as="ul" stagger={0.06} className="grid gap-6 sm:grid-cols-2">
        {idols.map((idol, i) => {
          const cover = coverOf(idol.photos, idol.cover);
          return (
            <li key={idol.key}>
              <Link href={`/idols/${idol.key}`} className="group block">
                <span className="block overflow-hidden rounded-card bg-surface">
                  {cover ? (
                    <Image
                      src={asset(cover.src)}
                      width={cover.width}
                      height={cover.height}
                      alt={cover.alt}
                      sizes="(min-width: 640px) 340px, 100vw"
                      // The wall's first picture is the page's largest paint.
                      loading={i < 2 ? "eager" : undefined}
                      fetchPriority={i === 0 ? "high" : undefined}
                      className="aspect-[4/5] w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                    />
                  ) : (
                    <span className="block aspect-[4/5]" />
                  )}
                </span>
                <span className="mt-3 flex items-baseline justify-between gap-4">
                  <span className="text-heading text-fg transition-colors group-hover:text-accent">
                    {idol.name}
                  </span>
                  <span className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                    {idol.years}
                  </span>
                </span>
                <span className="mt-1 block font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                  {t("open")} →
                </span>
              </Link>
            </li>
          );
        })}
      </Reveal>
    </main>
  );
}
