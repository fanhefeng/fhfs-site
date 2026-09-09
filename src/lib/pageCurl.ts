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

/** Strips per leaf. Sixteen is where the silhouette stops looking faceted. */
export const CURL_STRIPS = 16;

/**
 * How far the leaf bows at the middle of its turn, in radians.
 *
 * This is the one number with no correct value — it is how stiff the paper is.
 * Much past 0.8 the leaf curls into a tube and the far edge crosses back over
 * the near one; below about 0.3 it may as well be a flat door.
 */
export const CURL_PEAK = 0.44;

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
 * ACROSS each strip: with one value per strip the bend reads as sixteen flat
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
