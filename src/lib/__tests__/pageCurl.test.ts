import { describe, expect, it } from "vitest";
import {
  CURL_PEAK,
  CURL_STRIPS,
  COMMIT_AT,
  COMMIT_VELOCITY,
  curlPose,
  dragProgress,
  shouldCommit,
  spreads,
  springStep,
  springSettled,
  SPRING_COMMIT,
  stripFacing,
  stripLight,
  showsBack,
  tiltFor,
  TILT_X,
  TILT_Y,
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

describe("dragProgress", () => {
  it("is nothing until the hand moves", () => {
    expect(dragProgress(0, 1, 800)).toBe(0);
  });

  it("follows the hand the way the page goes", () => {
    // Forward turns are dragged leftwards, so a negative dx opens them.
    expect(dragProgress(-248, 1, 800)).toBeCloseTo(0.5, 6);
    expect(dragProgress(248, -1, 800)).toBeCloseTo(0.5, 6);
  });

  it("ignores a drag against the grain", () => {
    expect(dragProgress(200, 1, 800)).toBe(0);
    expect(dragProgress(-200, -1, 800)).toBe(0);
  });

  it("stops at fully turned however far the hand goes", () => {
    expect(dragProgress(-4000, 1, 800)).toBe(1);
  });
});

describe("shouldCommit", () => {
  it("finishes a page dragged past the middle", () => {
    expect(shouldCommit(COMMIT_AT + 0.01, 0)).toBe(true);
  });

  it("falls back from a page barely lifted", () => {
    expect(shouldCommit(0.2, 0)).toBe(false);
  });

  it("takes a flick even when the page hardly moved", () => {
    expect(shouldCommit(0.1, COMMIT_VELOCITY + 0.1)).toBe(true);
  });
});

describe("springStep", () => {
  it("arrives, and stays arrived", () => {
    let s = { value: 0, velocity: 0 };
    for (let i = 0; i < 400 && !springSettled(s, 1); i++) {
      s = springStep(s, 1, 1 / 60, SPRING_COMMIT.k, SPRING_COMMIT.c);
    }
    expect(springSettled(s, 1)).toBe(true);
    expect(s.value).toBeCloseTo(1, 2);
  });

  it("carries the speed it was released with", () => {
    const thrown = springStep({ value: 0.3, velocity: 4 }, 1, 1 / 60, SPRING_COMMIT.k, SPRING_COMMIT.c);
    const nudged = springStep({ value: 0.3, velocity: 0 }, 1, 1 / 60, SPRING_COMMIT.k, SPRING_COMMIT.c);
    expect(thrown.value).toBeGreaterThan(nudged.value);
  });

  it("does not run away", () => {
    let s = { value: 0, velocity: 0 };
    for (let i = 0; i < 600; i++) {
      s = springStep(s, 1, 1 / 60, SPRING_COMMIT.k, SPRING_COMMIT.c);
      expect(Number.isFinite(s.value)).toBe(true);
      expect(Math.abs(s.value)).toBeLessThan(3);
    }
  });
});

describe("tiltFor", () => {
  const box = { left: 0, top: 0, width: 800, height: 400 };

  it("sits flat when the pointer is at the middle", () => {
    const { rx, ry } = tiltFor(400, 200, box);
    expect(rx).toBeCloseTo(0, 10);
    expect(ry).toBeCloseTo(0, 10);
  });

  it("leans toward the pointer, and is not yet at full lean at the edge", () => {
    // The divisor is wider than the box on purpose: at the right-hand edge the
    // lean is still short of its limit, and only saturates past the book.
    const atEdge = tiltFor(800, 200, box).ry;
    expect(atEdge).toBeGreaterThan(0);
    expect(atEdge).toBeLessThan(TILT_Y);
    expect(tiltFor(4000, 200, box).ry).toBeCloseTo(TILT_Y, 6);
    // Up is a positive X rotation here, so a pointer above centre tips it back.
    expect(tiltFor(400, 0, box).rx).toBeGreaterThan(0);
  });

  it("never exceeds its own limits", () => {
    for (const [x, y] of [[-9999, -9999], [9999, 9999], [0, 400], [800, 0]]) {
      const { rx, ry } = tiltFor(x!, y!, box);
      expect(Math.abs(rx)).toBeLessThanOrEqual(TILT_X + 1e-9);
      expect(Math.abs(ry)).toBeLessThanOrEqual(TILT_Y + 1e-9);
    }
  });
});
