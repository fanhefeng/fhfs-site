import { getTranslations } from "next-intl/server";
import { htmlLang, type Locale } from "@/i18n/routing";
import { getMoments, type Moment } from "@/lib/content";
import { stampInZone } from "@/lib/moments";
import { site } from "@/config/site";
import { newestLabEntry } from "@/components/lab/entries";
import type { GroveCardData } from "./GroveCard";

/**
 * The two cards standing in the grove, built once for both places the grove
 * is mounted — the home page and the lab study of its approach. They are rooms
 * the issue below the cover does not reach, each shown by one real thing from
 * inside it rather than a count of what is there: the newest study in the
 * lab, and the newest line on the moments board.
 */
export async function groveCards(locale: Locale): Promise<[GroveCardData, GroveCardData]> {
  const th = await getTranslations({ locale, namespace: "grove" });
  const tl = await getTranslations({ locale, namespace: "lab" });
  const study = newestLabEntry();
  const studyName = tl(`items.${study.key}.name`);
  /** The newest line on the board by the clock — not the pinned one, which
   *  getMoments puts first for the board's own sake. */
  const said = (await getMoments()).reduce<Moment | undefined>(
    (newest, moment) => (!newest || moment.postedAt > newest.postedAt ? moment : newest),
    undefined,
  );
  return [
    {
      label: th("cardLabLabel"),
      title: studyName,
      href: `/${locale}/lab/${study.slug}`,
      note: {
        text: tl(`items.${study.key}.summary`),
        stamp: study.added.replaceAll("-", "."),
      },
      linkLabel: th("cardLabLink", { name: studyName }),
    },
    {
      label: th("cardNoteLabel"),
      title: th("cardNoteTitle"),
      href: `/${locale}/moments`,
      note: {
        text: said?.content ?? "",
        stamp: said ? stampInZone(said.postedAt, site.timeZone).time : "",
        // The board is written in Chinese only.
        lang: locale === "zh" ? undefined : htmlLang("zh"),
      },
      linkLabel: th("cardNoteLink"),
    },
  ];
}
