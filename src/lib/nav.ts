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
