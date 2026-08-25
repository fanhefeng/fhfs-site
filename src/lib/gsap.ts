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
 * Motion tokens — the only sanctioned eases. No magic ease strings in
 * components:
 * - `default`  critically damped arrive; entrances, hovers, reveals.
 * - `momentum` slight overshoot; ONLY for gestures that carry velocity
 *              (flicks, thrown cards) — a menu fading in never bounces.
 * - `exit`     reversed feel for departures; pair with timeScale(2–2.5)
 *              so exits stay crisp.
 */
export const EASE = {
  default: "power3.out",
  momentum: "back.out(1.2)",
  exit: "power2.in",
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
