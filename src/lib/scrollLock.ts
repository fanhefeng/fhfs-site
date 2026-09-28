"use client";

import { ScrollTrigger } from "@/lib/gsap";

/**
 * The site-wide scroll-lock contract, in one place. Overlays that must hold
 * the page still (route veil, overture blackout, full-screen nav, the film
 * viewer, the front door) all speak it; each caller keeps its own "am I
 * locked" flag, because what counts as one lock differs per overlay.
 *
 * Locking stops Lenis *and* hides overflow: Lenis only intercepts wheel and
 * touch, so without the overflow clamp the keyboard and the scrollbar would
 * still move the page under the overlay.
 *
 * Locks are counted. Two overlays can overlap — on a phone, a link in the
 * full-screen nav starts the route veil, and the nav closes (and unlocks)
 * when the route commits, while the veil still covers the page. With one
 * shared switch that unlock let the page go early and ran a ScrollTrigger
 * refresh against a layout still arriving; now the page is released only
 * when the last holder lets go.
 */
let holders = 0;

export function lockScroll(): void {
  holders++;
  if (holders > 1) return;
  window.__lenis?.stop();
  document.documentElement.style.overflow = "hidden";
}

/**
 * Let go of one lock. When it was the last, Lenis is re-synced to the
 * browser's real scroll position before it starts again — otherwise it
 * snaps back to the offset it held when it was stopped.
 *
 * `refresh` — pass true when pinned sections were measured while the page
 * was locked and had no scrollbar, so ScrollTrigger must re-measure now that
 * the real layout is back. It is honoured only by the unlock that actually
 * releases the page: the holder still covering it (RouteTransition, which
 * passes false) times its own refresh against the reveal.
 */
export function unlockScroll({ refresh = false } = {}): void {
  if (holders === 0) return;
  holders--;
  if (holders > 0) return;
  document.documentElement.style.overflow = "";
  window.__lenis?.scrollTo(window.scrollY, { immediate: true, force: true });
  window.__lenis?.start();
  if (refresh) ScrollTrigger.refresh();
}
