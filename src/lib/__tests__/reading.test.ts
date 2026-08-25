import { describe, expect, it } from "vitest";
import { HAS_CJK, readingMinutes } from "@/lib/reading";

const words = (n: number) => "word ".repeat(n);
const cjk = (n: number) => "字".repeat(n);

describe("readingMinutes", () => {
  it("never reports less than a minute", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("hi")).toBe(1);
  });

  it("counts Latin at ~220 words a minute", () => {
    expect(readingMinutes(words(220))).toBe(1);
    expect(readingMinutes(words(440))).toBe(2);
    expect(readingMinutes(words(330))).toBe(2); // rounds, not floors
  });

  it("counts CJK at ~350 characters a minute", () => {
    expect(readingMinutes(cjk(350))).toBe(1);
    expect(readingMinutes(cjk(700))).toBe(2);
  });

  it("adds the two scripts together", () => {
    expect(readingMinutes(cjk(350) + " " + words(220))).toBe(2);
  });

  it("does not read code fences", () => {
    expect(readingMinutes("```\n" + words(1000) + "\n```")).toBe(1);
  });

  it("does not read HTML tags", () => {
    // 500 bare "span" tokens would otherwise be two minutes of prose.
    expect(readingMinutes("<span>".repeat(500))).toBe(1);
  });

  it("does not read bare URLs", () => {
    expect(readingMinutes("https://example.com/a-b-c/d ".repeat(500))).toBe(1);
  });

  it("keeps apostrophes and hyphens inside a word", () => {
    // "don't" and "well-known" are one word each: 440 of them is two minutes,
    // not four.
    expect(readingMinutes("don't well-known ".repeat(220))).toBe(2);
  });
});

describe("HAS_CJK", () => {
  it("is stateless — the same string answers the same twice", () => {
    expect(HAS_CJK.test("你好")).toBe(true);
    expect(HAS_CJK.test("你好")).toBe(true);
    expect(HAS_CJK.test("hello")).toBe(false);
    expect(HAS_CJK.test("hello 世界")).toBe(true);
  });
});
