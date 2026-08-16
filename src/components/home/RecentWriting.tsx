import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/fx/Reveal";
import { SectionHeader } from "./SectionHeader";

export type WritingItem = {
  slug: string;
  title: string;
  /** Pre-formatted, mono-friendly: 2026.03.14 */
  date: string;
  /** Pre-translated "6 min read" — the page owns the pluralisation. */
  readingTime: string;
};

type Props = {
  items: WritingItem[];
  title: string;
  viewAllLabel: string;
  /** Section number in the issue's running order — "01", "02", … */
  index?: string;
};

/**
 * Recent writing — a plain text index, the way a magazine lists its contents:
 * title left, mono date right, no cards, no covers. The reading time is the
 * one thing that waits for interest: on a hovering pointer it fades in beside
 * the date, on touch it is simply always there.
 *
 * Server component on purpose — the only client code here is the shared
 * Reveal wrapper, so the list itself ships no JavaScript.
 */
export function RecentWriting({ items, title, viewAllLabel, index }: Props) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="home-writing">
      <SectionHeader
        id="home-writing"
        title={title}
        href="/blog"
        viewAllLabel={viewAllLabel}
        index={index}
      />

      <Reveal as="ul" stagger={0.06}>
        {items.map((item) => (
          <li key={item.slug} className="border-b border-line last:border-b-0">
            <Link
              href={`/blog/${item.slug}`}
              className="group flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-4"
            >
              <span className="flex-1 text-heading underline decoration-transparent decoration-1 underline-offset-4 transition-colors duration-[250ms] group-hover:decoration-accent">
                {item.title}
              </span>
              <span className="flex shrink-0 items-baseline gap-3 font-mono text-meta text-fg-tertiary">
                {/* Reading time waits for interest where hovering exists; on
                    touch there is nothing to hover, so it just stays. */}
                <span className="transition-opacity duration-200 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
                  {item.readingTime}
                </span>
                <span className="tabular-nums">{item.date}</span>
              </span>
            </Link>
          </li>
        ))}
      </Reveal>
    </section>
  );
}
