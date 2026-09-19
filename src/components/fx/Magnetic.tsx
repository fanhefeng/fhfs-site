"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import { gsap, useGSAP, EASE, isFinePointer } from "@/lib/gsap";

type Props = {
  children: ReactNode;
  /** How strongly the plate chases the cursor: 0 = inert, 1 = glued. */
  strength?: number;
  className?: string;
};

/**
 * How far outside the resting box the pull reaches, in px. The hit ring
 * below is this much larger than the element on every side, so the plate
 * starts leaning before the cursor is over it, and the pointermove maths
 * treats a cursor beyond the ring as gone.
 */
export const MAGNET_REACH = 20;

/**
 * Magnetic hover wrapper (after the official GSAP demo azmKBBJ): while the
 * cursor is within reach, the plate leans toward it; the inner layer follows
 * with an extra 0.6x of the same offset, so the label appears to float above
 * the plate (a small parallax). On leave both spring home with an elastic
 * wobble.
 *
 * Three layers, and only the outer one is listened to. The wrapper never
 * moves: it keeps the resting box and carries the hit ring, so "is the
 * cursor over this" is a fixed question. The first version listened to the
 * plate itself, which moves — and a plate that moves 1.2x the cursor's
 * offset (strength 0.75, times 1.6 for the inner layer) outruns the cursor,
 * never fires pointerleave, and can be dragged across the screen; near the
 * edge of that it flip-flopped between leave and enter and shivered. Now
 * the reach is decided against the resting box, in `onMove`, whatever the
 * plate is doing.
 *
 * Touch devices get a completely inert wrapper — no listeners are ever
 * registered, so there is zero per-frame cost.
 */
export function Magnetic({ children, strength = 0.4, className }: Props) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const plateRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const wrap = wrapRef.current;
      const plate = plateRef.current;
      const inner = innerRef.current;
      if (!wrap || !plate || !inner) return;
      // Magnetism only makes sense for a hovering fine pointer.
      if (!isFinePointer()) return;

      /* The resting box, read once per hover (pointerenter) — an
       * event-driven read, never per frame. The wrapper is never
       * transformed, so this is the box the pull is measured against. */
      let rect: { cx: number; cy: number; hw: number; hh: number } | null = null;
      let held = false;

      const measure = () => {
        const r = wrap.getBoundingClientRect();
        rect = {
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2,
          hw: r.width / 2 + MAGNET_REACH,
          hh: r.height / 2 + MAGNET_REACH,
        };
      };

      const release = () => {
        if (!held) return;
        held = false;
        gsap.to([plate, inner], {
          x: 0,
          y: 0,
          duration: 1.1,
          ease: EASE.release,
          overwrite: "auto",
        });
      };

      const onEnter = () => measure();

      const onMove = (e: PointerEvent) => {
        if (!rect) measure();
        if (!rect) return;
        const ox = e.clientX - rect.cx;
        const oy = e.clientY - rect.cy;
        // Beyond the ring the cursor is still over the displaced plate (a
        // descendant, so no pointerleave) but out of reach: let go.
        if (Math.abs(ox) > rect.hw || Math.abs(oy) > rect.hh) {
          release();
          return;
        }
        held = true;
        // Signed offset from the resting centre, scaled by strength.
        const dx = ox * strength;
        const dy = oy * strength;
        gsap.to(plate, { x: dx, y: dy, duration: 0.4, ease: EASE.soft, overwrite: "auto" });
        // Parallax layer: the content leads a little further than the plate.
        gsap.to(inner, {
          x: dx * 0.6,
          y: dy * 0.6,
          duration: 0.4,
          ease: EASE.soft,
          overwrite: "auto",
        });
      };

      const onLeave = () => {
        rect = null;
        release();
      };

      wrap.addEventListener("pointerenter", onEnter);
      wrap.addEventListener("pointermove", onMove);
      wrap.addEventListener("pointerleave", onLeave);
      return () => {
        wrap.removeEventListener("pointerenter", onEnter);
        wrap.removeEventListener("pointermove", onMove);
        wrap.removeEventListener("pointerleave", onLeave);
        gsap.killTweensOf([plate, inner]);
      };
    },
    { scope: wrapRef },
  );

  return (
    <span ref={wrapRef} className={`relative inline-block ${className ?? ""}`}>
      {/* The hit ring: MAGNET_REACH px beyond the resting box on every side.
          Painted before the plate, so it never sits over the content. */}
      <span aria-hidden="true" className="absolute" style={{ inset: -MAGNET_REACH }} />
      <span ref={plateRef} className="relative inline-block will-change-transform">
        <span ref={innerRef} className="inline-block will-change-transform">
          {children}
        </span>
      </span>
    </span>
  );
}
