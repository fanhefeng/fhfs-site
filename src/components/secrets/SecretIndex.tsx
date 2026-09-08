import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { SecretSummary } from "@/lib/content";
import { groupByYear, yearOfDate } from "@/lib/byYear";
import { Reveal } from "@/components/fx/Reveal";

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
  return groupByYear(items, yearOfDate).map(({ year, items: yearItems }) => (
    <section key={year} aria-label={yearAria(year)} className="mb-14 last:mb-0">
      <h2 className="mb-3 font-mono text-meta uppercase tracking-meta text-fg-tertiary tabular-nums">
        {year}
      </h2>
      <Reveal as="ol" stagger={0.05} className="border-t border-line">
        {yearItems.map((item) => (
          <SecretLine key={item.slug} item={item} />
        ))}
      </Reveal>
    </section>
  ));
}

function SecretLine({ item }: { item: SecretSummary }) {
  const t = useTranslations("secrets");
  const [, month, day] = item.date.split("-");
  const length =
    item.kind === "podcast"
      ? item.duration != null
        ? t("duration", { minutes: item.duration })
        : null
      : t("readingTime", { minutes: item.readingMinutes });

  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        href={`/secrets/${item.slug}`}
        className="group flex min-h-11 items-baseline gap-4 py-3.5 sm:gap-8"
      >
        <span className="relative flex-1 text-[1.3125rem] leading-snug font-medium tracking-[-0.01em] text-fg">
          {item.title}
          <span
            aria-hidden
            className="absolute inset-x-0 -bottom-0.5 block h-px origin-left scale-x-0 bg-accent transition-transform duration-[250ms] ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
          />
        </span>
        <span className="flex shrink-0 items-baseline gap-3 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          <span className="text-accent">{t(item.kind === "podcast" ? "kindPodcast" : "kindEssay")}</span>
          {length && (
            <span className="hidden translate-x-1 opacity-0 transition duration-[250ms] ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 sm:inline-block">
              {length}
            </span>
          )}
          <time dateTime={item.date} className="tabular-nums">
            {month}.{day}
          </time>
        </span>
      </Link>
    </li>
  );
}
