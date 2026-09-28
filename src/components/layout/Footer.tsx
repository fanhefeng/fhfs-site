"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { site } from "@/config/site";
import { useLocalClock } from "@/lib/useLocalClock";
import {
  attachMembers,
  isActivePath,
  NAV_GROUP_LABEL_KEY,
  NAV_GROUPS,
  type NavGroup,
  type NavLink,
} from "@/lib/nav";
import { LightSwitch } from "@/components/ui/LightSwitch";
import { PeelSticker } from "@/components/ui/PeelSticker";
import { SignRing } from "@/components/neon/SignRing";

/** One column of the footer's map: a wing's name over its rows, doors first. */
type Column = { group: NavGroup; rows: { link: NavLink; door: boolean }[] };

/**
 * The nav table laid out the way the island reads it: one column per wing,
 * each door followed by the rows hanging under it (生活 over the rooms, 关于
 * over the intro and the résumé). A row with no group would otherwise have
 * no column; it goes at the head of the first one, so a row misfiled in the
 * admin is still on the page.
 */
function columns(items: NavLink[]): Column[] {
  const byGroup = new Map<NavGroup, Column["rows"]>(NAV_GROUPS.map((g) => [g, []]));
  const loose: Column["rows"] = [];
  for (const { door, members } of attachMembers(items)) {
    const rows = door.group ? byGroup.get(door.group)! : loose;
    rows.push({ link: door, door: true }, ...members.map((link) => ({ link, door: false })));
  }
  const out = NAV_GROUPS.map((group) => ({ group, rows: byGroup.get(group)! }));
  out[0]!.rows.unshift(...loose);
  return out.filter((column) => column.rows.length > 0);
}

/**
 * The back cover. Three things, top to bottom: the sign's ring with the
 * slogan beside it and the tear-off sticker in the corner; a map of the site
 * in four columns — the three wings of the nav table under their names, in
 * the island's order, doors in ink and the rows under them in grey, then
 * where to find the author; and one mono line of colophon, clock and the
 * light switch under a hairline. It stands on the reading measure, so its
 * left edge is the page's. Still the quietest place on the site: nothing
 * animates in, nothing glows; the one indulgence is the sticker.
 */
export function Footer({ items }: { items: NavLink[] }) {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");
  const tHome = useTranslations("home");
  const locale = useLocale();
  const pathname = usePathname();
  const time = useLocalClock();

  const kicker = "font-mono text-[11px] uppercase tracking-meta text-fg-tertiary";
  const row =
    "hit-ext inline-block py-1 no-underline transition-colors hover:text-fg focus-visible:text-fg";
  // The third copy of the nav, and the one that shows the whole table. Ink
  // and a rule mark the page being read, not amber: the footer stays quiet.
  const current =
    "aria-[current]:text-fg aria-[current]:underline aria-[current]:underline-offset-4";

  return (
    <footer className="relative mt-24 border-t border-line">
      <div className="mx-auto w-full max-w-[720px] px-6 pt-10 pb-8 text-[13px]">
        {/* The same badge as the island's — the name in the sign's ring — and
            the slogan beside it, the way a back cover repeats the masthead.
            The sticker takes the corner; on a phone it drops to a line of
            its own under them rather than crowd the slogan. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-5">
          <Link
            href="/"
            aria-label={site.signName}
            className="hit-ext inline-flex items-center py-1 text-fg no-underline"
          >
            <SignRing id="ft" className="size-8 text-fg">
              <span className="font-mono text-[10px] font-semibold lowercase tracking-[0.02em]">
                {site.signName}
              </span>
            </SignRing>
          </Link>
          <p className="text-fg-secondary">{tHome("slogan")}</p>
          <PeelSticker
            email={site.social.email}
            hint={t("stickerHint")}
            ariaLabel={t("stickerAria")}
            fallback={t("stickerFallback")}
            className="basis-full sm:ml-auto sm:basis-auto"
          />
        </div>

        {/* The map. Two columns on a phone, four from sm up: the wings in
            the island's order, then the places the author can be found. */}
        <nav
          aria-label={t("navAria")}
          className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4"
        >
          {columns(items).map((column) => (
            <div key={column.group}>
              <p id={`ft-${column.group}`} className={kicker}>
                {tNav(NAV_GROUP_LABEL_KEY[column.group])}
              </p>
              <ul aria-labelledby={`ft-${column.group}`} className="mt-3 flex flex-col">
                {column.rows.map(({ link, door }) => (
                  <li key={link.href}>
                    {/* No viewport prefetch: eleven routes' payloads fetched
                        on every page for a map almost nobody scrolls to. A
                        hover still prefetches, so a click stays instant. */}
                    <Link
                      href={link.href}
                      prefetch={false}
                      aria-current={
                        pathname === link.href
                          ? "page"
                          : isActivePath(pathname, link.href)
                            ? "true"
                            : undefined
                      }
                      className={`${row} ${current} ${door ? "text-fg" : "text-fg-secondary"}`}
                    >
                      {tNav(link.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p id="ft-find" className={kicker}>
              {t("findMe")}
            </p>
            <ul aria-labelledby="ft-find" className="mt-3 flex flex-col">
              <li>
                <a
                  href={site.social.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${row} text-fg-secondary`}
                >
                  GitHub
                  <span aria-hidden="true"> ↗</span>
                </a>
              </li>
              <li>
                {/* Plain <a>: rss.xml is a file route, not a page — skip the
                    route transition curtain. */}
                <a
                  href={`/${locale}/rss.xml`}
                  data-no-transition
                  className={`${row} text-fg-secondary`}
                >
                  {t("rss")}
                </a>
              </li>
            </ul>
          </div>
        </nav>

        {/* The colophon line: who, the way it was set, what time it is where
            he is, and the light switch. */}
        <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-5 font-mono text-[11px] text-fg-tertiary">
          {/* Build-time year is baked into the static HTML; let the client
              keep it rather than fail hydration right after New Year. */}
          <span suppressHydrationWarning>
            © {new Date().getFullYear()} {site.author}
            <span className="hidden sm:inline"> · {t("rights")}</span>
          </span>
          <span className="ml-auto flex items-center gap-x-4">
            <span className="hidden md:inline">{t("colophon")}</span>
            <span
              title={t("localTimeAria")}
              className="tracking-[0.08em] [font-variant-numeric:tabular-nums]"
            >
              {t("timePrefix")}
              {time ?? "--:--"}
              {t("timeSuffix")}
            </span>
            <LightSwitch />
          </span>
        </div>
      </div>
    </footer>
  );
}
