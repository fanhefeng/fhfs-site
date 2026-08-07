"use client";

import { ScrollTrigger } from "@/lib/gsap";

/**
 * The site-wide scroll-lock contract, in one place. Overlays that must hold
 * the page still (route veil, overture blackout, full-screen nav) all speak
 * it; each caller keeps its own "am I locked" flag, because what counts as
 * one lock differs per overlay.
 *
 * Locking stops Lenis *and* hides overflow: Lenis only intercepts wheel and
 * touch, so without the overflow clamp the keyboard and the scrollbar would
 * still move the page under the overlay.
 */
export function lockScroll(): void {
  window.__lenis?.stop();
  document.documentElement.style.overflow = "hidden";
}

/**
 * Unlock. Lenis is re-synced to the browser's real scroll position before it
 * starts again — otherwise it snaps back to the offset it held when it was
 * stopped.
 *
 * `refresh` — pass true when pinned sections were measured while the page
 * was locked and had no scrollbar, so ScrollTrigger must re-measure now that
 * the real layout is back. RouteTransition passes false and times its own
 * refresh against the reveal instead.
 */
export function unlockScroll({ refresh = false } = {}): void {
  document.documentElement.style.overflow = "";
  window.__lenis?.scrollTo(window.scrollY, { immediate: true, force: true });
  window.__lenis?.start();
  if (refresh) ScrollTrigger.refresh();
}
