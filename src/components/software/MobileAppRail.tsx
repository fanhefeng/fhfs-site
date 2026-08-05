"use client";

import { useRef } from "react";
import { Draggable, gsap, useGSAP, EASE } from "@/lib/gsap";
import { AppCard } from "@/components/cards/AppCard";
import type { SoftwareApp } from "./appMeta";

type Props = { apps: SoftwareApp[]; className?: string };

/**
 * The phone-sized face of the bento: a swipeable rail (RwKwLWK's seamless
 * loop, cropped — no pin, no scroll hijack, no ScrollTrigger at all).
 *
 * The loop is the demo's `offset` proxy + `gsap.utils.wrap` trick without the
 * DOM duplication: each card's x is `wrap(i * step - offset)`, so a card that
 * walks off the left edge reappears on the right and the rail has no ends.
 * A hidden Draggable proxy drives `offset` (InertiaPlugin supplies the flick),
 * `snap` lands it on a whole card, and the card that arrives gets a
 * 1.0 → 1.03 → 1.0 pop as the tactile "landed" cue.
 *
 * SSR (and every viewport ≥768px, and no-JS) sees a plain scroll-snap row —
 * the carousel is layered on top only under `(max-width: 767px)`, and reverted
 * cleanly by gsap.matchMedia.
 */
export function MobileAppRail({ apps, className }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const proxyRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const viewport = viewportRef.current;
      const track = trackRef.current;
      const proxy = proxyRef.current;
      if (!viewport || !track || !proxy) return;

      const mm = gsap.matchMedia();
      mm.add("(max-width: 767px)", () => {
        const items = gsap.utils.toArray<HTMLElement>("[data-rail-item]", track);
        const n = items.length;
        if (n < 2) return;

        /* One mutable object is the single source of truth for the rail's
         * position; every driver (drag, throw, snap tween, focus) writes to
         * it and calls render — never a tween per card. */
        const pos = { offset: 0 };
        let step = 1;
        let pad = 0;
        let wrapX = gsap.utils.wrap(0, 1);
        let wrapDelta = gsap.utils.wrap(-0.5, 0.5);
        const setX = items.map((el) => gsap.quickSetter(el, "x", "px"));

        const render = () => {
          for (let i = 0; i < n; i++) {
            const x = wrapX(i * step - pos.offset);
            setX[i](x + pad);
            // Cards away from the focus slot dim — depth without a scale
            // tween fighting the snap pop.
            const d = Math.min(1, Math.abs(x) / step);
            items[i].style.opacity = String(1 - d * 0.5);
          }
        };

        // Guard against ResizeObserver feedback: only a real width change
        // (rotation, browser chrome) justifies a re-measure.
        let lastWidth = -1;

        const layout = () => {
          lastWidth = viewport.clientWidth;
          // Measure in normal flow first, then switch to the wrapped mode.
          gsap.set(items, { clearProps: "all" });
          track.style.cssText = "";
          viewport.style.overflowX = "";
          const cardW = items[0].offsetWidth;
          const gap = parseFloat(getComputedStyle(track).columnGap) || 16;
          const rowH = track.offsetHeight;

          step = cardW + gap;
          pad = Math.max(0, (viewport.clientWidth - cardW) / 2);
          wrapX = gsap.utils.wrap(-step, step * n - step);
          wrapDelta = gsap.utils.wrap(-(step * n) / 2, (step * n) / 2);

          viewport.style.overflowX = "hidden";
          track.style.display = "block";
          track.style.position = "relative";
          track.style.height = `${rowH}px`;
          gsap.set(items, { position: "absolute", top: 0, left: 0, height: rowH });
          pos.offset = Math.round(pos.offset / step) * step;
          render();
        };

        const popFocused = () => {
          const idx = ((Math.round(pos.offset / step) % n) + n) % n;
          const card = items[idx].firstElementChild;
          if (!card) return;
          gsap.fromTo(
            card,
            { scale: 1 },
            {
              scale: 1.03,
              duration: 0.16,
              ease: "power2.out",
              yoyo: true,
              repeat: 1,
              overwrite: "auto",
            }
          );
        };

        const snapTo = (target: number, pop = true) => {
          gsap.to(pos, {
            offset: target,
            duration: 0.45,
            ease: EASE.default,
            overwrite: true,
            onUpdate: render,
            onComplete: pop ? popFocused : undefined,
          });
        };

        layout();

        // Held in a box so the callbacks can reach the instance that is
        // still being constructed on the line below.
        const drag: { instance?: Draggable } = {};
        drag.instance = Draggable.create(proxy, {
          type: "x",
          trigger: viewport,
          inertia: true,
          // Snap the *proxy* — offset is its exact mirror, so landing the
          // proxy on a multiple of `step` lands a card in the focus slot.
          snap: { x: (v: number) => Math.round(v / step) * step },
          onPress() {
            gsap.killTweensOf(pos);
            gsap.set(proxy, { x: -pos.offset });
          },
          onDrag() {
            pos.offset = -(drag.instance?.x ?? 0);
            render();
          },
          onThrowUpdate() {
            pos.offset = -(drag.instance?.x ?? 0);
            render();
          },
          onThrowComplete: popFocused,
          onDragEnd() {
            if (!drag.instance?.isThrowing) snapTo(Math.round(pos.offset / step) * step);
          },
        })[0];

        /* Keyboard users tab through cards that may be parked off-screen —
         * bring the focused one into the slot instead of letting focus
         * disappear (the row is transformed, so the browser cannot scroll
         * it into view itself). */
        const onFocusIn = (e: FocusEvent) => {
          const item = (e.target as HTMLElement | null)?.closest<HTMLElement>(
            "[data-rail-item]"
          );
          if (!item) return;
          const i = items.indexOf(item);
          if (i < 0) return;
          snapTo(pos.offset + wrapDelta(i * step - pos.offset), false);
        };
        track.addEventListener("focusin", onFocusIn);

        const ro = new ResizeObserver(() => {
          if (viewport.clientWidth !== lastWidth) layout();
        });
        ro.observe(viewport);

        return () => {
          ro.disconnect();
          track.removeEventListener("focusin", onFocusIn);
          drag.instance?.kill();
          gsap.killTweensOf(pos);
          gsap.set(items, { clearProps: "all" });
          for (const el of items) el.style.opacity = "";
          track.style.cssText = "";
          viewport.style.overflowX = "";
        };
      });
    },
    // revertOnUpdate: a new app list means the old matchMedia, Draggable and
    // ResizeObserver must be torn down first — useGSAP defers cleanup to
    // unmount otherwise, and two Draggables would fight over the rail.
    {
      dependencies: [apps.map((a) => a.id).join(",")],
      scope: viewportRef,
      revertOnUpdate: true,
    }
  );

  return (
    <div className={className}>
      <div
        ref={viewportRef}
        className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div ref={trackRef} className="flex snap-x snap-mandatory gap-4 pb-1">
          {apps.map((app, i) => (
            <div
              key={app.id}
              data-rail-item
              className="w-[70vw] max-w-[18rem] shrink-0 snap-center will-change-transform"
            >
              <AppCard app={app} index={i} variant="rail" />
            </div>
          ))}
        </div>
      </div>
      {/* Drag proxy: never rendered, only measured. Draggable writes x here
       * and the rail mirrors it — the demo's "drag-proxy" pattern. */}
      <span
        ref={proxyRef}
        aria-hidden
        className="pointer-events-none invisible absolute size-0"
      />
    </div>
  );
}
