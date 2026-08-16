import { Reveal } from "@/components/fx/Reveal";
import { AppMock } from "@/components/software/AppMock";
import type { SoftwareApp } from "@/components/software/appMeta";
import { SectionHeader } from "./SectionHeader";

export type BentoItem = {
  name: string;
  tagline: string;
  /** Already-translated category label ("Desktop", "工具", …). */
  category: string;
  /** The app's own site — these are real, shipped things. */
  href: string;
  /** When present, the wide cards draw the app's schematic UI instead of
   *  words alone — the shelf's two leads get to *look* like software. */
  mock?: SoftwareApp;
  /** Accessible description for the mock ("Portreaper 的界面示意图"). */
  mockLabel?: string;
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
 * with their one-liner and a live-drawn schematic of their UI, the remaining
 * four sit in the small cells — an Apple-keynote grid at column width, one
 * glance for the whole shelf. The schematic is the same zero-JS `AppMock`
 * the software page uses, so it crossfades with the gallery lights for free.
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

      <Reveal
        as="ul"
        stagger={0.06}
        className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        {items.map((item, i) => {
          const wide = i < 2;
          return (
            <li key={item.name} className={wide ? "col-span-2" : "col-span-1"}>
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="group relative flex h-full min-h-[7rem] flex-col justify-between gap-3 rounded-card border border-line bg-surface-raised/70 p-4 shadow-card transition-transform duration-300 ease-out hover:-translate-y-1"
              >
                {/* Lift shadow, crossfaded over the resting one. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-card opacity-0 shadow-lift transition-opacity duration-300 group-hover:opacity-100"
                />
                {wide && item.mock ? (
                  <span className="relative flex min-h-[6.5rem] gap-4">
                    <span className="flex min-w-0 flex-1 flex-col gap-2">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-heading">{item.name}</span>
                        <span
                          aria-hidden="true"
                          className="font-mono text-meta text-fg-tertiary transition-colors group-hover:text-accent"
                        >
                          ↗
                        </span>
                      </span>
                      <span className="text-caption text-fg-secondary">
                        {item.tagline}
                      </span>
                    </span>
                    <AppMock
                      app={item.mock}
                      label={item.mockLabel ?? item.name}
                      className="w-[38%] shrink-0 self-stretch rounded-[8px] border border-line"
                    />
                  </span>
                ) : (
                  <span className="relative flex items-start justify-between gap-2">
                    <span className="text-heading">{item.name}</span>
                    <span
                      aria-hidden="true"
                      className="font-mono text-meta text-fg-tertiary transition-colors group-hover:text-accent"
                    >
                      ↗
                    </span>
                  </span>
                )}
                <span className="relative flex items-baseline justify-between gap-2 font-mono text-meta text-fg-tertiary">
                  <span className="uppercase tracking-meta">{item.category}</span>
                  {item.stat ? (
                    <span className="tabular-nums">{item.stat}</span>
                  ) : null}
                </span>
              </a>
            </li>
          );
        })}
      </Reveal>
    </section>
  );
}
