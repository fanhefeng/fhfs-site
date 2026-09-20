import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COPY_GROUPS,
  COPY_NOTES,
  copyError,
  flattenCopy,
  icuTokens,
  namespaceOf,
  type Catalogue,
} from "@/lib/copy";

const catalogue = (locale: "zh" | "en") =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../../messages/${locale}.json`, import.meta.url)),
      "utf8",
    ),
  ) as Catalogue;

describe("flattenCopy", () => {
  it("names every string leaf by its path", () => {
    expect(flattenCopy({ home: { a: "一", deep: { b: "二" } }, top: "三" })).toEqual({
      "home.a": "一",
      "home.deep.b": "二",
      top: "三",
    });
  });

  it("skips what is not a line of copy", () => {
    // `merge()` refuses a string laid over either of these, so neither can be
    // edited — listing them would offer a field that cannot be saved.
    expect(flattenCopy({ n: 1, list: ["a"], nothing: null } as unknown as Catalogue)).toEqual({});
  });
});

describe("namespaceOf", () => {
  it("is the part before the first dot", () => {
    expect(namespaceOf("lab.items.grove.name")).toBe("lab");
    expect(namespaceOf("layout")).toBe("layout");
  });
});

describe("COPY_GROUPS", () => {
  // The editor is entered through this list, so a namespace missing from it is
  // a group of lines with no way in — and a group that names nothing is a dead
  // card on the index.
  it("names every namespace in the catalogue, and only those", () => {
    const namespaces = [...new Set(Object.keys(flattenCopy(catalogue("zh"))).map(namespaceOf))];
    const named = COPY_GROUPS.map((group) => group.id);
    expect({
      unnamed: namespaces.filter((ns) => !named.includes(ns)),
      stale: named.filter((id) => !namespaces.includes(id)),
    }).toEqual({ unnamed: [], stale: [] });
  });

  it("has no duplicate ids", () => {
    expect(new Set(COPY_GROUPS.map((group) => group.id)).size).toBe(COPY_GROUPS.length);
  });
});

describe("COPY_NOTES", () => {
  it("only annotates lines the catalogue has", () => {
    const keys = flattenCopy(catalogue("zh"));
    expect(Object.keys(COPY_NOTES).filter((key) => !(key in keys))).toEqual([]);
  });
});

describe("icuTokens", () => {
  it("finds arguments and tags", () => {
    expect(icuTokens("读 {minutes} 分钟")).toEqual({ args: ["minutes"], tags: [] });
    expect(icuTokens("{count, plural, other {# 篇}}").args).toEqual(["count"]);
    expect(icuTokens("看 <b>这里</b> 和 <i/>")).toEqual({ args: [], tags: ["b", "i"] });
  });
});

describe("copyError", () => {
  it("passes an ordinary edit", () => {
    expect(copyError("换一句话", "原来那句")).toBeNull();
  });

  it("passes a line that keeps the same argument", () => {
    expect(copyError("{count} 篇文章", "写下的 {count} 篇")).toBeNull();
  });

  it("allows dropping one — saying less is an edit, not a mistake", () => {
    expect(copyError("写了不少", "写下的 {count} 篇")).toBeNull();
  });

  it("refuses an argument the call site never passes", () => {
    expect(copyError("{count} 篇 / {total} 总", "{count} 篇")).toMatch("total");
  });

  it("refuses a tag nothing renders", () => {
    expect(copyError("看 <b>这里</b>", "看这里")).toMatch("b");
  });

  it("refuses braces that do not parse", () => {
    expect(copyError("{count 篇", "{count} 篇")).not.toBeNull();
    expect(copyError("count} 篇", "{count} 篇")).not.toBeNull();
  });
});

describe("the catalogues", () => {
  // The admin writes an override per language, measured against the file's
  // line. A missing counterpart would make "equals the default" compare a
  // string with undefined — and `messages.test.ts` already keeps the two in
  // step, so this is the copy editor's half of the same promise.
  it("carry the same lines, and only strings", () => {
    const zh = flattenCopy(catalogue("zh"));
    const en = flattenCopy(catalogue("en"));
    expect(Object.keys(zh).filter((key) => !(key in en))).toEqual([]);
    expect(Object.keys(en).filter((key) => !(key in zh))).toEqual([]);
  });
});
