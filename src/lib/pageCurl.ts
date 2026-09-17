/**
 * The geometry of a turning page.
 *
 * A leaf that pivots as one flat plane reads as a door, not as paper: real
 * paper bends, and the bend is what carries the weight. The cheap way to get
 * that in the DOM is to stop thinking of the page as a surface and think of it
 * as a chain — a run of narrow strips, each one a child of the last, each
 * rotated a little further about its own left edge. Nesting is what does the
 * work: a child inherits its parent's transform, so N small equal turns
 * accumulate into a polyline that approximates an arc, and the browser's own
 * 3D compositor draws it. No WebGL, no per-frame layout, no canvas.
 *
 * Everything here is pure trigonometry over the turn's progress, which is why
 * it lives in lib and is unit-tested: the component below it only writes the
 * numbers this returns onto CSS custom properties.
 *
 * Angles are radians throughout; the component converts once, at the edge.
 */

/** Strips per leaf. Eighteen is where the silhouette stops looking faceted. */
export const CURL_STRIPS = 18;

/**
 * How far the leaf bows at the middle of its turn, in radians.
 *
 * This is the one number with no correct value — it is how stiff the paper is.
 * Much past 0.8 the leaf curls into a tube and the far edge crosses back over
 * the near one; below about 0.3 it may as well be a flat door.
 */
export const CURL_PEAK = 0.6;

export type CurlPose = {
  /** Where the leading edge of the leaf points. */
  tilt: number;
  /** The turn added by each strip on top of the one before it. */
  delta: number;
  /** 0 → 1 → 0 across the turn; the shadow the leaf casts is hung on this. */
  lift: number;
};

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

/**
 * The pose of the whole leaf at progress `t` (0 = closed, 1 = turned).
 *
 * The leaf sweeps through half a circle, and the bow opens and closes with it
 * — flat when it is lying on the stack at either end, deepest as it passes
 * vertical. `tilt` runs ahead of the sweep by exactly the bow, so the chain
 * straddles the true angle: the first strip leads by `peak`, the last trails
 * by the same, and the leaf as a whole still points where it should.
 */
export function curlPose(t: number, strips = CURL_STRIPS, peak = CURL_PEAK): CurlPose {
  const p = clamp01(t);
  const sweep = Math.PI * p;
  const bow = peak * Math.sin(Math.PI * p);
  return {
    tilt: sweep + bow,
    delta: (2 * bow) / strips,
    lift: Math.sin(Math.PI * p),
  };
}

/** Which way strip `i` faces, in world terms — its own edge, not its parent's. */
export function stripFacing(i: number, pose: CurlPose): number {
  return pose.tilt - i * pose.delta;
}

/**
 * How much light strip `i` catches, at its near and far edge.
 *
 * `|cos|` because a strip edge-on to the reader is dark whichever side of the
 * paper is showing, and face-on is lit either way. Taking it at both edges
 * rather than once at the middle is what lets the shading run as a gradient
 * ACROSS each strip: with one value per strip the bend reads as eighteen flat
 * facets, and the whole point of the chain was to not look like that.
 */
export function stripLight(i: number, pose: CurlPose): { near: number; far: number } {
  return {
    near: Math.abs(Math.cos(stripFacing(i, pose))),
    far: Math.abs(Math.cos(stripFacing(i + 1, pose))),
  };
}

/**
 * Which face of the leaf the reader is looking at.
 *
 * Past the quarter turn the front has gone edge-on and what is coming round is
 * the back — the next page. The component swaps which image is on top here,
 * because a CSS `backface-visibility` flip cannot express "and the shading
 * belongs to the other side now".
 */
export function showsBack(pose: CurlPose): boolean {
  return pose.tilt - CURL_PEAK > Math.PI / 2;
}

/**
 * Pair a flat list of pictures into spreads: left page, right page.
 *
 * An odd tail gets a right page of `null` — a real album ends on a blank
 * recto as often as not, and inventing a filler picture to square it off
 * would be worse.
 */
export function spreads<T>(items: readonly T[]): [T, T | null][] {
  const out: [T, T | null][] = [];
  for (let i = 0; i < items.length; i += 2) {
    out.push([items[i], i + 1 < items.length ? items[i + 1] : null]);
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────
   driving the turn by hand
   ──────────────────────────────────────────────────────────────────────── */

/**
 * How far the leaf has been dragged, as turn progress.
 *
 * The denominator is the part worth explaining: a page is considered fully
 * turned after the hand has crossed a bit less than two-thirds of the book's
 * width, not all of it. Requiring the full width means the last stretch of
 * every turn is a slow crawl to the edge of the screen; requiring much less
 * makes the page fly away from under the finger.
 */
const DRAG_SPAN = 0.62;

export function dragProgress(dx: number, dir: 1 | -1, width: number): number {
  const raw = (dir === 1 ? -dx : dx) / (width * DRAG_SPAN);
  // `raw > 0` rather than `raw < 0 ? 0`, so a dead-still pointer gives +0 and
  // not the -0 that a negated zero produces.
  return raw > 0 ? (raw > 1 ? 1 : raw) : 0;
}

/**
 * Let go: does the page finish turning, or fall back?
 *
 * Past the mid-point it goes, obviously. Under it, a flick still counts —
 * which is what separates a page you threw from a page you thought better of
 * and eased back. Without the velocity term a quick short swipe just sags
 * back, and the book feels like it is ignoring you.
 */
export const COMMIT_AT = 0.42;
export const COMMIT_VELOCITY = 1.1;

export function shouldCommit(t: number, velocity: number): boolean {
  return t > COMMIT_AT || velocity > COMMIT_VELOCITY;
}

/** Under this many pixels of travel, a press was a tap and simply turns. */
export const TAP_SLOP = 6;

/* ────────────────────────────────────────────────────────────────────────
   the spring
   ──────────────────────────────────────────────────────────────────────── */

export type Spring = { value: number; velocity: number };

/**
 * One step of a damped spring, integrated semi-implicitly.
 *
 * A page released mid-turn should arrive the way a real one does — carrying
 * the speed it already had, overshooting a hair, settling. A fixed-duration
 * tween cannot do that: it restarts from zero velocity and takes the same
 * time whether the page was flicked or nudged.
 *
 * Committing is stiffer than cancelling, because a page falling closed has
 * gravity helping it and a page springing back does not.
 */
export const SPRING_COMMIT = { k: 170, c: 26 } as const;
export const SPRING_CANCEL = { k: 150, c: 24 } as const;

export function springStep(
  s: Spring,
  target: number,
  dt: number,
  k: number,
  c: number
): Spring {
  const x = s.value - target;
  const velocity = s.velocity + (-k * x - c * s.velocity) * dt;
  return { value: s.value + velocity * dt, velocity };
}

/** Close enough, and slow enough, to stop integrating and snap. */
export function springSettled(s: Spring, target: number): boolean {
  return Math.abs(s.value - target) < 0.002 && Math.abs(s.velocity) < 0.02;
}

/* ────────────────────────────────────────────────────────────────────────
   the book's own lean
   ──────────────────────────────────────────────────────────────────────── */

/** Degrees. Deliberately small — this is a book on a table, not a carousel. */
export const TILT_X = 4.5;
export const TILT_Y = 7;

/**
 * How close the reader may lean in, and how far back.
 *
 * A double-click toggles between resting size and ZOOM_IN rather than offering
 * a continuous zoom: the wheel belongs to the page — a study that swallowed it
 * would trap the reader inside a figure halfway down a long article.
 */
export const ZOOM_MIN = 0.9;
export const ZOOM_MAX = 1.5;
export const ZOOM_IN = 1.35;

/**
 * Where the book leans when the pointer is at (cx, cy) over rect `r`.
 *
 * Divided by more than half the box on each axis so the lean saturates before
 * the pointer reaches the edge: the corners of a book do not keep tipping
 * further the further past them you go.
 */
export function tiltFor(
  cx: number,
  cy: number,
  r: { left: number; top: number; width: number; height: number }
): { rx: number; ry: number } {
  const clamp = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v);
  const nx = clamp((cx - (r.left + r.width / 2)) / (r.width * 0.62));
  const ny = clamp((cy - (r.top + r.height / 2)) / (r.height * 0.9));
  return { rx: -ny * TILT_X, ry: nx * TILT_Y };
}
