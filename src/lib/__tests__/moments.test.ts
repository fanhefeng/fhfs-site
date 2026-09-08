import { describe, expect, it } from "vitest";
import { collections, shouldFold, stampInZone } from "@/lib/moments";

describe("stampInZone", () => {
  it("prints the instant in the given zone, dots and a 24-hour clock", () => {
    // 11:28 UTC is 19:28 in Shanghai.
    expect(stampInZone("2017-07-29T11:28:12.000Z", "Asia/Shanghai")).toEqual({
      year: "2017",
      time: "2017.07.29 19:28",
    });
  });

  it("lets the zone move the calendar day, and the year with it", () => {
    expect(stampInZone("2023-12-31T17:30:00.000Z", "Asia/Shanghai")).toEqual({
      year: "2024",
      time: "2024.01.01 01:30",
    });
    expect(stampInZone("2024-01-01T00:10:00.000Z", "Asia/Shanghai").time).toBe("2024.01.01 08:10");
  });
});

describe("collections", () => {
  it("counts the notebooks in order of first appearance", () => {
    const rows = [
      { collection: "峰言疯语" },
      { collection: "默认文集" },
      { collection: "峰言疯语" },
      { collection: null },
    ];
    expect(collections(rows)).toEqual([
      { name: "峰言疯语", count: 2 },
      { name: "默认文集", count: 1 },
    ]);
  });

  it("does not make a notebook out of no notebook", () => {
    expect(collections([{ collection: null }, { collection: "" }])).toEqual([]);
  });
});

describe("shouldFold", () => {
  it("folds by line count before it folds by length", () => {
    expect(shouldFold(Array.from({ length: 11 }, () => "一行").join("\n"))).toBe(true);
    expect(shouldFold(Array.from({ length: 10 }, () => "一行").join("\n"))).toBe(false);
  });

  it("folds a long paragraph even on one line", () => {
    expect(shouldFold("字".repeat(361))).toBe(true);
    expect(shouldFold("字".repeat(360))).toBe(false);
  });
});
