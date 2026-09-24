import { describe, expect, it } from "vitest";
import {
  KEY_PATTERN,
  formatMedia,
  intField,
  list,
  localized,
  localizedLines,
  parseLocale,
  parseMedia,
  parseMomentTime,
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
    expect(localizedLines(form({ "intro.zh": "一\n\n  二  \n", "intro.en": "" }), "intro")).toEqual(
      { zh: ["一", "二"], en: [] },
    );
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

  it("is a pattern a browser can compile — `<input pattern>` uses the v flag", () => {
    // An unescaped hyphen in a class throws here, and in a form it would
    // just quietly switch the constraint off.
    const asBrowser = new RegExp(`^(?:${KEY_PATTERN})$`, "v");
    expect(asBrowser.test("my-post-2")).toBe(true);
    expect(asBrowser.test("-leading")).toBe(false);
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

describe("parseMomentTime", () => {
  it("reads a minute in the site's zone as the instant it is", () => {
    expect(parseMomentTime("2026-09-07 23:15")?.toISOString()).toBe("2026-09-07T15:15:00.000Z");
    expect(parseMomentTime("2026-09-07T23:15")?.toISOString()).toBe("2026-09-07T15:15:00.000Z");
    expect(parseMomentTime("2026-01-01 00:00")?.toISOString()).toBe("2025-12-31T16:00:00.000Z");
  });

  it("refuses a minute that does not exist", () => {
    expect(parseMomentTime("2026-09-07 24:00")).toBeNull();
    expect(parseMomentTime("2026-09-07 23:60")).toBeNull();
    expect(parseMomentTime("2026-02-30 12:00")).toBeNull();
  });

  it("wants the whole shape, to the minute", () => {
    expect(parseMomentTime("2026-09-07")).toBeNull();
    expect(parseMomentTime("2026-09-07 9:05")).toBeNull();
    expect(parseMomentTime("2026-09-07 23:15:00")).toBeNull();
    expect(parseMomentTime("")).toBeNull();
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

describe("parseMedia / formatMedia", () => {
  it("reads one file per line, the extras in any order", () => {
    const text = [
      "image /pics/soul-1-1.jpg 1080x1440",
      "",
      "  audio /pics/soul-2-1.m4a 90s  ",
      "video https://blob.example/soul-3-1.mp4 poster=/pics/soul-3-1.jpg 30s 720x1280",
    ].join("\n");
    expect(parseMedia(text)).toEqual({
      ok: true,
      value: [
        { kind: "image", src: "/pics/soul-1-1.jpg", width: 1080, height: 1440 },
        { kind: "audio", src: "/pics/soul-2-1.m4a", duration: 90 },
        {
          kind: "video",
          src: "https://blob.example/soul-3-1.mp4",
          poster: "/pics/soul-3-1.jpg",
          width: 720,
          height: 1280,
          duration: 30,
        },
      ],
    });
  });

  it("an empty field is an empty list", () => {
    expect(parseMedia("")).toEqual({ ok: true, value: [] });
    expect(parseMedia("\n  \n")).toEqual({ ok: true, value: [] });
  });

  it("round-trips through formatMedia", () => {
    const text =
      "image /pics/a.jpg 10x20\naudio /pics/b.m4a 12.5s\nvideo https://x/c.mp4 720x1280 30s poster=/pics/c.jpg";
    const parsed = parseMedia(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(formatMedia(parsed.value)).toBe(text);
    expect(formatMedia([])).toBe("");
  });

  it("names the line that is wrong", () => {
    const wrong = (text: string) => {
      const parsed = parseMedia(text);
      return parsed.ok ? "" : parsed.error;
    };
    expect(wrong("image /pics/a.jpg 10x20\nphoto /pics/b.jpg 10x20")).toMatch(/^第 2 行/);
    expect(wrong("image //evil/a.jpg 10x20")).toMatch(/文件地址/);
    expect(wrong("image javascript:alert(1) 10x20")).toMatch(/文件地址/);
    expect(wrong("image /pics/a.jpg")).toMatch(/尺寸/);
    expect(wrong("image /pics/a.jpg 0x20")).toMatch(/看不懂「0x20」/);
    expect(wrong("audio /pics/a.m4a 10x20")).toMatch(/时长/);
    expect(wrong("video https://x/c.mp4 720x1280 30s")).toMatch(/封面/);
    expect(wrong("video https://x/c.mp4 720x1280 30s poster=//x/c.jpg")).toMatch(/看不懂/);
    expect(wrong("image /pics/a.jpg 10x20 huge")).toMatch(/看不懂「huge」/);
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
