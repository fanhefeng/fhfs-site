import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { site } from "@/config/site";
import { getMoments } from "@/lib/content";
import { stampInZone, type BoardMoment } from "@/lib/moments";
import { sectionMetadata } from "@/lib/seo";
import { Reveal } from "@/components/fx/Reveal";
import { RoomMusic } from "@/components/fx/RoomMusic";
import { MomentBoard } from "@/components/moments/MomentBoard";

export const generateMetadata = sectionMetadata("moments", "/moments");

/**
 * 《多的是你不知道的事》— the board. A 680px column like the rest of the
 * issue, and its own record on: the song the page is named after plays
 * while the reader is here (`RoomMusic`). The instants are formatted here,
 * in the site's zone, so the board never has to know what a Date is.
 */
export default async function MomentsPage({ params }: PageProps<"/[locale]/moments">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("moments");
  const tt = await getTranslations("tracks.unknown");
  const tc = await getTranslations("common");

  const rows = await getMoments();
  const items: BoardMoment[] = rows.map((row) => ({
    key: row.key,
    content: row.content,
    // Year and hour in the site's zone — the one the lines were written in.
    ...stampInZone(row.postedAt, site.timeZone),
    dateTime: row.postedAt,
    collection: row.collection,
    original: row.original,
    attribution: row.attribution,
    source: row.source,
  }));
  const langNotice = t("langNotice");

  return (
    <main id="main" className="mx-auto w-full max-w-[680px] flex-1 px-6 pb-28 pt-32 md:pt-40">
      <Reveal as="section" className="mb-10">
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">{t("kicker")}</p>
        <h1 className="mt-3 text-display-sm">{t("title")}</h1>
        <p className="mt-4 max-w-[46ch] text-body text-fg-secondary">{t("subtitle")}</p>
        {langNotice && <p className="mt-3 max-w-[46ch] text-caption text-fg-tertiary">{langNotice}</p>}
        {items.length > 0 && (
          <p className="mt-5 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
            {t("count", { count: items.length })}
          </p>
        )}
        <RoomMusic
          track="unknown"
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
        <MomentBoard items={items} />
      )}
    </main>
  );
}
