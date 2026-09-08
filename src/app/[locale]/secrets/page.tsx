import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getSecrets } from "@/lib/content";
import { sectionMetadata } from "@/lib/seo";
import { Reveal } from "@/components/fx/Reveal";
import { RoomMusic } from "@/components/fx/RoomMusic";
import { SecretIndex } from "@/components/secrets/SecretIndex";

export const generateMetadata = sectionMetadata("secrets", "/secrets");

/**
 * 《不能说的秘密》— the essays and the episodes, as a table of contents at
 * the 720px measure, with the song of the same name on while the reader
 * is here. Empty until the first one is written: the page says so rather
 * than inventing a piece.
 */
export default async function SecretsPage({ params }: PageProps<"/[locale]/secrets">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("secrets");
  const tt = await getTranslations("tracks.secret");
  const tc = await getTranslations("common");
  const items = await getSecrets(locale);

  return (
    <main id="main" className="mx-auto w-full max-w-[720px] flex-1 px-6 pb-28 pt-32 md:pt-40">
      <Reveal as="section" className="mb-12">
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">{t("kicker")}</p>
        <h1 className="mt-3 text-display-sm">{t("title")}</h1>
        <p className="mt-4 max-w-[46ch] text-body text-fg-secondary">{t("subtitle")}</p>
        {items.length > 0 && (
          <p className="mt-5 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
            {t("count", { count: items.length })}
          </p>
        )}
        <RoomMusic
          track="secret"
          tonight={tc("tonight")}
          title={tt("title")}
          artist={tt("artist")}
          fallbackArtist={tt("fallbackArtist")}
          className="mt-6"
        />
      </Reveal>

      {items.length === 0 ? (
        <p className="text-body text-fg-secondary">{t("empty")}</p>
      ) : (
        <SecretIndex items={items} yearAria={(year) => t("yearAria", { year })} />
      )}
    </main>
  );
}
