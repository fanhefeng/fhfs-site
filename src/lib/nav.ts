/**
 * The pure rules every surface that lists the nav table shares — the header
 * island, the full-screen menu, the footer, the /life index. No React, no
 * database: the layout reads the table and hands `NavLink`s down; these
 * functions decide what is current, what stands on its own and what hangs
 * under what.
 */

/**
 * The three wings of the nav table. `issue` is the magazine proper (writing,
 * software, the lab, the craft page); `rooms` are the one-page, one-record
 * themes (the board, the secrets, the idols, the film) and whatever rooms
 * come later; `me` is the author (about, the 3D intro, the résumé). A row
 * with no group is on its own — home, today.
 */
export const NAV_GROUPS = ["issue", "rooms", "me"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

export const isNavGroup = (value: string | null | undefined): value is NavGroup =>
  value != null && (NAV_GROUPS as readonly string[]).includes(value);

/** The `nav.<key>` label each group's accessible name reads. */
export const NAV_GROUP_LABEL_KEY: Record<NavGroup, string> = {
  issue: "groupIssue",
  rooms: "groupRooms",
  me: "groupMe",
};

/**
 * A link as the layout hands it to the surfaces. `door` is "on the header
 * surface": the island only shows doors, and the full-screen menu hangs the
 * other rows of a group under the door before them.
 */
export type NavLink = {
  href: string;
  labelKey: string;
  group: NavGroup | null;
  door: boolean;
};

/**
 * Whether a nav link points at the page being read — the `aria-current` rule
 * the header island, the full-screen menu and anything else that lists the
 * nav table share.
 *
 * A plain `startsWith` was wrong twice over: the home link `/` is a prefix of
 * every path, so it lit on every page, and `/lab` would light on a `/labs`
 * that does not exist yet but could. A link is current on its own page and on
 * the pages under it — `/blog` on `/blog/some-post` — and nowhere else.
 */
export const isActivePath = (pathname: string, href: string): boolean =>
  href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);

/**
 * A door is current on its own pages and on the pages of the rows hanging
 * under it — so the island lights 「生活」 while the reader is in /odyssey,
 * and 「关于」 while they are in /intro.
 */
export const isActiveDoor = (
  pathname: string,
  door: { href: string },
  members: readonly { href: string }[]
): boolean =>
  isActivePath(pathname, door.href) || members.some((m) => isActivePath(pathname, m.href));

export type NavCluster<T> = { group: NavGroup | null; items: T[] };

/**
 * Consecutive rows of the same group, in table order — the footer's three
 * clusters with a hairline between them. Rows without a group cluster with
 * each other the same way, so nothing is ever dropped for lacking one.
 */
export function clusterNav<T extends { group: NavGroup | null }>(items: readonly T[]): NavCluster<T>[] {
  const clusters: NavCluster<T>[] = [];
  for (const item of items) {
    const last = clusters[clusters.length - 1];
    if (last && last.group === item.group) last.items.push(item);
    else clusters.push({ group: item.group, items: [item] });
  }
  return clusters;
}

export type NavBranch<T> = { door: T; members: T[] };

/**
 * The full-screen menu's two levels. A row that is not a door hangs under
 * the nearest door *before* it in the same group — so /portfolio, listed
 * after /software, sits under 软件; the rooms sit under 生活; /intro under
 * 关于. A row with no group, or with no door before it in its group, stands
 * as a branch of its own (home is the one such row today), so a row can be
 * misfiled in the admin but never vanish.
 */
export function attachMembers<T extends { group: NavGroup | null; door: boolean }>(
  items: readonly T[]
): NavBranch<T>[] {
  const branches: NavBranch<T>[] = [];
  let open: NavBranch<T> | null = null;
  for (const item of items) {
    if (item.door || item.group === null) {
      open = { door: item, members: [] };
      branches.push(open);
      continue;
    }
    if (open && open.door.group === item.group) open.members.push(item);
    else {
      open = null;
      branches.push({ door: item, members: [] });
    }
  }
  return branches;
}
