import { describe, expect, it } from "vitest";
import {
  intField,
  list,
  localized,
  localizedLines,
  parseLocale,
  raw,
  str,
  validDate,
  validGithubUser,
  validKey,
  validLink,
  validPath,
} from "@/lib/forms";

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

describe("str / raw", () => {
  it("trims, and treats a missing field as empty", () => {
    const data = form({ title: "  hello  " });
    expect(str(data, "title")).toBe("hello");
    expect(str(data, "missing")).toBe("");
  });

  it("raw keeps the spaces copy depends on", () => {
    expect(raw(form({ prefix: "青岛 · " }), "prefix")).toBe("青岛 · ");
  });
});

describe("parseLocale", () => {
  it("accepts only the two locales", () => {
    expect(parseLocale("zh")).toBe("zh");
    expect(parseLocale("en")).toBe("en");
    expect(parseLocale("fr")).toBeNull();
    expect(parseLocale("")).toBeNull();
  });
});

describe("localized / localizedLines", () => {
  it("reads the .zh/.en pair", () => {
    expect(localized(form({ "title.zh": " 标题 ", "title.en": "Title" }), "title")).toEqual({
      zh: "标题",
      en: "Title",
    });
  });

  it("reads a textarea as lines, dropping blanks", () => {
    expect(
      localizedLines(form({ "intro.zh": "一\n\n  二  \n", "intro.en": "" }), "intro")
    ).toEqual({ zh: ["一", "二"], en: [] });
  });
});

describe("list", () => {
  it("splits on either comma and drops empties", () => {
    expect(list(form({ tags: "a, b，c,,  d " }), "tags")).toEqual(["a", "b", "c", "d"]);
    expect(list(form({ tags: "" }), "tags")).toEqual([]);
  });
});

describe("validKey", () => {
  it("takes lowercase slugs and nothing else", () => {
    expect(validKey("my-post-2")).toBe(true);
    expect(validKey("")).toBe(false);
    expect(validKey("-leading")).toBe(false);
    expect(validKey("Caps")).toBe(false);
    expect(validKey("with space")).toBe(false);
    expect(validKey("dots.in")).toBe(false);
  });
});

describe("validDate", () => {
  it("wants a real calendar day", () => {
    expect(validDate("2026-02-28")).toBe(true);
    expect(validDate("2024-02-29")).toBe(true);
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("2026-13-01")).toBe(false);
    expect(validDate("26-01-01")).toBe(false);
    expect(validDate("2026-1-1")).toBe(false);
    expect(validDate("")).toBe(false);
  });
});

describe("validPath / validLink", () => {
  it("a path is one slash and no way off the site", () => {
    expect(validPath("/blog")).toBe(true);
    expect(validPath("/")).toBe(true);
    expect(validPath("//evil.com")).toBe(false);
    expect(validPath("/\\evil.com")).toBe(false);
    expect(validPath("blog")).toBe(false);
    expect(validPath("https://a.b")).toBe(false);
  });

  it("a link is a path or a full http(s) URL", () => {
    expect(validLink("https://github.com/x/y")).toBe(true);
    expect(validLink("http://localhost:3000/")).toBe(true);
    expect(validLink("/portfolio/cover.jpg")).toBe(true);
    expect(validLink("javascript:alert(1)")).toBe(false);
    expect(validLink("data:text/html,hi")).toBe(false);
    expect(validLink("mailto:a@b.c")).toBe(false);
    expect(validLink("https://has space")).toBe(false);
    expect(validLink("")).toBe(false);
  });
});

describe("validGithubUser", () => {
  it("is an account name, not a URL", () => {
    expect(validGithubUser("fanhefeng")).toBe(true);
    expect(validGithubUser("a-b-1")).toBe(true);
    expect(validGithubUser("@fanhefeng")).toBe(false);
    expect(validGithubUser("github.com/fanhefeng")).toBe(false);
    expect(validGithubUser("")).toBe(false);
  });
});

describe("intField", () => {
  it("empty means the fallback", () => {
    expect(intField(form({}), "sort", "排序", 0)).toEqual({ ok: true, value: 0 });
    expect(intField(form({ hue: " " }), "hue", "色相", null)).toEqual({ ok: true, value: null });
  });

  it("accepts whole numbers only", () => {
    expect(intField(form({ sort: "12" }), "sort", "排序", 0)).toEqual({ ok: true, value: 12 });
    expect(intField(form({ sort: "-3" }), "sort", "排序", 0)).toEqual({ ok: true, value: -3 });
    expect(intField(form({ sort: "1.5" }), "sort", "排序", 0)).toEqual({
      ok: false,
      error: "排序要填整数。",
    });
    expect(intField(form({ sort: "abc" }), "sort", "排序", 0).ok).toBe(false);
    expect(intField(form({ sort: "1e400" }), "sort", "排序", 0).ok).toBe(false);
  });

  it("refuses what a Postgres integer column cannot hold", () => {
    expect(intField(form({ sort: "2147483647" }), "sort", "排序", 0)).toEqual({
      ok: true,
      value: 2147483647,
    });
    expect(intField(form({ sort: "2147483648" }), "sort", "排序", 0)).toEqual({
      ok: false,
      error: "排序超出范围了。",
    });
    expect(intField(form({ sort: "1e10" }), "sort", "排序", 0).ok).toBe(false);
    expect(intField(form({ sort: "-2147483649" }), "sort", "排序", 0).ok).toBe(false);
  });
});
