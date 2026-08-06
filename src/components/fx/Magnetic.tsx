"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import { gsap, useGSAP, isFinePointer } from "@/lib/gsap";

type Props = {
  children: ReactNode;
  /** How strongly the wrapper chases the cursor: 0 = inert, 1 = glued. */
  strength?: number;
  className?: string;
};

/**
 * Magnetic hover wrapper (after the official GSAP demo azmKBBJ): while the
 * cursor is over the element, the whole wrapper leans toward it; the inner
 * layer follows with an extra 0.6x of the same offset, so the label appears
 * to float above the plate (a small parallax). On leave both spring home
 * with an elastic wobble.
 *
 * Touch devices get a completely inert wrapper — no listeners are ever
 * registered, so there is zero per-frame cost.
 */
export function Magnetic({ children, strength = 0.4, className }: Props) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const wrap = wrapRef.current;
      const inner = innerRef.current;
      if (!wrap || !inner) return;
      // Magnetism only makes sense for a hovering fine pointer.
      if (!isFinePointer()) return;

      /* Geometry is read once per hover (pointerenter) — an event-driven
       * read, never per frame. The wrapper itself moves during the hover,
       * so the untransformed box is reconstructed by subtracting the
       * current tweened offset. */
      let rect: { left: number; top: number; w: number; h: number } | null = null;

      const measure = () => {
        const r = wrap.getBoundingClientRect();
        const x = Number(gsap.getProperty(wrap, "x")) || 0;
        const y = Number(gsap.getProperty(wrap, "y")) || 0;
        rect = { left: r.left - x, top: r.top - y, w: r.width, h: r.height };
      };

      const onEnter = () => measure();

      const onMove = (e: PointerEvent) => {
        if (!rect) measure();
        if (!rect) return;
        // Cursor position -> signed offset from center, scaled by strength.
        const dx =
          gsap.utils.mapRange(0, rect.w, -rect.w / 2, rect.w / 2, e.clientX - rect.left) *
          strength;
        const dy =
          gsap.utils.mapRange(0, rect.h, -rect.h / 2, rect.h / 2, e.clientY - rect.top) *
          strength;
        gsap.to(wrap, { x: dx, y: dy, duration: 0.4, ease: "power2.out", overwrite: "auto" });
        // Parallax layer: the content leads a little further than the plate.
        gsap.to(inner, {
          x: dx * 0.6,
          y: dy * 0.6,
          duration: 0.4,
          ease: "power2.out",
          overwrite: "auto",
        });
      };

      const onLeave = () => {
        rect = null;
        gsap.to([wrap, inner], {
          x: 0,
          y: 0,
          duration: 1.1,
          ease: "elastic.out(1, 0.4)",
          overwrite: "auto",
        });
      };

      wrap.addEventListener("pointerenter", onEnter);
      wrap.addEventListener("pointermove", onMove);
      wrap.addEventListener("pointerleave", onLeave);
      return () => {
        wrap.removeEventListener("pointerenter", onEnter);
        wrap.removeEventListener("pointermove", onMove);
        wrap.removeEventListener("pointerleave", onLeave);
        gsap.killTweensOf([wrap, inner]);
      };
    },
    { scope: wrapRef }
  );

  return (
    <span
      ref={wrapRef}
      className={`inline-block will-change-transform ${className ?? ""}`}
    >
      <span ref={innerRef} className="inline-block will-change-transform">
        {children}
      </span>
    </span>
  );
}
