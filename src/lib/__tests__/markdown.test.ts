import { describe, expect, it } from "vitest";
import { isSafeUrl } from "@/lib/markdown";

describe("isSafeUrl", () => {
  it("passes relative paths, anchors and the four protocols", () => {
    expect(isSafeUrl("/blog/post")).toBe(true);
    expect(isSafeUrl("post")).toBe(true);
    expect(isSafeUrl("#section")).toBe(true);
    expect(isSafeUrl("https://example.com")).toBe(true);
    expect(isSafeUrl("http://example.com")).toBe(true);
    expect(isSafeUrl("mailto:a@b.c")).toBe(true);
    expect(isSafeUrl("tel:+8610")).toBe(true);
  });

  it("refuses any other scheme", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("JavaScript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html,hi")).toBe(false);
    expect(isSafeUrl("vbscript:x")).toBe(false);
  });

  it("sees through the whitespace and control characters a browser skips", () => {
    expect(isSafeUrl("java\nscript:alert(1)")).toBe(false);
    expect(isSafeUrl(" javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
  });

  it("does not mistake a colon later in a path for a scheme", () => {
    expect(isSafeUrl("/time/12:30")).toBe(true);
    expect(isSafeUrl("notes:2026")).toBe(false);
  });
});
