import "client-only";

import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { CustomWiggle } from "gsap/CustomWiggle";
// Importing the core module first is what guarantees CustomEase is already
// registered when CustomWiggle, which builds on it, registers below.
import { gsap } from "./gsap";

/**
 * The plugins only a few leaf components use. Importing this module registers
 * them; `./gsap` stays the entry for everything shared.
 *
 * - Draggable + InertiaPlugin: the sticker wall, the 404
 *   peel — `inertia: true` and the flick physics.
 * - ScrambleTextPlugin: the Latin headline decode on a post (`scrambleText:`).
 * - CustomWiggle: the hover shiver on a sticker (`"wiggle(…)"` ease strings).
 *
 * A component that needs one of these imports it from here and keeps
 * importing `gsap` / `useGSAP` / `EASE` from `@/lib/client/gsap`.
 */
gsap.registerPlugin(Draggable, InertiaPlugin, ScrambleTextPlugin, CustomWiggle);

// Only the class a component actually names is exported. The rest work from
// registration alone — `inertia: true`, `scrambleText:`, `"wiggle(…)"`.
export { Draggable };
