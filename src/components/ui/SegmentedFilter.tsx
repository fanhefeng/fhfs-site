"use client";

import { useCallback, useEffect, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Flip, gsap, useGSAP, EASE } from "@/lib/client/gsap";

export type Segment = { value: string; label: string };

type Props = {
  options: Segment[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
};

/**
 * Segmented control (Apple's, in glass). The selected pill is a single
 * element that Flips from its previous slot to the new one — the indicator
 * inherits its position from the last state instead of appearing at the new
 * one, which is what makes the control read as one physical part sliding.
 *
 * Buttons are ≥44px tall and remain plain buttons with `aria-pressed`; arrow
 * keys move between them for keyboard users.
 */
export function SegmentedFilter({ options, value, onChange, ariaLabel, className }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  /** False until the pill has been placed once — the first placement never
   * animates (there is no previous state to inherit from). */
  const placed = useRef(false);

  const place = useCallback(
    (animate: boolean) => {
      const root = rootRef.current;
      const pill = pillRef.current;
      if (!root || !pill) return;
      const btn = root.querySelector<HTMLElement>(`[data-seg="${CSS.escape(value)}"]`);
      if (!btn) {
        Flip.killFlipsOf(pill, false);
        gsap.set(pill, { autoAlpha: 0 });
        return;
      }
      const next = {
        x: btn.offsetLeft,
        width: btn.offsetWidth,
        autoAlpha: 1,
        // An interrupted Flip leaves sizing constraints on the element.
        // Reset those before measuring the next destination.
        clearProps: "height,minWidth,maxWidth,minHeight,maxHeight",
      };

      if (!animate) {
        Flip.killFlipsOf(pill, false);
        gsap.set(pill, next);
        return;
      }
      // Capture the rendered position before stopping a previous flight.
      // getState's default completes it first, causing rapid switches to jump.
      // GSAP supports kill here; its bundled state type omits the option.
      const captureOptions: Flip.FlipStateVars & { kill: boolean } = { kill: false };
      const state = Flip.getState(pill, captureOptions);
      Flip.killFlipsOf(pill, false);
      gsap.set(pill, next);
      Flip.from(state, { duration: 0.42, ease: EASE.default, absolute: false });
    },
    [value],
  );

  useGSAP(
    () => {
      place(placed.current);
      placed.current = true;
    },
    // Deliberately NOT revertOnUpdate: reverting would snap the pill back to
    // its origin before Flip could read where it actually is.
    { dependencies: [place], scope: rootRef },
  );

  /* Layout corrections are instant. Observe the labels too: a translated
   * label or a loaded font can change offsets inside a fixed-width scroller
   * without resizing its outer box. Skip the observer's initial notification
   * so mounting it does not interrupt a selection transition. */
  const placeRef = useRef(place);
  const optionValues = options.map((option) => option.value).join("\n");
  useEffect(() => {
    placeRef.current = place;
  }, [place]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      placeRef.current(false);
    });
    ro.observe(root);
    root.querySelectorAll<HTMLElement>("[data-seg]").forEach((button) => ro.observe(button));
    let live = true;
    void document.fonts.ready.then(() => {
      if (live) placeRef.current(false);
    });
    return () => {
      live = false;
      ro.disconnect();
    };
  }, [optionValues]);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if ((!dir && e.key !== "Home" && e.key !== "End") || options.length === 0) return;
      const focused =
        e.target instanceof Element ? e.target.closest<HTMLElement>("[data-seg]") : null;
      if (!focused || !e.currentTarget.contains(focused)) return;
      e.preventDefault();
      const i = options.findIndex((o) => o.value === focused.dataset.seg);
      if (i < 0) return;
      const next =
        options[
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? options.length - 1
              : (i + dir + options.length) % options.length
        ]!;
      if (next.value !== value) onChange(next.value);
      rootRef.current
        ?.querySelector<HTMLElement>(`[data-seg="${CSS.escape(next.value)}"]`)
        ?.focus();
    },
    [options, value, onChange],
  );

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`liquid-chip relative inline-flex max-w-full flex-nowrap overflow-x-auto rounded-full p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className ?? ""}`}
    >
      <span
        ref={pillRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-1 bottom-1 rounded-full bg-surface-raised shadow-[0_1px_3px_rgba(120,80,40,0.18)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            data-seg={o.value}
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`relative z-10 min-h-11 shrink-0 cursor-pointer whitespace-nowrap rounded-full px-4 font-mono text-meta uppercase tracking-meta transition-colors duration-200 ${
              active ? "text-fg" : "text-fg-secondary hover:text-fg"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
