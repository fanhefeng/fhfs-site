import { describe, expect, it } from "vitest";
import { isActivePath } from "@/lib/nav";

describe("isActivePath", () => {
  it("home is current on the home page only", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/blog", "/")).toBe(false);
  });

  it("a section is current on itself and on the pages under it", () => {
    expect(isActivePath("/blog", "/blog")).toBe(true);
    expect(isActivePath("/blog/some-post", "/blog")).toBe(true);
    expect(isActivePath("/blog/tags/notes", "/blog")).toBe(true);
  });

  it("a longer name that merely shares a prefix is not under it", () => {
    expect(isActivePath("/labs", "/lab")).toBe(false);
    expect(isActivePath("/lab", "/labs")).toBe(false);
    expect(isActivePath("/about", "/blog")).toBe(false);
  });
});
