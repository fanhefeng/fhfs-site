import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CLIENT_NAMESPACES, merge, pick } from "@/lib/messages";

/** Every .ts/.tsx under `dir`, recursively. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) out.push(...sourceFiles(file));
    else if (/\.tsx?$/.test(name)) out.push(file);
  }
  return out;
}

describe("CLIENT_NAMESPACES", () => {
  // The layout hands the client only these namespaces. A component that
  // reads another one through `useTranslations` would fail in the browser
  // with MISSING_MESSAGE — so the list is checked against the source, not
  // remembered.
  it("covers every namespace a component reads with useTranslations", () => {
    const src = fileURLToPath(new URL("../../", import.meta.url));
    const used = new Set<string>();
    for (const file of sourceFiles(src)) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/useTranslations\(\s*(?:"([^"]*)"|'([^']*)')?\s*\)/g)) {
        // A call with no namespace at all would need the whole catalogue —
        // recorded as "*", which is never in the list.
        used.add((m[1] ?? m[2] ?? "*").split(".")[0]!);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    const missing = [...used].filter((ns) => !(CLIENT_NAMESPACES as readonly string[]).includes(ns));
    expect(missing).toEqual([]);
  });
});

/** `a.b.c` for every leaf of a catalogue. */
function leafKeys(node: unknown, prefix = ""): string[] {
  if (typeof node !== "object" || node === null) return [prefix];
  return Object.entries(node).flatMap(([key, value]) => leafKeys(value, prefix ? `${prefix}.${key}` : key));
}

describe("the two catalogues", () => {
  // A key one language lacks is a MISSING_MESSAGE on that language's pages
  // only — found by whoever reads the other language, at request time.
  it("hold the same keys", () => {
    const root = fileURLToPath(new URL("../../../messages/", import.meta.url));
    const keys = (file: string) => new Set(leafKeys(JSON.parse(readFileSync(path.join(root, file), "utf8"))));
    const zh = keys("zh.json");
    const en = keys("en.json");
    expect(zh.size).toBeGreaterThan(0);
    expect({
      onlyZh: [...zh].filter((key) => !en.has(key)),
      onlyEn: [...en].filter((key) => !zh.has(key)),
    }).toEqual({ onlyZh: [], onlyEn: [] });
  });
});

describe("pick", () => {
  it("keeps only the named namespaces and skips ones the catalogue lacks", () => {
    expect(pick({ nav: { a: 1 }, lab: { b: 2 }, plain: "x" }, ["nav", "plain", "none"])).toEqual({
      nav: { a: 1 },
      plain: "x",
    });
  });

  it("never reaches through the prototype for one", () => {
    expect(pick({}, ["toString", "constructor"])).toEqual({});
  });
});

const base = {
  home: { heroLine1: "默认", heroLine2: "第二行", nested: { deep: "x" } },
  nav: { blog: "文章" },
  plain: "leaf",
};

describe("merge", () => {
  it("lays a leaf over a leaf and leaves the rest alone", () => {
    expect(merge(base, { home: { heroLine1: "改过" } })).toEqual({
      ...base,
      home: { ...base.home, heroLine1: "改过" },
    });
  });

  it("recurses through namespaces", () => {
    expect(merge(base, { home: { nested: { deep: "y" } } }).home).toEqual({
      ...base.home,
      nested: { deep: "y" },
    });
  });

  it("adds a key the catalogue lacks", () => {
    expect(merge(base, { extra: { line: "new" } })).toMatchObject({ extra: { line: "new" } });
    expect(merge(base, { home: { heroLine3: "第三行" } }).home).toMatchObject({ heroLine3: "第三行" });
  });

  it("refuses a shape mismatch in either direction", () => {
    expect(merge(base, { home: "flattened" }).home).toEqual(base.home);
    expect(merge(base, { plain: { now: "object" } }).plain).toBe("leaf");
  });

  it("does not mutate its inputs", () => {
    const override = { home: { heroLine1: "改过" } };
    merge(base, override);
    expect(base.home.heroLine1).toBe("默认");
    expect(override).toEqual({ home: { heroLine1: "改过" } });
  });

  it("never writes through the prototype", () => {
    // JSON.parse makes a real own property named __proto__; assigning it
    // onto a plain object would be the setter.
    const override = JSON.parse(
      '{"__proto__": {"polluted": true}, "constructor": {"x": 1}, "nav": {"__proto__": {"p": 1}}}'
    ) as Record<string, unknown>;
    const out = merge({ nav: { blog: "文章" } }, override);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(out.polluted).toBeUndefined();
    expect(Object.getPrototypeOf(out.nav)).toBe(Object.prototype);
    expect(out).toEqual({ nav: { blog: "文章" } });
  });
});
