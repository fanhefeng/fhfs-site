import { describe, expect, it } from "vitest";
import { splitText, type SplitLine } from "@/lib/splitText";

/** The words of a line as plain strings — what a test wants to compare. */
const flatten = (line: SplitLine) =>
  line.map((word) => word.chars.map((c) => c.char).join(""));

describe("splitText", () => {
  it("keeps a Latin word together and gives a space its own word", () => {
    const { lines, total } = splitText("ab cd");
    expect(lines).toHaveLength(1);
    expect(flatten(lines[0])).toEqual(["ab", " ", "cd"]);
    expect(lines[0].map((w) => w.isSpace)).toEqual([false, true, false]);
    expect(total).toBe(5);
  });

  it("numbers every glyph in order, across words and lines", () => {
    const { lines, total } = splitText("a\nbc");
    expect(lines).toHaveLength(2);
    expect(lines[0][0].chars).toEqual([{ char: "a", index: 0 }]);
    expect(lines[1][0].chars).toEqual([
      { char: "b", index: 1 },
      { char: "c", index: 2 },
    ]);
    expect(total).toBe(3);
  });

  it("splits CJK into one word per character", () => {
    expect(flatten(splitText("你好").lines[0])).toEqual(["你", "好"]);
  });

  it("hangs closing punctuation on the word before it", () => {
    expect(flatten(splitText("你好，世界。").lines[0])).toEqual([
      "你",
      "好，",
      "世",
      "界。",
    ]);
  });

  it("does not hang punctuation on a space, or on nothing", () => {
    expect(flatten(splitText("你 ，").lines[0])).toEqual(["你", " ", "，"]);
    expect(flatten(splitText("，").lines[0])).toEqual(["，"]);
  });

  it("breaks a Latin run before CJK punctuation rather than into it", () => {
    // "ab" is still in the pending buffer when "，" arrives, so there is no
    // finished word to attach to; the run is flushed and "，" stands alone.
    expect(flatten(splitText("ab，").lines[0])).toEqual(["ab", "，"]);
  });

  it("treats a tab like a space", () => {
    expect(flatten(splitText("a\tb").lines[0])).toEqual(["a", "\t", "b"]);
    expect(splitText("a\tb").lines[0][1].isSpace).toBe(true);
  });

  it("keeps a surrogate pair as one glyph", () => {
    // The emoji is one char with one index, never two halves. (Its high
    // surrogate happens to satisfy the CJK test, so it also stands as its
    // own word rather than gluing to the "a" — that is the current
    // behaviour, pinned rather than endorsed.)
    const { lines, total } = splitText("👍a");
    expect(flatten(lines[0])).toEqual(["👍", "a"]);
    expect(lines[0][0].chars).toEqual([{ char: "👍", index: 0 }]);
    expect(total).toBe(2);
  });

  it("returns one empty line for the empty string", () => {
    expect(splitText("")).toEqual({ lines: [[]], total: 0 });
  });
});
