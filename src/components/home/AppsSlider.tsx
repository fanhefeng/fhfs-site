"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

// Runs before paint on the client; falls back to useEffect during SSR so
// React does not warn about useLayoutEffect on the server.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
import { gsap, useGSAP } from "@/lib/gsap";

export type SlideItem = {
  name: string;
  tagline: string;
  category: string;
  href: string;
};

type Props = {
  items: SlideItem[];
  kicker: string;
  heading: string;
  hint: string;
  visitLabel: string;
};

/**
 * Feel constants, lifted verbatim from the Detroit Paris style
 * drag-slider prototype (demos/07-drag-slider.html):
 * - DECAY 0.94    → how far a flick coasts (0.9 crisp, 0.97 ice rink)
 * - IDLE_DRIFT    → slow self-rotation so the stage never looks dead
 * - SCALE_RANGE   → how dramatic the "small grows big at center" is
 * - DIP           → far-from-center cards sink, tracing a shallow arc
 */
const DECAY = 0.94;
const IDLE_DRIFT = -0.55;
const SCALE_RANGE = 0.26;
const DIP = 26;
const CLICK_SLOP = 8;
/** Wheel momentum below this speed (px/frame) hands over to the snap tween. */
const SNAP_VEL = 1.2;
/** Quiet time after a snap settles before the idle drift resumes (seconds). */
const IDLE_DELAY = 1.2;

// Neon color rotation for cards: gold / red / blue, keyed off the
// source item index so a duplicated card keeps its original color.
const NEON = [
  { text: "text-gold", glow: "var(--glow-gold)", rgb: "232 180 79" },
  { text: "text-neon-red", glow: "var(--glow-red)", rgb: "255 77 109" },
  { text: "text-neon-blue", glow: "var(--glow-blue)", rgb: "76 201 240" },
] as const;

/**
 * "TRACK 04" — seamless infinite drag slider for the owner's apps.
 *
 * The infinite loop is a single modulo ring: ((x % TOTAL) + TOTAL) % TOTAL.
 * Raw JS `%` returns negatives for negative operands, which would make the
 * whole row vanish when dragging left — adding TOTAL once before the second
 * modulo is what turns the line into a true ring.
 */
export function AppsSlider({ items, kicker, heading, hint, visitLabel }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // Server and first client render must agree (hydration), so start false
  // and flip in a layout effect — it runs before paint, so reduce users
  // still never see a frame of the animated ring.
  const [reduced, setReduced] = useState(false);
  // Copies of the item list; grown at runtime until the ring is at least
  // two viewports wide so the screen is always full while wrapping.
  const [rounds, setRounds] = useState(2);

  useIsomorphicLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useGSAP(
    () => {
      if (reduced) return;
      const stage = sectionRef.current;
      const track = trackRef.current;
      if (!stage || !track) return;

      const cards = Array.from(track.children) as HTMLElement[];
      if (cards.length === 0) return;

      // Geometry is cached here and refreshed only on resize — never
      // read layout (getBoundingClientRect etc.) inside the frame loop.
      let IW = 0;
      let GAP = 0;
      let STEP = 0;
      let TOTAL = 0;
      let vw = 0;

      let offset = 0;
      let vel = 0;
      let dragging = false;
      let lastX = 0;
      let moved = 0; // accumulated drag distance, used to swallow the trailing click
      let midIdx = -1;
      let hovering = false;

      /* Snap state: after a release the ring no longer coasts to a random
       * spot — momentum is projected forward and a tween carries the offset
       * to the nearest card slot (Apple, "Designing Fluid Interfaces"). */
      let snapTween: gsap.core.Tween | null = null;
      let settledAt = -Infinity; // gsap.ticker.time when the last snap landed
      const slide = { v: 0 }; // tween proxy for the closure variable `offset`

      const killSnap = () => {
        if (snapTween) {
          snapTween.kill();
          snapTween = null;
        }
      };

      /**
       * Momentum projection: coast the release velocity through the same
       * geometric decay the free tick would apply — sum of vel·DECAY^n is
       * vel/(1−DECAY) — then magnetize the landing point to the nearest
       * multiple of STEP that centers a card (same anchor as onFocusIn).
       */
      const snapFrom = (v: number) => {
        killSnap();
        vel = 0;
        const projected = offset + v / (1 - DECAY);
        const anchor = vw / 2 - IW / 2 + STEP;
        const snapped = anchor + Math.round((projected - anchor) / STEP) * STEP;
        const delta = snapped - offset;
        slide.v = offset;
        snapTween = gsap.to(slide, {
          v: snapped,
          // Longer throws get a touch more travel time, capped at 0.9s.
          duration: gsap.utils.clamp(0.6, 0.9, 0.6 + Math.abs(delta) / (STEP * 8)),
          ease: "power3.out",
          onUpdate: () => {
            offset = slide.v;
          },
          onComplete: () => {
            snapTween = null;
            settledAt = gsap.ticker.time;
          },
        });
      };

      const measure = () => {
        vw = stage.clientWidth;
        IW = Math.min(Math.max(vw * 0.26, 210), 400);
        GAP = Math.round(IW * 0.14);
        STEP = IW + GAP;
        TOTAL = STEP * cards.length;
        cards.forEach((el) => el.style.setProperty("--iw", `${IW}px`));

        // Grow the ring if this viewport needs more copies to stay seamless.
        const needed = Math.max(2, Math.ceil((vw * 2) / (STEP * items.length)));
        if (needed > rounds) setRounds(needed);
      };

      const layout = () => {
        let bestIdx = -1;
        let bestDist = Infinity;

        for (let i = 0; i < cards.length; i++) {
          // ① The ring: pad with TOTAL before the second modulo so
          //    negative offsets (dragging left) still wrap correctly.
          let x = i * STEP + offset;
          x = ((x % TOTAL) + TOTAL) % TOTAL;
          x -= STEP; // one step of slack on the left so cards never pop in

          // ② Center scale: normalized distance from viewport center.
          const center = x + IW / 2;
          const d = Math.abs(center - vw / 2) / (vw / 2);
          const k = Math.min(d, 1);
          const scale = 1 - k * SCALE_RANGE;
          // Farther cards sink a little, tracing a very shallow arc.
          const dip = k * k * DIP;

          const el = cards[i];
          el.style.transform = `translate3d(${x.toFixed(2)}px, calc(-50% + ${dip.toFixed(1)}px), 0) scale(${scale.toFixed(4)})`;
          el.style.zIndex = String(Math.round((1 - k) * 100));

          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }

        // Toggle the "mid" spotlight only when the winner changes.
        if (bestIdx !== midIdx) {
          if (midIdx >= 0) cards[midIdx].classList.remove("mid");
          if (bestIdx >= 0) cards[bestIdx].classList.add("mid");
          midIdx = bestIdx;
        }
      };

      /* ---------- drag: pointer events unify mouse and touch ----------
       * Pointer capture is deliberately deferred until the gesture is a
       * real drag. Capturing on pointerdown would retarget the follow-up
       * click to the stage, so the card's <a> would never see it and the
       * links would simply not open. */
      let captured = 0;
      const onPointerDown = (e: PointerEvent) => {
        // Right/middle button opens the context menu, whose mouseup we
        // never receive — that would leave the track stuck to the cursor.
        if (e.pointerType === "mouse" && e.button !== 0) return;
        // Grabbing mid-snap interrupts the tween — the hand always wins.
        killSnap();
        dragging = true;
        lastX = e.clientX;
        vel = 0;
        moved = 0;
        stage.classList.add("dragging");
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!dragging) return;
        // Safety net: the button was released somewhere we never heard about.
        if (e.pointerType === "mouse" && e.buttons === 0) {
          endDrag();
          return;
        }
        const dx = e.clientX - lastX;
        lastX = e.clientX;
        offset += dx;
        moved += Math.abs(dx);
        // Past the slop threshold this is a drag, not a click: take capture
        // so the gesture survives leaving the section, and let the retargeted
        // click be swallowed as a side effect.
        if (!captured && moved > CLICK_SLOP) {
          captured = e.pointerId;
          stage.setPointerCapture(e.pointerId);
        }
        // Smooth the velocity, otherwise the release inherits the
        // jitter of the very last pointer frame.
        vel = vel * 0.6 + dx * 0.4;
      };
      const endDrag = () => {
        if (!dragging) return;
        dragging = false;
        if (captured) {
          if (stage.hasPointerCapture(captured)) {
            stage.releasePointerCapture(captured);
          }
          captured = 0;
        }
        stage.classList.remove("dragging");
        // A real drag releases into the projected snap; a plain click
        // (below the slop) must not shuffle the card under the cursor.
        if (moved > CLICK_SLOP) snapFrom(vel);
      };
      // Capture-phase click guard: the trailing click of a real drag must
      // not open a link. Keyboard-synthesised clicks carry detail === 0 and
      // are always let through, whatever the last gesture left behind.
      const onClickCapture = (e: MouseEvent) => {
        if (e.detail === 0) return;
        if (moved > CLICK_SLOP) {
          e.preventDefault();
          e.stopPropagation();
        }
        moved = 0;
      };

      /* ---------- wheel: horizontal intent only, page scroll untouched ---------- */
      const onWheel = (e: WheelEvent) => {
        const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;
        const amount = horizontal ? -e.deltaX : -e.deltaY * 0.55;
        if (horizontal) {
          e.preventDefault();
          e.stopPropagation();
        }
        killSnap(); // wheel input takes over from a snap in flight
        vel = vel * 0.5 + amount * 0.5;
      };

      /* ---------- per frame: wheel inertia, snap hand-off, idle drift ---------- */
      const tick = () => {
        if (!dragging && !snapTween) {
          if (vel !== 0) {
            // Only wheel momentum still free-coasts (drag releases snap
            // immediately); once slow enough it hands over to the same
            // magnetic snap so the ring always parks on a card.
            offset += vel;
            vel *= DECAY;
            if (Math.abs(vel) < SNAP_VEL) snapFrom(vel);
          } else if (!hovering && gsap.ticker.time - settledAt > IDLE_DELAY) {
            // Hold still under the cursor: drifting while someone is aiming
            // at a card makes them click a different one than they picked.
            offset += IDLE_DRIFT;
          }
        }
        layout();
      };

      const onResize = () => {
        measure();
        layout();
      };

      const onPointerEnter = (e: PointerEvent) => {
        if (e.pointerType === "mouse") hovering = true;
      };
      // Once captured the pointer keeps reporting to the stage, so a
      // boundary crossing is not the end of the gesture.
      const onPointerLeave = () => {
        hovering = false;
        if (!captured) endDrag();
      };

      // Tabbing through the cards must bring the focused one on stage — the
      // browser cannot scroll it into view, the ring is transform-driven.
      // Only for keyboard focus: a mouse click also fires focusin, and
      // recentering there would yank the card out from under the cursor.
      const onFocusIn = (e: FocusEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target || !target.matches(":focus-visible")) return;
        const card = target.closest(".as-item");
        if (!card) return;
        const i = cards.indexOf(card as HTMLElement);
        if (i < 0) return;
        killSnap();
        vel = 0;
        offset = vw / 2 - IW / 2 + STEP - i * STEP;
        settledAt = gsap.ticker.time; // stay put while the user is tabbing
        layout();
      };

      measure();
      layout();

      // The idle drift means this loop never settles, so it must not run
      // while the section is off screen — every other frame loop on the
      // page (starfield, ascii footer) stops the same way.
      let running = false;
      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !running) {
            running = true;
            gsap.ticker.add(tick);
          } else if (!entry.isIntersecting && running) {
            running = false;
            gsap.ticker.remove(tick);
            vel = 0; // don't fling on the way back in
            endDrag();
            killSnap(); // no point tweening a ring nobody can see
          }
        },
        { rootMargin: "120px" }
      );
      io.observe(stage);

      stage.addEventListener("pointerdown", onPointerDown);
      stage.addEventListener("pointermove", onPointerMove);
      stage.addEventListener("pointerup", endDrag);
      stage.addEventListener("pointercancel", endDrag);
      stage.addEventListener("pointerenter", onPointerEnter);
      stage.addEventListener("pointerleave", onPointerLeave);
      stage.addEventListener("click", onClickCapture, true);
      stage.addEventListener("wheel", onWheel, { passive: false });
      stage.addEventListener("focusin", onFocusIn);
      window.addEventListener("resize", onResize);

      return () => {
        io.disconnect();
        killSnap();
        if (running) gsap.ticker.remove(tick);
        window.removeEventListener("resize", onResize);
        stage.removeEventListener("pointerdown", onPointerDown);
        stage.removeEventListener("pointermove", onPointerMove);
        stage.removeEventListener("pointerup", endDrag);
        stage.removeEventListener("pointercancel", endDrag);
        stage.removeEventListener("pointerenter", onPointerEnter);
        stage.removeEventListener("pointerleave", onPointerLeave);
        stage.removeEventListener("click", onClickCapture, true);
        stage.removeEventListener("wheel", onWheel);
        stage.removeEventListener("focusin", onFocusIn);
        stage.classList.remove("dragging");
      };
    },
    { scope: sectionRef, dependencies: [reduced, rounds, items.length], revertOnUpdate: true }
  );

  const renderCard = (
    item: SlideItem,
    key: string,
    srcIdx: number,
    mode: "fluid" | "static",
    duplicate = false
  ) => {
    const neon = NEON[srcIdx % 3];
    const cardStyle = {
      "--neon": neon.rgb,
      backgroundImage: `radial-gradient(ellipse at 50% 30%, rgb(${neon.rgb} / 0.08), transparent 68%)`,
    } as CSSProperties;

    return (
      <div
        key={key}
        // Copies exist only to keep the ring seamless — they must not add a
        // second tab stop or a second reading of the same app.
        aria-hidden={duplicate || undefined}
        className={
          mode === "fluid"
            ? "as-item absolute left-0 top-1/2 h-full w-[var(--iw)] origin-center will-change-transform [transform:translate3d(-200vw,-50%,0)]"
            : "as-item as-static relative h-full w-[clamp(210px,26vw,400px)] shrink-0 snap-center"
        }
        style={{ "--neon": neon.rgb } as CSSProperties}
      >
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          draggable={false}
          tabIndex={duplicate ? -1 : undefined}
          aria-label={`${item.name} — ${visitLabel}`}
          className="as-card glass flex h-full w-full select-none flex-col"
          style={cardStyle}
        >
          <div className="flex flex-1 items-center justify-center pt-6">
            <span
              aria-hidden="true"
              className={`font-sign text-6xl ${neon.text}`}
              style={{ textShadow: neon.glow }}
            >
              {item.name[0]}
            </span>
          </div>
          <div className="as-cap flex flex-col gap-1 p-4">
            <h4 className="font-deco text-lg text-fg">{item.name}</h4>
            <p className="text-xs text-muted-fg">{item.tagline}</p>
            <span className="flex items-baseline justify-between font-mono text-[10px] tracking-[0.12em] text-muted-fg">
              {item.category}
              <span className="text-gold/80">{visitLabel} ↗</span>
            </span>
          </div>
        </a>
      </div>
    );
  };

  // Duplicated ring for the animated mode; the reduced-motion fallback
  // shows each item exactly once as a plain horizontal scroll list.
  const ringItems: SlideItem[] = [];
  for (let r = 0; r < Math.max(2, rounds); r++) ringItems.push(...items);

  return (
    <section
      ref={sectionRef}
      data-act="bar"
      // `isolate` keeps the per-card z-index (up to 100) inside this section
      // so the spotlight card cannot rise above the sticky header.
      className="apps-slider relative isolate grid min-h-[92svh] cursor-grab touch-pan-y place-items-center overflow-hidden"
    >
      {/* Component-scoped styles: mid-card spotlight + caption reveal are
          CSS transitions toggled by a class, never animated per frame. */}
      <style>{`
        .apps-slider.dragging { cursor: grabbing; }
        .apps-slider .as-card {
          transition: border-color 0.5s ease, box-shadow 0.5s ease,
            background-color 0.35s ease;
        }
        .apps-slider .as-cap {
          opacity: 0;
          transform: translateY(10px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .apps-slider .as-item.mid .as-cap,
        .apps-slider .as-item.as-static .as-cap,
        .apps-slider .as-item:focus-within .as-cap {
          opacity: 1;
          transform: none;
        }
        .apps-slider .as-item.mid .as-card,
        .apps-slider .as-item:focus-within .as-card {
          border-color: rgb(var(--neon) / 0.45);
          box-shadow:
            0 0 18px rgb(var(--neon) / 0.22),
            0 0 44px rgb(var(--neon) / 0.1);
        }
      `}</style>

      {/* Lead: kicker + heading, floating above the track */}
      <div className="pointer-events-none absolute left-1/2 top-[9svh] z-[6] w-[min(90vw,760px)] -translate-x-1/2 text-center">
        <p className="track-kicker">{kicker}</p>
        <h2 className="mt-3 font-deco text-[clamp(1.75rem,4.2vw,3.25rem)] leading-[1.08] text-gold">
          {heading}
        </h2>
      </div>

      {/* Track */}
      {reduced ? (
        <div className="flex h-[52svh] w-full snap-x snap-mandatory gap-4 overflow-x-auto px-6">
          {items.map((item, i) => renderCard(item, `static-${i}`, i, "static"))}
        </div>
      ) : (
        <div ref={trackRef} className="relative h-[52svh] w-full">
          {ringItems.map((item, i) =>
            renderCard(item, `ring-${i}`, i % items.length, "fluid", i >= items.length)
          )}
        </div>
      )}

      {/* Center mark: echoes the "center stage" motif and anchors the drag */}
      {!reduced && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[10%] left-1/2 top-[32%] z-[5] w-px [background:linear-gradient(transparent,rgb(232_180_79/0.35)_22%,rgb(232_180_79/0.35)_78%,transparent)]"
        >
          <span className="absolute -left-[3px] top-[18%] h-[7px] w-[7px] rounded-full bg-gold" />
          <span className="absolute -left-[3px] bottom-[18%] h-[7px] w-[7px] rounded-full bg-gold" />
        </div>
      )}

      {/* Hint bar */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2 border border-line bg-bg/50 px-4 py-2 font-mono text-[11px] tracking-[0.12em] text-muted-fg backdrop-blur-[6px]">
        {hint}
      </div>
    </section>
  );
}
