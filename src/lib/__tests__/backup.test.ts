import { describe, expect, it } from "vitest";
import { tablesEmptied } from "@/lib/backup";

describe("tablesEmptied", () => {
  it("passes a snapshot that only changed", () => {
    expect(tablesEmptied({ posts: [1, 2] }, { posts: [1, 2, 3] })).toEqual([]);
    expect(tablesEmptied({ posts: [1, 2] }, { posts: [1] })).toEqual([]);
  });

  it("catches a table that came back empty", () => {
    expect(tablesEmptied({ posts: [1], apps: [1] }, { posts: [], apps: [1] })).toEqual(["posts"]);
  });

  it("counts a table that stopped being exported as emptied", () => {
    expect(tablesEmptied({ posts: [1] }, {})).toEqual(["posts"]);
  });

  it("catches the whole database going quiet", () => {
    expect(tablesEmptied({ posts: [1], apps: [1] }, { posts: [], apps: [] })).toEqual([
      "posts",
      "apps",
    ]);
  });

  it("says nothing about a table that was already empty", () => {
    expect(tablesEmptied({ secrets: [] }, { secrets: [] })).toEqual([]);
  });
});
