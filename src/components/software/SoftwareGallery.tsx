"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Flip, gsap, useGSAP } from "@/lib/gsap";
import { AppCard } from "@/components/cards/AppCard";
import { SegmentedFilter, type Segment } from "./SegmentedFilter";
import { MobileAppRail } from "./MobileAppRail";
import { APP_CATEGORIES, type AppFilter, type SoftwareApp } from "./appMeta";

type FlipState = ReturnType<typeof Flip.getState>;

/**
 * The bento itself. Every app stays in the DOM for the whole session; the
 * filter only flips cells between `display: grid`-flow and `display: none`,
 * and Flip replays the difference so surviving cards slide from wherever they
 * were rather than teleporting into a fresh layout — the point of the whole
 * interaction is that you can follow a card with your eye.
 *
 * The data is static (built by the server page); only the selection is
 * client state, so no fetch, no re-render of card content.
 */
export function SoftwareGallery({ apps }: { apps: SoftwareApp[] }) {
  const t = useTranslations("software");
  const [filter, setFilter] = useState<AppFilter>("all");
  const gridRef = useRef<HTMLDivElement>(null);
  /** Layout captured in the click handler, consumed by the layout effect. */
  const pending = useRef<FlipState | null>(null);

  const options = useMemo<Segment[]>(
    () => [
      { value: "all", label: t("filterAll") },
      ...APP_CATEGORIES.filter((c) => apps.some((a) => a.category === c)).map((c) => ({
        value: c,
        label: t(`categories.${c}`),
      })),
    ],
    [apps, t]
  );

  const visible = useMemo(
    () => apps.filter((a) => filter === "all" || a.category === filter),
    [apps, filter]
  );

  const change = useCallback((next: string) => {
    const grid = gridRef.current;
    // Capture *before* React re-renders — this is the "previous state" the
    // cards inherit their positions from. `offsetParent` is null while the
    // grid is display:none (phones show the rail instead), and there is
    // nothing to reshuffle then.
    if (grid && grid.offsetParent !== null) {
      pending.current = Flip.getState(grid.querySelectorAll("[data-flip-item]"));
    }
    setFilter(next as AppFilter);
  }, []);

  // Runs in the layout phase after the filter render, so nothing paints in
  // the new positions before Flip pins them back to the old ones.
  useGSAP(
    () => {
      const state = pending.current;
      if (!state) return;
      pending.current = null;
      Flip.from(state, {
        duration: 0.55,
        ease: "power2.inOut",
        absolute: true,
        stagger: 0.03,
        onEnter: (els) =>
          gsap.fromTo(
            els,
            { autoAlpha: 0, scale: 0.94 },
            { autoAlpha: 1, scale: 1, duration: 0.4, ease: "power2.out" }
          ),
        onLeave: (els) =>
          gsap.to(els, { autoAlpha: 0, scale: 0.94, duration: 0.25, ease: "power2.in" }),
      });
    },
    // revertOnUpdate so a half-played reshuffle is torn down before the next
    // one starts (rapid clicking through the segments). The state was already
    // captured in the click handler, so reverting here costs nothing.
    { dependencies: [filter], scope: gridRef, revertOnUpdate: true }
  );

  // Site-wide scroll entrance, bento flavour: stagger .06 across the cells.
  useGSAP(
    () => {
      const grid = gridRef.current;
      if (!grid) return;
      const mm = gsap.matchMedia();
      // Gated on the breakpoint too: below md the grid is display:none, and
      // ScrollTrigger would measure a zero-height trigger.
      mm.add("(min-width: 768px)", () => {
        gsap.from(grid.querySelectorAll("[data-flip-item]"), {
          y: 24,
          autoAlpha: 0,
          duration: 0.6,
          ease: "power2.out",
          stagger: 0.06,
          // Leave nothing inline behind — Flip measures these elements next.
          clearProps: "transform,opacity,visibility",
          scrollTrigger: { trigger: grid, start: "top 85%", once: true },
        });
      });
    },
    { scope: gridRef }
  );

  return (
    <div>
      <div className="mb-8 flex items-center justify-between gap-4">
        <SegmentedFilter
          options={options}
          value={filter}
          onChange={change}
          ariaLabel={t("filterAria")}
        />
        <p
          aria-live="polite"
          className="hidden shrink-0 font-mono text-meta uppercase tracking-meta text-fg-tertiary sm:block"
        >
          {t("count", { count: visible.length })}
        </p>
      </div>

      {/* Desktop/tablet: the bento. `relative` is required for Flip's
       * absolute-positioning pass during the reshuffle. */}
      <div
        ref={gridRef}
        className="relative hidden grid-cols-2 gap-4 md:grid lg:grid-cols-3"
      >
        {apps.map((app, i) => {
          const shown = filter === "all" || app.category === filter;
          return (
            <div
              key={app.id}
              data-flip-item
              // The lead app is the keynote tile — two columns wide.
              // h-full so a short card still fills its grid row rather than
              // leaving a hole under it.
              className={i === 0 ? "col-span-2 h-full" : "h-full"}
              style={shown ? undefined : { display: "none" }}
            >
              <AppCard app={app} index={i} variant={i === 0 ? "feature" : "tile"} />
            </div>
          );
        })}
      </div>

      {/* Phones get the same set as a swipeable rail. */}
      <MobileAppRail apps={visible} className="md:hidden" />

      {visible.length === 0 && (
        <p className="py-10 text-center text-body text-fg-secondary">{t("empty")}</p>
      )}
    </div>
  );
}
