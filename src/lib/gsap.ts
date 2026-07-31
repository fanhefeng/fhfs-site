"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";
import { CustomWiggle } from "gsap/CustomWiggle";
import { Flip } from "gsap/Flip";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { ExpoScaleEase } from "gsap/EasePack";

// Single registration point — import gsap from here in all fx components.
// CustomWiggle depends on CustomEase, so keep CustomEase registered first.
// ExpoScaleEase makes `expoScale(from,to)` parseable — the bento scrub on
// /portfolio needs it so a zoom reads as constant-speed.
gsap.registerPlugin(
  useGSAP,
  ScrollTrigger,
  SplitText,
  CustomEase,
  CustomWiggle,
  Flip,
  Draggable,
  InertiaPlugin,
  ScrambleTextPlugin,
  ExpoScaleEase
);

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

export {
  gsap,
  useGSAP,
  ScrollTrigger,
  SplitText,
  CustomEase,
  CustomWiggle,
  Flip,
  Draggable,
  InertiaPlugin,
  ScrambleTextPlugin,
  ExpoScaleEase,
};
