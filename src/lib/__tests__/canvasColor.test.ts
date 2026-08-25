import { describe, expect, it } from "vitest";
import { parseColor, type Rgb } from "@/lib/canvasColor";

const FALLBACK: Rgb = [1, 2, 3];

describe("parseColor", () => {
  it("reads #rgb by doubling each digit", () => {
    expect(parseColor("#fff", FALLBACK)).toEqual([255, 255, 255]);
    expect(parseColor("#abc", FALLBACK)).toEqual([170, 187, 204]);
    expect(parseColor("#000", FALLBACK)).toEqual([0, 0, 0]);
  });

  it("reads #rrggbb in either case", () => {
    expect(parseColor("#4c7a5b", FALLBACK)).toEqual([76, 122, 91]);
    expect(parseColor("#4C7A5B", FALLBACK)).toEqual([76, 122, 91]);
  });

  it("drops the alpha of #rrggbbaa", () => {
    expect(parseColor("#4c7a5b80", FALLBACK)).toEqual([76, 122, 91]);
  });

  it("reads rgb() and rgba(), dropping alpha", () => {
    expect(parseColor("rgb(10, 20, 30)", FALLBACK)).toEqual([10, 20, 30]);
    expect(parseColor("rgba(10, 20, 30, 0.5)", FALLBACK)).toEqual([10, 20, 30]);
    expect(parseColor("rgb(1.5 2.5 3.5 / 50%)", FALLBACK)).toEqual([1.5, 2.5, 3.5]);
  });

  it("ignores surrounding whitespace", () => {
    expect(parseColor("  #fff  ", FALLBACK)).toEqual([255, 255, 255]);
  });

  it("returns the fallback itself for anything it cannot read", () => {
    for (const input of ["", "   ", "#12", "#xyz", "#zz0000", "rgb(1, 2)", "not a color"]) {
      expect(parseColor(input, FALLBACK)).toBe(FALLBACK);
    }
  });
});
