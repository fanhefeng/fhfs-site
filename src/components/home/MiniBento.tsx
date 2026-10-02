import { Reveal } from "@/components/fx/Reveal";
import { SectionHeader } from "./SectionHeader";

export type BentoItem = {
  name: string;
  tagline: string;
  /** Already-translated category label ("Desktop", "工具", …). */
  category: string;
  /** The app's own site — these are real, shipped things. */
  href: string;
  /** Mono proof line under the tagline — version, platform, licence. */
  stat?: string;
};

type Props = {
  items: BentoItem[];
  title: string;
  viewAllLabel: string;
  /** Section number in the issue's running order — "01", "02", … */
  index?: string;
};

/**
 * Software, as a small bento: the first two entries take a double-wide card
 * with their one-liner, the remaining four sit in the small cells — one
 * glance for the whole shelf. The wide cards used to carry a CSS-drawn
 * schematic of the app beside the words; it was the same few bars for every
 * app of a category and is gone (DESIGN-LOG, 10-02).
 *
 * Paper cards, not glass: glass is reserved for floating layers, and this
 * grid sits flat on the page. The hover lift crossfades a second, softer
 * shadow layer instead of animating box-shadow.
 *
 * Server component — the only client code is the shared Reveal wrapper.
 */
export function MiniBento({ items, title, viewAllLabel, index }: Props) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="home-software">
      <SectionHeader
        id="home-software"
        title={title}
        href="/software"
        viewAllLabel={viewAllLabel}
        index={index}
      />

      <Reveal as="ul" stagger={0.06} className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {items.map((item, i) => {
          const wide = i < 2;
          return (
            <li key={item.name} className={wide ? "col-span-2" : "col-span-1"}>
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="group relative flex h-full min-h-[7rem] flex-col justify-between gap-3 rounded-card border border-line bg-surface-raised/70 p-4 shadow-card transition-transform duration-300 ease-out hover:-translate-y-1 focus-visible:-translate-y-1"
              >
                {/* Lift shadow, crossfaded over the resting one — for a
                    keyboard's focus as for a pointer's hover. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-card opacity-0 shadow-lift transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
                />
                <span className="relative flex flex-col gap-2">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-heading">{item.name}</span>
                    <span
                      aria-hidden="true"
                      className="font-mono text-meta text-fg-tertiary transition-colors group-hover:text-accent"
                    >
                      ↗
                    </span>
                  </span>
                  {wide ? (
                    <span className="text-caption text-fg-secondary">{item.tagline}</span>
                  ) : null}
                </span>
                <span className="relative flex items-baseline justify-between gap-2 font-mono text-meta text-fg-tertiary">
                  <span className="uppercase tracking-meta">{item.category}</span>
                  {item.stat ? <span className="tabular-nums">{item.stat}</span> : null}
                </span>
              </a>
            </li>
          );
        })}
      </Reveal>
    </section>
  );
}
