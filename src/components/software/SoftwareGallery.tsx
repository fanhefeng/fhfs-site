"use client";

import { useCallback, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { gsap, useGSAP, EASE } from "@/lib/client/gsap";
import { captureGrid, playGrid, type GridState } from "@/lib/client/flipGrid";
import { REVEAL_START, REVEAL_VARS } from "@/components/fx/Reveal";
import { useUrlChoice } from "@/lib/client/useUrlChoice";
import { SegmentedFilter, type Segment } from "@/components/ui/SegmentedFilter";
import { RecordDeck } from "./RecordDeck";
import { Sleeve } from "./Sleeve";
import { APP_CATEGORIES, type AppFilter, type SoftwareApp } from "./appMeta";

type Rect = { left: number; top: number; width: number; height: number };

/** Clear of the island at the top of the screen when the deck is scrolled to. */
const DECK_OFFSET = -96;

/**
 * /software as a record shelf: a turntable with one app's record on it and
 * its notes beside it, and below, every app as a sleeve. Pick a sleeve and its
 * record goes up onto the deck (RecordDeck).
 *
 * Two choices live in the address bar, so a reload or a shared link keeps
 * them: the record on the deck (`?app=…`, none meaning the first) and the
 * shelf's filter (`?cat=…`). A choice that arrives with the URL has no
 * "before" — no record in the air, no layout for Flip to play from — and
 * things are simply where they belong.
 *
 * The filter keeps every sleeve in the DOM for the whole session and only
 * flips cells between grid flow and `display: none`; Flip replays the
 * difference so the sleeves that stay slide from where they were, and you can
 * follow one with your eye. The data is static (built by the server page).
 */
export function SoftwareGallery({ apps }: { apps: SoftwareApp[] }) {
  const t = useTranslations("software");
  const ids = useMemo(() => apps.map((a) => a.id), [apps]);
  const [onDeck, putOnDeck] = useUrlChoice("app", ids);
  const current = onDeck ?? ids[0] ?? "";
  const deckRef = useRef<HTMLDivElement>(null);
  /** Where a picked record was, for the deck to fly it from. */
  const arrival = useRef<Rect | null>(null);

  const categories = useMemo(
    () => APP_CATEGORIES.filter((c) => apps.some((a) => a.category === c)),
    [apps],
  );
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

  const pick = useCallback(
    (id: string, record: DOMRect | null) => {
      if (id === current) return;
      const land = () => {
        // Measured again on landing: a scroll in between has moved the sleeve.
        const sleeve = document.querySelector(
          `[data-sleeve-slot="${CSS.escape(id)}"] [data-sleeve-record]`,
        );
        arrival.current = sleeve?.getBoundingClientRect() ?? record;
        putOnDeck(id === ids[0] ? null : id);
      };
      // On a phone the deck is a screen above the shelf, and a record flying
      // somewhere out of sight is no flight at all: bring the deck back first.
      const deck = deckRef.current?.getBoundingClientRect();
      const outOfSight =
        deck &&
        (deck.bottom < deck.height * 0.6 || deck.top > window.innerHeight - deck.height * 0.6);
      if (!deck || !outOfSight) {
        land();
        return;
      }
      if (window.__lenis) {
        window.__lenis.scrollTo(deckRef.current!, {
          offset: DECK_OFFSET,
          duration: 0.8,
          onComplete: land,
        });
        return;
      }
      // No lenis means reduced motion (SmoothScroll never built one): jump.
      window.scrollTo({ top: window.scrollY + deck.top + DECK_OFFSET });
      requestAnimationFrame(land);
    },
    [current, ids, putOnDeck],
  );

  const change = useCallback(
    (next: string) => {
      const grid = gridRef.current;
      // Capture *before* React re-renders — this is the "previous state" the
      // sleeves inherit their positions from.
      if (grid) {
        // The height first: the capture finishes a flip that is still running
        // on these cells, which lets go of the height that flip was holding.
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
      // The grid's own height travels with the cells, and has to be held by
      // hand: `absolute: true` lifts every cell out of the flow for as long as
      // the flip runs, and a grid with nothing left in its flow is 0px tall —
      // the footer jumped up under the cells and back down when they landed.
      // The new layout's natural height can only be read here, before Flip
      // takes the cells out. The height is held even when it does not change,
      // and let go by the flip's own `onComplete` rather than the tween's: the
      // stagger makes the flip outlast it.
      const from = pendingHeight.current;
      const to = grid.offsetHeight;
      gsap.fromTo(grid, { height: from }, { height: to, duration: 0.55, ease: EASE.travel });
      playGrid(state, { onComplete: () => gsap.set(grid, { clearProps: "height" }) });
    },
    // No `revertOnUpdate`: a half-played reshuffle is finished and cleared by
    // `captureGrid` in the click handler, and reverting a finished one put
    // stale inline styles back on the cells (see src/lib/client/flipGrid.ts).
    { dependencies: [filter], scope: gridRef },
  );

  // Site-wide scroll entrance, shelf flavour: stagger .06 across the sleeves.
  useGSAP(
    () => {
      const grid = gridRef.current;
      if (!grid) return;
      gsap.from(grid.querySelectorAll("[data-flip-item]"), {
        ...REVEAL_VARS,
        stagger: 0.06,
        // Leave nothing inline behind — Flip measures these elements next.
        clearProps: "transform,opacity,visibility",
        scrollTrigger: { trigger: grid, start: REVEAL_START, once: true },
      });
    },
    { scope: gridRef },
  );

  if (apps.length === 0) {
    return <p className="py-10 text-center text-body text-fg-secondary">{t("empty")}</p>;
  }

  return (
    <div>
      <RecordDeck apps={apps} current={current} arrival={arrival} deckRef={deckRef} />

      <section aria-labelledby="shelf-title" className="mt-24">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <h2 id="shelf-title" className="text-heading text-fg">
              {t("shelfTitle")}
            </h2>
            <p
              aria-live="polite"
              className="mt-1 font-mono text-meta uppercase tracking-meta text-fg-tertiary"
            >
              {t("count", { count: visible.length })}
            </p>
          </div>
          <SegmentedFilter
            options={options}
            value={filter}
            onChange={change}
            ariaLabel={t("filterAria")}
          />
        </div>

        {/* `relative` is required for Flip's absolute-positioning pass. */}
        <div
          ref={gridRef}
          className="relative grid grid-cols-3 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-6"
        >
          {apps.map((app, i) => {
            const shown = filter === "all" || app.category === filter;
            return (
              <div key={app.id} data-flip-item style={shown ? undefined : { display: "none" }}>
                <Sleeve app={app} index={i} onDeck={app.id === current} onPick={pick} />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
