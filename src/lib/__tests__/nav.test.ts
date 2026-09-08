import { describe, expect, it } from "vitest";
import { attachMembers, clusterNav, isActiveDoor, isActivePath, isNavGroup, type NavLink } from "@/lib/nav";

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

const link = (href: string, group: NavLink["group"], door = false): NavLink => ({
  href,
  labelKey: href.slice(1) || "home",
  group,
  door,
});

/** The table as it stands: home, the issue, the rooms behind 生活, the author. */
const TABLE: NavLink[] = [
  link("/", null),
  link("/blog", "issue", true),
  link("/software", "issue", true),
  link("/portfolio", "issue"),
  link("/lab", "issue", true),
  link("/life", "rooms", true),
  link("/moments", "rooms"),
  link("/idols", "rooms"),
  link("/odyssey", "rooms"),
  link("/secrets", "rooms"),
  link("/about", "me", true),
  link("/intro", "me"),
  link("/resume", "me", true),
];

describe("isNavGroup", () => {
  it("knows the three wings and nothing else", () => {
    expect(isNavGroup("rooms")).toBe(true);
    expect(isNavGroup("")).toBe(false);
    expect(isNavGroup(null)).toBe(false);
    expect(isNavGroup("Rooms")).toBe(false);
  });
});

describe("clusterNav", () => {
  it("cuts the table into runs of one group, in order", () => {
    const clusters = clusterNav(TABLE.filter((row) => row.href !== "/"));
    expect(clusters.map((c) => c.group)).toEqual(["issue", "rooms", "me"]);
    expect(clusters[1].items.map((i) => i.href)).toEqual([
      "/life",
      "/moments",
      "/idols",
      "/odyssey",
      "/secrets",
    ]);
  });

  it("keeps ungrouped rows rather than dropping them", () => {
    const clusters = clusterNav(TABLE);
    expect(clusters[0]).toEqual({ group: null, items: [TABLE[0]] });
  });

  it("a group that recurs after another starts a new cluster", () => {
    const clusters = clusterNav([link("/a", "issue"), link("/b", "me"), link("/c", "issue")]);
    expect(clusters.map((c) => c.group)).toEqual(["issue", "me", "issue"]);
  });
});

describe("attachMembers", () => {
  it("hangs each non-door row under the door before it in the same group", () => {
    const branches = attachMembers(TABLE);
    const shape = branches.map((b) => [b.door.href, b.members.map((m) => m.href)]);
    expect(shape).toEqual([
      ["/", []],
      ["/blog", []],
      ["/software", ["/portfolio"]],
      ["/lab", []],
      ["/life", ["/moments", "/idols", "/odyssey", "/secrets"]],
      ["/about", ["/intro"]],
      ["/resume", []],
    ]);
  });

  it("a row with no door before it in its group stands on its own", () => {
    const branches = attachMembers([link("/moments", "rooms"), link("/life", "rooms", true), link("/idols", "rooms")]);
    expect(branches.map((b) => [b.door.href, b.members.map((m) => m.href)])).toEqual([
      ["/moments", []],
      ["/life", ["/idols"]],
    ]);
  });

  it("a group change closes the branch even without a new door", () => {
    const branches = attachMembers([link("/life", "rooms", true), link("/intro", "me")]);
    expect(branches.map((b) => [b.door.href, b.members.length])).toEqual([
      ["/life", 0],
      ["/intro", 0],
    ]);
  });
});

describe("isActiveDoor", () => {
  const members = [link("/moments", "rooms"), link("/odyssey", "rooms")];
  it("is current on the door's own pages", () => {
    expect(isActiveDoor("/life", { href: "/life" }, members)).toBe(true);
  });
  it("is current on the pages hanging under it", () => {
    expect(isActiveDoor("/odyssey", { href: "/life" }, members)).toBe(true);
    expect(isActiveDoor("/moments", { href: "/life" }, members)).toBe(true);
  });
  it("is not current elsewhere", () => {
    expect(isActiveDoor("/blog", { href: "/life" }, members)).toBe(false);
    expect(isActiveDoor("/lifestyle", { href: "/life" }, members)).toBe(false);
  });
});
