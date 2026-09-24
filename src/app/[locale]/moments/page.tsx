import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page";
import { site } from "@/config/site";
import { asset } from "@/lib/asset";
import { getMoments } from "@/lib/content";
import { stampInZone, type BoardMoment, type MomentMedia } from "@/lib/moments";
import { sectionMetadata } from "@/lib/seo";
import { Reveal } from "@/components/fx/Reveal";
import { RadialFab } from "@/components/fx/RadialFab";
import { RoomMusic } from "@/components/fx/RoomMusic";
import { MomentBoard } from "@/components/moments/MomentBoard";

export const generateMetadata = sectionMetadata("moments", "/moments");

/** The files under a line, at the addresses the browser fetches: hashed for
 *  the ones in `public/`, as they are for a video in the Blob store (`asset()`
 *  hands back anything outside the immutable folders unchanged). */
const resolveMedia = (item: MomentMedia): MomentMedia =>
  item.kind === "video"
    ? { ...item, src: asset(item.src), poster: asset(item.poster) }
    : { ...item, src: asset(item.src) };

/**
 * 峰言峰语 — the board. A 720px column like the rest of the issue, and its own
 * record on while the reader is here (`RoomMusic`): Lovely Day, which is
 * about the mood of the page rather than its name. The instants are formatted
 * here, in the site's zone, so the board never has to know what a Date is.
 */
export default async function MomentsPage({ params }: PageProps<"/[locale]/moments">) {
  await pageLocale(params);
  const t = await getTranslations("moments");
  const tt = await getTranslations("tracks.lovely");
  const tc = await getTranslations("common");

  const rows = await getMoments();
  const items: BoardMoment[] = rows.map((row) => ({
    key: row.key,
    content: row.content,
    media: row.media.map(resolveMedia),
    // Year and hour in the site's zone — the one the lines were written in.
    ...stampInZone(row.postedAt, site.timeZone),
    dateTime: row.postedAt,
    collection: row.collection,
    original: row.original,
    attribution: row.attribution,
    source: row.source,
    pinned: row.pinned,
  }));
  const langNotice = t("langNotice");

  return (
    <>
      <main id="main" className="mx-auto w-full max-w-[720px] flex-1 px-6 pb-28 pt-32 md:pt-40">
        <Reveal as="section" className="mb-10">
          <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
            {t("kicker")}
          </p>
          <h1 className="mt-3 text-display-sm">{t("title")}</h1>
          <p className="mt-4 max-w-[46ch] text-body text-fg-secondary">{t("subtitle")}</p>
          {langNotice && (
            <p className="mt-3 max-w-[46ch] text-caption text-fg-tertiary">{langNotice}</p>
          )}
          {items.length > 0 && (
            <p className="mt-5 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
              {t("count", { count: items.length })}
            </p>
          )}
          <RoomMusic
            track="lovely"
            tonight={tc("tonight")}
            title={tt("title")}
            artist={tt("artist")}
            className="mt-6"
          />
        </Reveal>

        {items.length === 0 ? (
          <p className="text-body text-fg-secondary">{t("empty")}</p>
        ) : (
          <MomentBoard items={items} />
        )}
      </main>
      {/* The longest page on the site, with its filter at the very top: on a
        phone the article pages' quick actions — back to top among them — are
        the way back up. (Desktop has the island; see RadialFab.) */}
      <RadialFab shareTitle={t("title")} feed={false} />
    </>
  );
}
