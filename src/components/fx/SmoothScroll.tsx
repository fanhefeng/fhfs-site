"use client";

import { useEffect, useLayoutEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

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
    // The one thing on this site that takes the scroll away from the reader,
    // and the highest vestibular risk on it. Reduce-motion keeps the browser's
    // own scrolling: every consumer of `window.__lenis` is written to fall back
    // to it already, so nothing else has to know.
    if (prefersReducedMotion()) return;

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

    // Lenis re-measures the page when its own ResizeObserver on <html> fires.
    // Here it never fires: `html { overflow-x: clip }` makes the root a clip
    // container, so its box stays exactly one viewport tall however long the
    // document gets. Lenis therefore keeps the scroll limit it measured on
    // whichever page it last saw resize — walk from a short route into a tall
    // one (the ten-viewport /intro track) and the page simply stops moving at
    // the previous page's bottom, halfway through the story.
    //
    // <body> is the element whose box does follow the content, so watch that
    // and hand Lenis the new size. This also covers late-landing content on
    // any route: fonts, images, an opened accordion.
    const remeasure = new ResizeObserver(() => lenis.resize());
    remeasure.observe(document.body);

    return () => {
      remeasure.disconnect();
      gsap.ticker.remove(raf);
      lenis.destroy();
      window.__lenis = null;
    };
  }, []);

  return null;
}
