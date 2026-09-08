import { describe, expect, it } from "vitest";
import { decodeSegment } from "@/lib/routeParam";

describe("decodeSegment", () => {
  it("decodes the escape sequence a CJK tag arrives as", () => {
    // What `params.tag` actually held for /zh/blog/tags/手札 — the whole bug.
    expect(decodeSegment("%E6%89%8B%E6%9C%AD")).toBe("手札");
    expect(decodeSegment("%E9%9A%8F%E6%83%B3")).toBe("随想");
  });

  it("leaves a pure-ASCII segment alone — which is why macOS never broke", () => {
    expect(decodeSegment("macOS")).toBe("macOS");
  });

  it("is idempotent for anything without a percent in it", () => {
    expect(decodeSegment(decodeSegment("%E6%89%8B%E6%9C%AD"))).toBe("手札");
  });

  it("hands back a segment that is not valid percent-encoding, rather than throwing", () => {
    // `decodeURIComponent("100%")` is a URIError; a tag may not take the page
    // down for being written that way.
    expect(decodeSegment("100%")).toBe("100%");
    expect(decodeSegment("%zz")).toBe("%zz");
  });

  it("decodes a space and a slash the way a URL carries them", () => {
    expect(decodeSegment("front%20end")).toBe("front end");
    expect(decodeSegment("a%2Fb")).toBe("a/b");
  });
});
