"use client";

import { useEffect, useLayoutEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";

/**
 * Lenis must exist before any layout effect that wants to pause scrolling —
 * useGSAP is a layout effect, so a passive effect here would let the opening
 * curtain call stop() on an instance that does not exist yet.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

declare global {
  interface Window {
    /** Shared Lenis instance so overlays (loader) can pause scrolling. */
    __lenis?: Lenis | null;
  }
}

/**
 * Global inertial scrolling. Lenis and GSAP must share one clock:
 * Lenis reports scroll to ScrollTrigger, and GSAP's ticker drives
 * Lenis' raf — otherwise pinned animations lag a frame behind.
 */
export function SmoothScroll() {
  useIsomorphicLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const lenis = new Lenis({
      lerp: 0.1,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
    });
    window.__lenis = lenis;

    lenis.on("scroll", () => ScrollTrigger.update());
    const raf = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      window.__lenis = null;
    };
  }, []);

  return null;
}
