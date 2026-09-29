import { describe, expect, it } from "vite-plus/test";
import { splitText, type SplitLine } from "@/lib/splitText";

/** The words of a line as plain strings — what a test wants to compare. */
const flatten = (line: SplitLine) => line.map((word) => word.chars.map((c) => c.char).join(""));

describe("splitText", () => {
  it("keeps a Latin word together and gives a space its own word", () => {
    const { lines, total } = splitText("ab cd");
    expect(lines).toHaveLength(1);
    expect(flatten(lines[0]!)).toEqual(["ab", " ", "cd"]);
    expect(lines[0]!.map((w) => w.isSpace)).toEqual([false, true, false]);
    expect(total).toBe(5);
  });

  it("numbers every glyph in order, across words and lines", () => {
    const { lines, total } = splitText("a\nbc");
    expect(lines).toHaveLength(2);
    expect(lines[0]![0]!.chars).toEqual([{ char: "a", index: 0 }]);
    expect(lines[1]![0]!.chars).toEqual([
      { char: "b", index: 1 },
      { char: "c", index: 2 },
    ]);
    expect(total).toBe(3);
  });

  it("splits CJK into one word per character", () => {
    expect(flatten(splitText("你好").lines[0]!)).toEqual(["你", "好"]);
  });

  it("hangs closing punctuation on the word before it", () => {
    expect(flatten(splitText("你好，世界。").lines[0]!)).toEqual(["你", "好，", "世", "界。"]);
  });

  it("does not hang punctuation on a space, or on nothing", () => {
    expect(flatten(splitText("你 ，").lines[0]!)).toEqual(["你", " ", "，"]);
    expect(flatten(splitText("，").lines[0]!)).toEqual(["，"]);
  });

  it("hangs CJK punctuation on a Latin run, and breaks after it", () => {
    expect(flatten(splitText("ab，").lines[0]!)).toEqual(["ab，"]);
    expect(flatten(splitText("React，好").lines[0]!)).toEqual(["React，", "好"]);
  });

  it("hangs the closing marks that are not CJK themselves", () => {
    // ” … — are outside every CJK block, and used to open a word of their own.
    expect(flatten(splitText("“你好”……").lines[0]!)).toEqual(["“", "你", "好”……"]);
    expect(flatten(splitText("好——走").lines[0]!)).toEqual(["好——", "走"]);
  });

  it("keeps a Latin mark inside its word", () => {
    expect(flatten(splitText("it’s 50%").lines[0]!)).toEqual(["it’s", " ", "50%"]);
  });

  it("does not take Hangul, or a compatibility ideograph's twin range, for CJK", () => {
    // Korean breaks between words, not between syllables.
    expect(flatten(splitText("안녕 하세요").lines[0]!)).toEqual(["안녕", " ", "하세요"]);
    // U+F900 itself is still one.
    expect(flatten(splitText("\uF900\uF901").lines[0]!)).toEqual(["\uF900", "\uF901"]);
  });

  it("treats a tab like a space", () => {
    expect(flatten(splitText("a\tb").lines[0]!)).toEqual(["a", "\t", "b"]);
    expect(splitText("a\tb").lines[0]![1]!.isSpace).toBe(true);
  });

  it("keeps a surrogate pair as one glyph", () => {
    // The emoji is one char with one index, never two halves, and it is not
    // CJK: it glues to the Latin run beside it.
    const { lines, total } = splitText("👍a");
    expect(flatten(lines[0]!)).toEqual(["👍a"]);
    expect(lines[0]![0]!.chars).toEqual([
      { char: "👍", index: 0 },
      { char: "a", index: 1 },
    ]);
    expect(total).toBe(2);
  });

  it("splits an ideograph outside the BMP like any other", () => {
    expect(flatten(splitText("𠀀好").lines[0]!)).toEqual(["𠀀", "好"]);
  });

  it("returns one empty line for the empty string", () => {
    expect(splitText("")).toEqual({ lines: [[]], total: 0 });
  });
});
