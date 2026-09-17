import { describe, expect, it } from "vitest";
import { isSafeUrl, renderMarkdown } from "@/lib/markdown";

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

// The rendered string goes into the page through dangerouslySetInnerHTML, so
// this pipeline is the whole of the defence — tested end to end, not by part.
describe("renderMarkdown", () => {
  it("renders prose, GFM and a slugged heading that links to itself", async () => {
    const html = await renderMarkdown("## Hello world\n\nSome *text* and ~~gone~~.\n\n| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain('<h2 id="hello-world"><a href="#hello-world">Hello world</a></h2>');
    expect(html).toContain("<em>text</em>");
    expect(html).toContain("<del>gone</del>");
    expect(html).toContain("<table>");
  });

  it("drops a dangerous href or src and keeps the element", async () => {
    const html = await renderMarkdown("[x](javascript:alert(1)) ![y](data:text/html,boo) [ok](https://example.com)");
    expect(html).not.toMatch(/javascript:|data:/);
    expect(html).toContain("<a>x</a>");
    expect(html).toContain('<img alt="y">');
    expect(html).toContain('<a href="https://example.com">ok</a>');
  });

  it("never lets raw HTML in the source through", async () => {
    const html = await renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\ntext <b onclick="x()">bold</b>');
    expect(html).not.toMatch(/<script|onerror|onclick|<b /);
    expect(html).toContain("text");
  });

  it("highlights fenced code for both themes", async () => {
    const html = await renderMarkdown("```ts\nconst a = 1;\n```");
    expect(html).toContain("--shiki-light");
    expect(html).toContain("--shiki-dark");
    expect(html).toMatch(/data-language="ts"/);
  });
});
