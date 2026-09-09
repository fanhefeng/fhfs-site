import { describe, expect, it } from "vitest";
import {
  CURL_PEAK,
  CURL_STRIPS,
  curlPose,
  spreads,
  stripFacing,
  stripLight,
  showsBack,
} from "../pageCurl";

describe("curlPose", () => {
  it("lies flat at both ends of the turn", () => {
    for (const t of [0, 1]) {
      const pose = curlPose(t);
      expect(pose.delta).toBeCloseTo(0, 10);
      expect(pose.lift).toBeCloseTo(0, 10);
    }
  });

  it("sweeps through half a circle", () => {
    expect(curlPose(0).tilt).toBeCloseTo(0, 10);
    expect(curlPose(1).tilt).toBeCloseTo(Math.PI, 10);
  });

  it("bows deepest at the middle", () => {
    const mid = curlPose(0.5);
    expect(mid.lift).toBeCloseTo(1, 10);
    // The chain straddles the true angle: it leads by the full peak here.
    expect(mid.tilt - Math.PI / 2).toBeCloseTo(CURL_PEAK, 10);
  });

  it("spreads the bow evenly across the chain", () => {
    const pose = curlPose(0.5);
    // First strip leads by the peak, last trails by it — so the leaf as a
    // whole still points where the sweep says, which is what keeps the hinge
    // from drifting off the gutter.
    expect(stripFacing(0, pose) - Math.PI / 2).toBeCloseTo(CURL_PEAK, 10);
    expect(stripFacing(CURL_STRIPS, pose) - Math.PI / 2).toBeCloseTo(-CURL_PEAK, 10);
  });

  it("clamps progress outside the turn", () => {
    expect(curlPose(-1).tilt).toBe(curlPose(0).tilt);
    expect(curlPose(2).tilt).toBe(curlPose(1).tilt);
  });
});

describe("stripLight", () => {
  it("hands neighbouring strips a continuous seam", () => {
    const pose = curlPose(0.35);
    for (let i = 0; i < CURL_STRIPS - 1; i++) {
      // One strip's far edge is the next one's near edge; if these drifted
      // apart the shading would band at every seam.
      expect(stripLight(i, pose).far).toBeCloseTo(stripLight(i + 1, pose).near, 12);
    }
  });

  it("darkens as a strip turns edge-on", () => {
    const pose = curlPose(0.5);
    const facing = stripLight(0, pose).near;
    // At half a turn the leading strip is past vertical and nearly edge-on.
    expect(facing).toBeLessThan(0.7);
  });

  it("stays within the unit range", () => {
    for (let s = 0; s <= 20; s++) {
      const pose = curlPose(s / 20);
      for (let i = 0; i <= CURL_STRIPS; i++) {
        const { near, far } = stripLight(i, pose);
        expect(near).toBeGreaterThanOrEqual(0);
        expect(near).toBeLessThanOrEqual(1);
        expect(far).toBeGreaterThanOrEqual(0);
        expect(far).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("showsBack", () => {
  it("keeps the front up for the first half and turns over after", () => {
    expect(showsBack(curlPose(0))).toBe(false);
    expect(showsBack(curlPose(0.2))).toBe(false);
    expect(showsBack(curlPose(0.8))).toBe(true);
    expect(showsBack(curlPose(1))).toBe(true);
  });
});

describe("spreads", () => {
  it("pairs pictures left and right", () => {
    expect(spreads([1, 2, 3, 4])).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("ends on a blank recto when the count is odd", () => {
    expect(spreads([1, 2, 3])).toEqual([
      [1, 2],
      [3, null],
    ]);
  });

  it("has nothing to show for an empty album", () => {
    expect(spreads([])).toEqual([]);
  });
});
