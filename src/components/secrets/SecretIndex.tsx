import { useTranslations } from "next-intl";
import type { SecretSummary } from "@/lib/server/content";
import { groupByYear, yearOfDate } from "@/lib/byYear";
import { htmlLang } from "@/i18n/routing";
import { IndexRow, YearSection } from "@/components/ui/YearIndex";

/**
 * The index of 《不能说的秘密》: one line per piece, title left, kind and
 * length and date right in mono. An episode says how long it runs; an essay,
 * how long it takes to read — the reader is choosing between the two.
 */
export function SecretIndex({
  items,
  yearAria,
}: {
  items: SecretSummary[];
  yearAria: (year: string) => string;
}) {
  const t = useTranslations("secrets");
  const length = (item: SecretSummary) =>
    item.kind === "podcast"
      ? item.duration != null
        ? t("duration", { minutes: item.duration })
        : null
      : t("readingTime", { minutes: item.readingMinutes });

  return groupByYear(items, yearOfDate).map(({ year, items: yearItems }) => (
    <YearSection key={year} label={yearAria(year)} heading={year}>
      {yearItems.map((item) => (
        <IndexRow
          key={item.slug}
          href={`/secrets/${item.slug}`}
          title={item.title}
          titleLang={item.isFallback ? htmlLang(item.locale) : undefined}
          date={item.date}
          tag={t(item.kind === "podcast" ? "kindPodcast" : "kindEssay")}
          detail={length(item)}
        />
      ))}
    </YearSection>
  ));
}
