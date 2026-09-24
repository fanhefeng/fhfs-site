import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/fx/Reveal";
import { SectionHeader } from "./SectionHeader";

export type NowItem = {
  /** Which room it came from — the door's own name: 峰言峰语 / 实验室 / 软件. */
  label: string;
  /** The thing itself: the line that was said, the study's name, the release. */
  title: string;
  /** Set when the title is in the other language (the board is written in Chinese). */
  lang?: string;
  /** Mono, pre-formatted: 2026.09.22 15:57, or 2026.09.19. */
  stamp: string;
  href: string;
  /** A release page on GitHub opens in a new tab; the rooms don't need to. */
  external?: boolean;
};

type Props = {
  items: NowItem[];
  title: string;
  /** Section number in the issue's running order — "03". */
  index?: string;
};

/**
 * Now — the newest thing in each of the rooms the issue above does not reach:
 * the last line said on the board, the study that went up last, the most
 * recent release. One row each, in the index's own voice: a mono kicker for
 * the room, the thing itself, its stamp on the right. These three used to be
 * the cards standing in the grove on the cover; the grove has gone back to
 * the lab, and the cards became rows.
 *
 * Server component — the only client code is the shared Reveal wrapper.
 */
export function NowStrip({ items, title, index }: Props) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="home-now">
      <SectionHeader id="home-now" title={title} index={index} />

      <Reveal as="ul" stagger={0.06}>
        {items.map((item) => {
          const inner = (
            <>
              <span className="w-24 shrink-0 font-mono text-meta uppercase tracking-meta text-fg-tertiary sm:pt-1">
                {item.label}
              </span>
              <span
                lang={item.lang}
                className="line-clamp-2 flex-1 text-heading underline decoration-transparent decoration-1 underline-offset-4 transition-colors duration-[250ms] group-hover:decoration-accent"
              >
                {item.title}
              </span>
              <span className="shrink-0 font-mono text-meta text-fg-tertiary tabular-nums sm:pt-1">
                {item.stamp}
                {item.external ? <span aria-hidden="true"> ↗</span> : null}
              </span>
            </>
          );
          const className = "group flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-4";
          return (
            <li key={item.href} className="border-b border-line last:border-b-0">
              {item.external ? (
                <a href={item.href} target="_blank" rel="noreferrer" className={className}>
                  {inner}
                </a>
              ) : (
                <Link href={item.href} className={className}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </Reveal>
    </section>
  );
}
