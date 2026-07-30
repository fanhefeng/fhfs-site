"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { gsap } from "@/lib/gsap";

/** Resting rope length in px — the pendant hangs just under the header line. */
const ROPE_LEN = 72;
/** Free travel in px; past this the cord rubber-bands instead of stopping. */
const MAX_PULL = 70;
/** Release beyond this pull distance flips the light. */
const TRIGGER_PULL = 48;
/** Below this movement a press still counts as a plain click. */
const CLICK_SLOP = 5;
/** Rubberband constants (Apple feel): follow ratio and saturation range. */
const RUBBER = 0.55;
const RUBBER_RANGE = 140;
/** A short sharp yank past this speed (px/ms downward) also fires the flip. */
const FLICK_VEL = 0.8;

type Theme = "dark" | "light";

const readTheme = (): Theme =>
  typeof document !== "undefined" &&
  document.documentElement.dataset.theme === "light"
    ? "light"
    : "dark";

/**
 * The jazz-bar ceiling-lamp pull cord: a brass pendant on a thin cord
 * hanging from the top of the viewport. Click it — or drag it down past
 * the catch point and let go — to switch between the night show (dark)
 * and the matinee (light). The cord stretches with the hand and snaps
 * back with an elastic wobble, and the flip fires a brief warm flash
 * from the pendant, like a filament lighting up.
 */
export function PullCord() {
  const t = useTranslations("common");
  const btnRef = useRef<HTMLButtonElement>(null);
  const ropeRef = useRef<HTMLSpanElement>(null);
  const knobRef = useRef<HTMLSpanElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  /* Server renders the default (night). The saved theme is read after
     mount: matching the server on hydration means React actually patches
     aria-checked on the next render — a suppressed mismatch would leave
     the stale server value in the DOM for good. */
  const [theme, setTheme] = useState<Theme>("dark");
  const [reduced, setReduced] = useState(false);
  /* Drag bookkeeping shared between pointer handlers and the click guard.
     `vel` is a smoothed release velocity in px/ms (positive = downward). */
  const drag = useRef({
    active: false,
    startY: 0,
    dy: 0,
    moved: 0,
    swallow: false,
    vel: 0,
    lastRaw: 0,
    lastT: 0,
  });

  useEffect(() => {
    setTheme(readTheme());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const toggle = useCallback(
    (withFlash: boolean) => {
      const next: Theme = readTheme() === "light" ? "dark" : "light";
      const applyTheme = () => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("fhfs-theme", next);
        } catch {
          /* Private mode etc. — theme still applies for this page view. */
        }
        window.dispatchEvent(new CustomEvent("fhfs:theme"));
        setTheme(next);
      };

      /* Pulling the light is an old TV losing power: the View Transitions
       * API snapshots the outgoing page and our CSS (globals: crt-off)
       * collapses it to a bright scanline before the new theme lights up.
       * Feature-detected — browsers without it just swap instantly, and
       * reduced-motion keeps the plain swap too. `withFlash` doubles as
       * the "the user wants theatrics" signal (it is false under reduce). */
      const doc = document as Document & {
        startViewTransition?: (cb: () => void) => void;
      };
      if (withFlash && typeof doc.startViewTransition === "function") {
        document.documentElement.dataset.vt = "crt";
        doc.startViewTransition(applyTheme);
        // The marker only matters for this one transition's pseudo styles.
        window.setTimeout(() => {
          delete document.documentElement.dataset.vt;
        }, 900);
        return;
      }
      applyTheme();

      /* A 250ms radial flare from wherever the pendant currently hangs.
         Event-driven rect read — never happens inside a frame loop. */
      const flash = flashRef.current;
      const knob = knobRef.current;
      if (withFlash && flash && knob) {
        const r = knob.getBoundingClientRect();
        flash.style.left = `${r.left + r.width / 2}px`;
        flash.style.top = `${r.top + r.height / 2}px`;
        gsap
          .timeline()
          .fromTo(
            flash,
            { opacity: 0 },
            { opacity: 0.35, duration: 0.1, ease: "power1.out" }
          )
          .to(flash, { opacity: 0, duration: 0.15, ease: "power1.in" });
      }
    },
    []
  );

  /* Pointer drag: rope stretches (scaleY from the top) while the pendant
     rides down (translateY) — pure transforms, no layout writes. */
  useEffect(() => {
    if (reduced) return;
    const btn = btnRef.current;
    const rope = ropeRef.current;
    const knob = knobRef.current;
    if (!btn || !rope || !knob) return;

    const setRope = gsap.quickSetter(rope, "scaleY");
    const setKnob = gsap.quickSetter(knob, "y", "px");
    const pos = { y: 0 };
    const apply = () => {
      setRope(1 + pos.y / ROPE_LEN);
      setKnob(pos.y);
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      gsap.killTweensOf(pos);
      drag.current = {
        active: true,
        startY: e.clientY - pos.y,
        dy: pos.y,
        moved: 0,
        swallow: false,
        vel: 0,
        lastRaw: pos.y,
        lastT: e.timeStamp,
      };
      btn.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d.active) return;
      const raw = e.clientY - d.startY;
      d.moved = Math.max(d.moved, Math.abs(raw));
      /* Past the free travel the cord rubber-bands (Apple's soft boundary):
       * the further past the limit, the less the pendant follows, easing
       * toward an asymptote instead of freezing at a hard stop. */
      const over = raw - MAX_PULL;
      d.dy =
        over > 0
          ? MAX_PULL + (over * RUBBER) / (1 + over / RUBBER_RANGE)
          : Math.max(0, raw);
      /* Smoothed velocity so the release doesn't inherit one jittery frame. */
      if (e.timeStamp > d.lastT) {
        const v = (raw - d.lastRaw) / (e.timeStamp - d.lastT);
        d.vel = d.vel * 0.6 + v * 0.4;
        d.lastRaw = raw;
        d.lastT = e.timeStamp;
      }
      pos.y = d.dy;
      apply();
    };
    const onUp = () => {
      const d = drag.current;
      if (!d.active) return;
      d.active = false;
      /* Any real drag swallows the trailing click; the pull itself decides. */
      d.swallow = d.moved > CLICK_SLOP;
      /* Distance still fires, but so does speed: a short sharp yank reads
       * as "pull the cord" even when the hand never reached the catch. */
      const fire =
        d.dy >= TRIGGER_PULL || (d.vel > FLICK_VEL && d.moved > CLICK_SLOP);
      gsap.to(pos, {
        y: 0,
        duration: 0.9,
        ease: "elastic.out(1, 0.4)",
        onUpdate: apply,
      });
      if (fire) toggle(true);
    };

    btn.addEventListener("pointerdown", onDown);
    btn.addEventListener("pointermove", onMove);
    btn.addEventListener("pointerup", onUp);
    btn.addEventListener("pointercancel", onUp);
    return () => {
      btn.removeEventListener("pointerdown", onDown);
      btn.removeEventListener("pointermove", onMove);
      btn.removeEventListener("pointerup", onUp);
      btn.removeEventListener("pointercancel", onUp);
      gsap.killTweensOf(pos);
      gsap.set([rope, knob], { clearProps: "transform" });
    };
  }, [reduced, toggle]);

  /* Keyboard (detail === 0) and plain clicks land here; drags are eaten. */
  const onClick = () => {
    const d = drag.current;
    if (d.swallow) {
      d.swallow = false;
      return;
    }
    toggle(!reduced);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        role="switch"
        aria-checked={theme === "light"}
        aria-label={t("lightSwitch")}
        onClick={onClick}
        className="fixed right-8 top-0 z-[55] flex w-9 cursor-pointer touch-none flex-col items-center focus-visible:outline-offset-4 sm:right-10"
      >
        {/* Cord — stretches via scaleY from the ceiling */}
        <span
          ref={ropeRef}
          aria-hidden="true"
          className="block h-[72px] w-[2px] origin-top will-change-transform [background:linear-gradient(to_bottom,color-mix(in_srgb,var(--gold)_25%,transparent),color-mix(in_srgb,var(--gold)_70%,transparent)_60%,var(--gold))]"
        />
        {/* Brass pendant — small capsule with a top-light highlight */}
        <span
          ref={knobRef}
          aria-hidden="true"
          className="block h-[22px] w-[10px] rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.55),inset_0_-2px_3px_rgba(0,0,0,0.35),0_1px_4px_rgba(0,0,0,0.4)] will-change-transform [background:linear-gradient(160deg,#f6d789_0%,var(--gold)_55%,#6f4c14_100%)]"
        />
      </button>
      {/* Switch-flash: positioned at the pendant on toggle, GSAP-faded */}
      <div
        ref={flashRef}
        aria-hidden="true"
        className="pointer-events-none fixed z-[54] h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 [background:radial-gradient(circle,rgba(246,215,137,0.95),rgba(232,180,79,0.4)_45%,transparent_70%)]"
      />
    </>
  );
}
