"use client";

import { useCallback, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { gsap, useGSAP, EASE } from "@/lib/gsap";
import { captureGrid, playGrid, type GridState } from "@/lib/flipGrid";
import { REVEAL_START, REVEAL_VARS } from "@/components/fx/Reveal";
import { useUrlChoice } from "@/lib/useUrlChoice";
import { AppCard } from "@/components/cards/AppCard";
import { SegmentedFilter, type Segment } from "./SegmentedFilter";
import { MobileAppRail } from "./MobileAppRail";
import { APP_CATEGORIES, type AppFilter, type SoftwareApp } from "./appMeta";

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
  const categories = useMemo(
    () => APP_CATEGORIES.filter((c) => apps.some((a) => a.category === c)),
    [apps],
  );
  // The selection is in the address bar (`?cat=…`), so a reload or a shared
  // link keeps it. A choice that arrives with the URL has no "before" for Flip
  // to play from — `pending` is empty — and the cards are simply there.
  const [choice, choose] = useUrlChoice("cat", categories);
  const filter: AppFilter = (choice as AppFilter | null) ?? "all";
  const gridRef = useRef<HTMLDivElement>(null);
  /** Layout captured in the click handler, consumed by the layout effect. */
  const pending = useRef<GridState | null>(null);
  /** How tall the grid stood at that same moment. */
  const pendingHeight = useRef(0);

  const options = useMemo<Segment[]>(
    () => [
      { value: "all", label: t("filterAll") },
      ...categories.map((c) => ({ value: c, label: t(`categories.${c}`) })),
    ],
    [categories, t],
  );

  const visible = useMemo(
    () => apps.filter((a) => filter === "all" || a.category === filter),
    [apps, filter],
  );

  const change = useCallback(
    (next: string) => {
      const grid = gridRef.current;
      // Capture *before* React re-renders — this is the "previous state" the
      // cards inherit their positions from. `offsetParent` is null while the
      // grid is display:none (phones show the rail instead), and there is
      // nothing to reshuffle then.
      if (grid && grid.offsetParent !== null) {
        // The height first: the capture finishes a flip that is still running
        // on these cards, which lets go of the height that flip was holding.
        // Read after it, a second click mid-flight would start from the
        // settled box rather than from where the box actually stands. The
        // height's own tween is stopped with it, or it would go on writing.
        pendingHeight.current = grid.offsetHeight;
        gsap.killTweensOf(grid);
        pending.current = captureGrid(grid.querySelectorAll("[data-flip-item]"));
      }
      choose(next === "all" ? null : next);
    },
    [choose],
  );

  // Runs in the layout phase after the filter render, so nothing paints in
  // the new positions before Flip pins them back to the old ones.
  useGSAP(
    () => {
      const state = pending.current;
      const grid = gridRef.current;
      if (!state || !grid) return;
      pending.current = null;
      // The grid's own height travels with the cards, and has to be held by
      // hand: `absolute: true` lifts every card out of the flow for as long as
      // the flip runs, and a grid with nothing left in its flow is 0px tall —
      // the footer jumped up under the cards and back down when they landed.
      // The new layout's natural height can only be read here, before Flip
      // takes the cards out. The height is held even when it does not change,
      // and let go by the flip's own `onComplete` rather than the tween's: the
      // stagger makes the flip outlast it.
      const from = pendingHeight.current;
      const to = grid.offsetHeight;
      gsap.fromTo(grid, { height: from }, { height: to, duration: 0.55, ease: EASE.travel });
      playGrid(state, { onComplete: () => gsap.set(grid, { clearProps: "height" }) });
    },
    // No `revertOnUpdate`: a half-played reshuffle is finished and cleared by
    // `captureGrid` in the click handler, and reverting a finished one put
    // stale inline styles back on the cards (see src/lib/flipGrid.ts).
    { dependencies: [filter], scope: gridRef },
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
          ...REVEAL_VARS,
          stagger: 0.06,
          // Leave nothing inline behind — Flip measures these elements next.
          clearProps: "transform,opacity,visibility",
          scrollTrigger: { trigger: grid, start: REVEAL_START, once: true },
        });
      });
    },
    { scope: gridRef },
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
        {/* sr-only below sm, not hidden — the phone rail filters too, and
            display:none would silence this live region for its readers. */}
        <p
          aria-live="polite"
          className="sr-only shrink-0 font-mono text-meta uppercase tracking-meta text-fg-tertiary sm:not-sr-only sm:block"
        >
          {t("count", { count: visible.length })}
        </p>
      </div>

      {/* Desktop/tablet: the bento. `relative` is required for Flip's
       * absolute-positioning pass during the reshuffle. */}
      <div ref={gridRef} className="relative hidden grid-cols-2 gap-4 md:grid lg:grid-cols-3">
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
      <MobileAppRail
        apps={visible}
        className="md:hidden"
        labels={{ prev: t("railPrev"), next: t("railNext") }}
      />

      {visible.length === 0 && (
        <p className="py-10 text-center text-body text-fg-secondary">{t("empty")}</p>
      )}
    </div>
  );
}
