import { describe, expect, it } from "vite-plus/test";
import { inLocale, langOfText } from "@/lib/localized";

describe("inLocale", () => {
  const row = {
    key: "odyssey",
    year: "1995",
    track: null,
    title: { zh: "大话西游", en: "A Chinese Odyssey" },
    story: { zh: ["一", "二"], en: ["One"] },
    stills: [{ id: "a", width: 1, title: { zh: "齐天大圣", en: "" } }],
  };

  it("replaces every pair by its side, at any depth", () => {
    expect(inLocale(row, "en")).toEqual({
      key: "odyssey",
      year: "1995",
      track: null,
      title: "A Chinese Odyssey",
      story: ["One"],
      // An empty side reads the other one.
      stills: [{ id: "a", width: 1, title: "齐天大圣" }],
    });
    expect(inLocale(row, "zh").story).toEqual(["一", "二"]);
  });

  it("falls back on an empty list of lines too", () => {
    expect(inLocale({ zh: [], en: ["Only English"] }, "zh")).toEqual(["Only English"]);
  });

  it("leaves an object with more than a zh and an en alone", () => {
    expect(inLocale({ zh: "x", en: "y", note: "z" }, "en")).toEqual({
      zh: "x",
      en: "y",
      note: "z",
    });
  });
});

describe("langOfText", () => {
  it("tags a line by its own words", () => {
    expect(langOfText("I love you three thousand")).toBe("en");
    expect(langOfText("我爱你三千遍")).toBe("zh-CN");
  });

  it("reads a line with any Han character in it as Chinese", () => {
    expect(langOfText("路小雨 · Lu Xiaoyu")).toBe("zh-CN");
    expect(langOfText("")).toBe("en");
  });
});
