import { describe, expect, it } from "vitest";
import { merge } from "@/lib/messages";

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
