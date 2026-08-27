import { describe, expect, it } from "vitest";
import { bandCentre, slideIndexAt } from "../lensSlider";

describe("slideIndexAt", () => {
  it("parks a single slide at zero whatever the progress", () => {
    expect(slideIndexAt(0, 1)).toBe(0);
    expect(slideIndexAt(0.7, 1)).toBe(0);
    expect(slideIndexAt(1, 0)).toBe(0);
  });

  it("gives the first and last slide half a band and the middle ones a whole", () => {
    // Four slides: transitions at 1/6, 1/2, 5/6.
    expect(slideIndexAt(0, 4)).toBe(0);
    expect(slideIndexAt(0.16, 4)).toBe(0);
    expect(slideIndexAt(0.17, 4)).toBe(1);
    expect(slideIndexAt(0.49, 4)).toBe(1);
    expect(slideIndexAt(0.51, 4)).toBe(2);
    expect(slideIndexAt(0.84, 4)).toBe(3);
    expect(slideIndexAt(1, 4)).toBe(3);
  });

  it("clamps progress that runs past either end", () => {
    expect(slideIndexAt(-0.5, 3)).toBe(0);
    expect(slideIndexAt(1.5, 3)).toBe(2);
  });
});

describe("bandCentre", () => {
  it("is the inverse of slideIndexAt for every slide", () => {
    for (const count of [2, 3, 4, 7]) {
      for (let i = 0; i < count; i++) {
        expect(slideIndexAt(bandCentre(i, count), count)).toBe(i);
      }
    }
  });

  it("runs from the top of the stage to the bottom", () => {
    expect(bandCentre(0, 4)).toBe(0);
    expect(bandCentre(3, 4)).toBe(1);
    expect(bandCentre(9, 4)).toBe(1);
    expect(bandCentre(0, 1)).toBe(0);
  });
});
