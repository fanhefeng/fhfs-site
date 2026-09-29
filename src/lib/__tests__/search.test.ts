import { describe, expect, it } from "vite-plus/test";
import { queryTerms, search, snippet, type SearchEntry } from "@/lib/search";

const entry = (over: Partial<SearchEntry>): SearchEntry => ({
  kind: "post",
  title: "",
  text: "",
  href: "/",
  ...over,
});

describe("queryTerms", () => {
  it("lower-cases and splits on any blank", () => {
    expect(queryTerms("  Next  JS\tgsap ")).toEqual(["next", "js", "gsap"]);
    expect(queryTerms("   ")).toEqual([]);
  });
});

describe("snippet", () => {
  it("cuts around the first term, with an ellipsis where it cut", () => {
    const text = `${"一".repeat(50)}苔藓${"二".repeat(50)}`;
    expect(snippet(text, ["苔藓"], 4)).toBe("…一一一一苔藓二二…");
  });

  it("keeps a short text whole and flattens its lines", () => {
    expect(snippet("第一行\n第二行", ["第二"])).toBe("第一行 第二行");
  });

  it("opens the text when no term is in it", () => {
    expect(snippet("abcdefghij", ["zz"], 2)).toBe("abcd…");
  });
});

describe("search", () => {
  const entries = [
    entry({ kind: "moment", title: "", text: "今天读了 OSI 七层模型", href: "/moments#a" }),
    entry({ kind: "post", title: "OSI 七层模型", text: "从报文到比特流", href: "/blog/osi" }),
    entry({ kind: "page", title: "关于", text: "OSI 爱好者", href: "/about" }),
    entry({ kind: "post", title: "数字僧侣", text: "", href: "/blog/monk" }),
  ];

  it("puts a title hit above a text-only one, then kinds in order", () => {
    expect(search(entries, "osi").map((hit) => hit.href)).toEqual([
      "/blog/osi",
      "/about",
      "/moments#a",
    ]);
  });

  it("requires every term", () => {
    expect(search(entries, "osi 比特").map((hit) => hit.href)).toEqual(["/blog/osi"]);
  });

  it("is case-blind", () => {
    expect(search(entries, "OsI").length).toBe(3);
  });

  it("finds nothing for an empty query, and stops at the limit", () => {
    expect(search(entries, " ")).toEqual([]);
    expect(search(entries, "o", 1)).toHaveLength(1);
  });

  it("keeps the index's order among equals", () => {
    const same = [entry({ title: "a1", href: "/1" }), entry({ title: "a2", href: "/2" })];
    expect(search(same, "a").map((hit) => hit.href)).toEqual(["/1", "/2"]);
  });

  it("carries a snippet of the text, or none", () => {
    const [hit] = search(entries, "比特");
    expect(hit!.snippet).toBe("从报文到比特流");
    expect(search(entries, "僧侣")[0]!.snippet).toBe("");
  });
});
