"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";
import { Flip } from "gsap/Flip";

// The registration point for what the shell itself needs — import gsap from
// here in every fx component. Only the plugins that are on every page get
// registered here: the Header's Flip, Reveal's ScrollTrigger, the headline
// SplitText, and CustomEase because the others build on it. Draggable,
// InertiaPlugin, ScrambleTextPlugin, CustomWiggle and the EasePack eases are
// each used by one or two leaf components and live in `./gsap-extras`, so
// the pages that never drag, scramble or wiggle do not ship them.
gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, CustomEase, Flip);

// Site-wide spring language: critically damped by default (no overshoot).
// Components only override deliberately, via the EASE table below.
gsap.defaults({ duration: 0.35, ease: "power3.out" });

/**
 * Motion tokens — the only sanctioned eases. No ease strings in components:
 * `conventions.test.ts` fails on an `ease: "…"` anywhere else in `src/`.
 * Named for what they are used for, not for the curve; a new curve gets a
 * token here, with the place it serves, before it gets a call site.
 */
export const EASE = {
  /** Critically damped arrive; entrances, hovers, the nav's settle. */
  default: "power3.out",
  /** A gentler arrive: the scroll reveal, pointer-follow, small fades in. */
  soft: "power2.out",
  /** Slight overshoot; ONLY for gestures that carry velocity (flicks, thrown
   *  cards) and the few entrances that land on one — a menu fading in never
   *  bounces. */
  momentum: "back.out(1.2)",
  /** Reversed feel for departures; pair with timeScale(2–2.5) so exits stay
   *  crisp. */
  exit: "power2.in",
  /** A departure that lingers a beat and then snaps clear: the route veil,
   *  the fan folding its elastic arrival back up. */
  depart: "power3.in",
  /** At rest at both ends — a thing moving from one place to another: Flip
   *  reflows, the grid's height, the island's width, the lens's slide, the
   *  splash's iris. */
  travel: "power2.inOut",
  /** Light opacity changes: a bulb, a wordmark, a caption. */
  fadeIn: "power1.out",
  fadeOut: "power1.in",
  crossfade: "power1.inOut",
  /** Constant rate. Anything scrubbed by scroll must be linear, or a pixel of
   *  scroll stops being a pixel of travel; also a spill of light that should
   *  not accelerate. */
  linear: "none",
  /** A line rising out of its mask, fast then long: the masthead. */
  unveil: "expo.out",
  /** Springs into place: the radial fan, a sticker landing. */
  spring: "elastic.out(1, 0.5)",
  /** The magnet letting go — a slightly looser spring than `spring`. */
  release: "elastic.out(1, 0.4)",
  /** The fan's "+" snapping round into a "×". */
  pop: "back.out(1.7)",
  /** The island's tray stretching open under a click. */
  stretch: "back.out(2)",
  /** A changelog year bubble swelling as the rail reaches it. */
  bubble: "back.out(2.4)",
  /** A sticker's shiver on hover — needs CustomWiggle from `./gsap-extras`. */
  shiver: "wiggle({ wiggles: 7, type: easeOut })",
} as const;

/**
 * The one motion signal the site still branches on, and a deliberately narrow
 * one: everybody gets the full-motion version (DESIGN.md §1.5). What this gates
 * is the short list that has no stop button otherwise — six places in all:
 * three endless CSS loops (`.aurora-blob`, `.grain-layer`, `.pulse-stepped`,
 * all in one media block in globals.css), the endless dot-matrix canvas
 * (DotDoodle), the inertial scroll hijack (SmoothScroll) and the opening
 * blackout (OvertureLight). Entrances, reveals, curtains and hover effects
 * are not on it.
 *
 * The grove is the same exception under the same test — the moss is an endless
 * full-screen loop — and the one place that does not call this: `GroveScene`
 * and `LiquidPill` hold the MediaQueryList itself, because they read it every
 * frame (the clock stands still while it matches) and a setting changed
 * mid-visit has to land without a remount.
 *
 * Reads the live browser, so it belongs in an effect, never in a render path
 * that also runs on the server.
 */
export const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Mouse-class pointer — the gate on every hover-driven effect. */
export const isFinePointer = (): boolean =>
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// CustomEase is not re-exported: registration alone makes its string form
// parseable, and no component imports the class.
export { gsap, useGSAP, ScrollTrigger, SplitText, Flip };
