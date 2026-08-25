"use client";

import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { CustomWiggle } from "gsap/CustomWiggle";
import { ExpoScaleEase } from "gsap/EasePack";
// Importing the core module first is what guarantees CustomEase is already
// registered when CustomWiggle, which builds on it, registers below.
import { gsap } from "./gsap";

/**
 * The plugins only a few leaf components use. Importing this module registers
 * them; `./gsap` stays the entry for everything shared.
 *
 * - Draggable + InertiaPlugin: the sticker wall, the phone app rail, the 404
 *   peel — `inertia: true` and the flick physics.
 * - ScrambleTextPlugin: the Latin headline decode on a post (`scrambleText:`).
 * - CustomWiggle: the hover shiver on a sticker (`"wiggle(…)"` ease strings).
 * - ExpoScaleEase: constant-speed zooms. Build it from `.config(from, to)`;
 *   GSAP 3.15 never resolves the `"expoScale(1,5)"` string form.
 *
 * A component that needs one of these imports it from here and keeps
 * importing `gsap` / `useGSAP` / `EASE` from `@/lib/gsap`.
 */
gsap.registerPlugin(
  Draggable,
  InertiaPlugin,
  ScrambleTextPlugin,
  CustomWiggle,
  ExpoScaleEase
);

// InertiaPlugin, ScrambleTextPlugin and CustomWiggle are re-exported for the
// odd case that wants the class; their string forms work from registration
// alone.
export {
  Draggable,
  InertiaPlugin,
  ScrambleTextPlugin,
  CustomWiggle,
  ExpoScaleEase,
};
