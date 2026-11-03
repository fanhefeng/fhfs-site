import { useTranslations } from "next-intl";
import type { PostSummary } from "@/lib/server/content";
import { groupByYear, yearOfDate } from "@/lib/byYear";
import { htmlLang } from "@/i18n/routing";
import { IndexRow, YearSection } from "@/components/ui/YearIndex";

/** The year-bucketed index — /blog and every tag page render this list. */
export function YearIndex({
  posts,
  yearAria,
}: {
  posts: PostSummary[];
  yearAria: (year: string) => string;
}) {
  const t = useTranslations("blog");
  const tn = useTranslations("notebook");
  return groupByYear(posts, yearOfDate).map(({ year, items }) => (
    <YearSection
      key={year}
      label={year ? yearAria(year) : tn("undated")}
      heading={year || tn("undated")}
    >
      {items.map((post) => (
        <IndexRow
          key={post.slug}
          href={`/blog/${post.slug}`}
          title={post.title}
          titleLang={post.isFallback ? htmlLang(post.locale) : undefined}
          date={post.date}
          detail={t("readingTime", { minutes: post.readingMinutes })}
        />
      ))}
    </YearSection>
  ));
}
