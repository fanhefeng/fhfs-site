"use client";

import { useRef } from "react";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";

/** One release of a person. The page localizes before handing it over. */
export type ChangelogEntry = {
  id: string;
  /** "5.1" — rendered as `fhf 5.1` in Geist Mono. */
  version: string;
  /** ISO day, or the localized placeholder when the real date is unknown. */
  dateText: string;
  /** Four-digit year for the rail, or a dash when there is no date. */
  year: string;
  /** Accessible name for the node button ("Released 2026-07-31"). */
  dateAria: string;
  title: string;
  note: string;
};

type Props = {
  entries: ChangelogEntry[];
  title: string;
  ariaLabel: string;
  className?: string;
};

/**
 * A life numbered like software. Version + date + one sentence per glass
 * note card, newest first.
 *
 * Two pieces of motion, both of them wayfinding rather than decoration:
 * - the year rail is a single window onto a stack of years that snaps as
 *   entries pass the middle of the viewport (Family-style number roll), so
 *   the reader always knows *when* they are;
 * - each node pops a tooltip with the exact date on hover/focus, entering on
 *   `back.out` and leaving on the reversed ease at 2.2x — arrive generously,
 *   leave briskly.
 */
export function Changelog({ entries, title, ariaLabel, className }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  /* Collapse consecutive duplicate years into one rail row, and remember
   * which row every entry points at. */
  const rows: string[] = [];
  const rowOfEntry: number[] = [];
  for (const entry of entries) {
    if (rows.length === 0 || rows[rows.length - 1] !== entry.year) {
      rows.push(entry.year);
    }
    rowOfEntry.push(rows.length - 1);
  }

  useGSAP(
    () => {
      const root = rootRef.current;
      const strip = stripRef.current;
      if (!root) return;

      const items = gsap.utils.toArray<HTMLElement>("[data-entry]", root);

      /* --- year rail ------------------------------------------------------
       * One ScrollTrigger per entry; whichever entry owns the middle band of
       * the viewport decides the year. */
      if (strip && rows.length > 1) {
        const rowHeight = (strip.firstElementChild as HTMLElement | null)
          ?.offsetHeight;
        let current = 0;
        const snapTo = (row: number) => {
          if (row === current || !rowHeight) return;
          current = row;
          gsap.to(strip, {
            y: -row * rowHeight,
            duration: 0.5,
            ease: "power3.out",
            overwrite: "auto",
          });
        };
        items.forEach((el, i) => {
          ScrollTrigger.create({
            trigger: el,
            start: "top 55%",
            end: "bottom 55%",
            onToggle: (self) => {
              if (self.isActive) snapTo(rowOfEntry[i] ?? 0);
            },
          });
        });
      }

      /* --- card entrance + node tooltips ---------------------------------- */
      gsap.from(items, {
        y: 24,
        autoAlpha: 0,
        duration: 0.6,
        ease: "power2.out",
        stagger: 0.06,
        clearProps: "transform,opacity,visibility",
        scrollTrigger: { trigger: root, start: "top 85%", once: true },
      });

      const teardown: Array<() => void> = [];
      for (const el of items) {
        const node = el.querySelector<HTMLElement>("[data-node]");
        const tip = el.querySelector<HTMLElement>("[data-tip]");
        if (!node || !tip) continue;

        // Grows out of the node itself; anchored left so a narrow phone
        // never pushes the bubble off the edge of the screen.
        gsap.set(tip, { autoAlpha: 0, y: 6, scale: 0.9, transformOrigin: "0% 100%" });
        const pop = gsap.to(tip, {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.45,
          // Arrive with a little overshoot, leave on the reversed ease.
          ease: "back.out(2.4)",
          easeReverse: "power2.in",
          paused: true,
        });

        const show = () => pop.timeScale(1).play();
        const hide = () => pop.timeScale(2.2).reverse();

        node.addEventListener("pointerenter", show);
        node.addEventListener("focus", show);
        node.addEventListener("click", show);
        node.addEventListener("pointerleave", hide);
        node.addEventListener("blur", hide);
        teardown.push(() => {
          node.removeEventListener("pointerenter", show);
          node.removeEventListener("focus", show);
          node.removeEventListener("click", show);
          node.removeEventListener("pointerleave", hide);
          node.removeEventListener("blur", hide);
          pop.kill();
        });
      }

      return () => {
        for (const off of teardown) off();
      };
    },
    // revertOnUpdate: without it the teardown above is deferred to unmount, so
    // a change in entry count would stack a second trigger, tween and listener
    // set on every node.
    { scope: rootRef, dependencies: [entries.length], revertOnUpdate: true }
  );

  return (
    <section className={className} aria-labelledby="changelog-title">
      <h2
        id="changelog-title"
        className="mb-8 font-mono text-meta uppercase tracking-meta text-fg-tertiary"
      >
        {title}
      </h2>

      <div ref={rootRef} className="flex gap-6">
        {/* Year rail — a one-row window onto a stack of years. */}
        <div aria-hidden="true" className="hidden w-[4.5rem] shrink-0 sm:block">
          <div className="sticky top-28 h-10 overflow-hidden">
            <div ref={stripRef} className="will-change-transform">
              {rows.map((year, i) => (
                <div
                  key={`${year}-${i}`}
                  className="h-10 font-mono text-[2rem] leading-10 text-fg-tertiary [font-variant-numeric:tabular-nums]"
                >
                  {year}
                </div>
              ))}
            </div>
          </div>
        </div>

        <ol
          aria-label={ariaLabel}
          className="relative min-w-0 flex-1 space-y-5 before:absolute before:bottom-6 before:left-[7px] before:top-6 before:w-px before:bg-line before:content-['']"
        >
          {entries.map((entry) => (
            <li key={entry.id} data-entry className="relative pl-8">
              {/* Node + date tooltip. The button carries the date as its
                  accessible name, so the bubble itself stays decorative.
                  hit-ext's default -10px inset would leave this 14px dot at
                  34px, so the pseudo is widened to clear 44px. */}
              <button
                type="button"
                data-node
                aria-label={entry.dateAria}
                className="hit-ext absolute left-0 top-7 z-10 h-3.5 w-3.5 rounded-full border border-line bg-surface-raised shadow-card [&::before]:-inset-[15px]"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-[3px] rounded-full bg-accent"
                />
                <span
                  data-tip
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-full left-0 mb-2 whitespace-nowrap rounded-chip bg-fg px-2.5 py-1 font-mono text-[11px] tracking-meta text-bg shadow-card [font-variant-numeric:tabular-nums]"
                >
                  {entry.dateText}
                </span>
              </button>

              <article className="glass-thin rounded-card px-5 py-5 sm:px-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-[0.9375rem] tracking-[0.04em] text-accent">
                    fhf {entry.version}
                  </span>
                  {/* The rail is desktop-only, so small screens read the date
                      here rather than behind a hover. */}
                  <span className="font-mono text-meta tracking-meta text-fg-tertiary [font-variant-numeric:tabular-nums] sm:hidden">
                    {entry.dateText}
                  </span>
                </div>
                <h3 className="vibrancy mt-2 text-heading">{entry.title}</h3>
                <p className="mt-1.5 text-caption leading-relaxed text-fg-secondary">
                  {entry.note}
                </p>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
