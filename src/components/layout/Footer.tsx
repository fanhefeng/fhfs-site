"use client";

import { Fragment } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { site } from "@/config/site";
import { useLocalClock } from "@/lib/useLocalClock";
import { clusterNav, NAV_GROUP_LABEL_KEY, type NavLink } from "@/lib/nav";
import { LightSwitch } from "@/components/ui/LightSwitch";
import { PeelSticker } from "@/components/ui/PeelSticker";

/**
 * The quietest place on the site: a single-line colophon strip. Small
 * wordmark, the nav table's footer links in their three clusters (the issue,
 * the rooms, the author — a hairline between them, the group's name only for
 * assistive tech), RSS/GitHub, the author's local clock, and a copy of the
 * light switch — all static, no entrance animation, nothing scrolls or
 * glows. The one indulgence is the tear-off sticker in the corner hiding
 * the email address.
 */
export function Footer({ items }: { items: NavLink[] }) {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const time = useLocalClock();

  const linkClass =
    "hit-ext inline-block py-1 text-fg-secondary no-underline transition-colors hover:text-fg focus-visible:text-fg";

  return (
    <footer className="relative mt-24 border-t border-line">
      {/* pr reserves the sticker's corner on every wrap breakpoint. */}
      <div className="mx-auto flex min-h-28 max-w-[1120px] flex-wrap items-center gap-x-6 gap-y-2 px-6 py-8 pr-40 text-[13px] sm:px-10 sm:pr-44">
        <Link
          href="/"
          className="hit-ext inline-block py-1 font-mono text-xs tracking-[0.08em] text-fg no-underline"
        >
          {site.signName}
        </Link>

        {/* Build-time year is baked into the static HTML; let the client
            keep it rather than fail hydration right after New Year. */}
        <span
          suppressHydrationWarning
          className="font-mono text-[11px] text-fg-tertiary"
        >
          © {new Date().getFullYear()} {site.author}
          <span className="hidden sm:inline"> · {t("rights")}</span>
        </span>

        <nav
          aria-label={t("navAria")}
          className="flex flex-wrap items-center gap-x-5 gap-y-1"
        >
          {clusterNav(items).map((cluster, i) => (
            // Keyed by position too: a group can recur after another one
            // (a misordered table) and then names alone would collide.
            <Fragment key={`${cluster.group ?? "none"}-${i}`}>
              {/* The same hairline the island draws before its switches —
                  at every width, or a phone sees one flat run of words. */}
              {i > 0 && <span aria-hidden="true" className="h-3.5 w-px bg-line" />}
              <span
                role={cluster.group ? "group" : undefined}
                aria-label={cluster.group ? tNav(NAV_GROUP_LABEL_KEY[cluster.group]) : undefined}
                className="inline-flex flex-wrap items-center gap-x-5 gap-y-1"
              >
                {cluster.items.map((item) => (
                  <Link key={item.href} href={item.href} className={linkClass}>
                    {tNav(item.labelKey)}
                  </Link>
                ))}
              </span>
            </Fragment>
          ))}
        </nav>

        <span className="flex items-center gap-x-5">
          {/* Plain <a>: rss.xml is a file route, not a page — skip the
              route transition curtain. */}
          <a
            href={`/${locale}/rss.xml`}
            data-no-transition
            className={linkClass}
          >
            {t("rss")}
          </a>
          <a
            href={site.social.github}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            GitHub
          </a>
        </span>

        <span className="ml-auto flex items-center gap-x-3">
          <span className="hidden font-mono text-[11px] text-fg-tertiary lg:inline">
            {t("colophon")}
          </span>
          <span
            title={t("localTimeAria")}
            className="font-mono text-[11px] tracking-[0.08em] text-fg-tertiary [font-variant-numeric:tabular-nums]"
          >
            {t("timePrefix")}
            {time ?? "--:--"}
            {t("timeSuffix")}
          </span>
          <LightSwitch />
        </span>
      </div>

      <PeelSticker
        email={site.social.email}
        hint={t("stickerHint")}
        ariaLabel={t("stickerAria")}
        fallback={t("stickerFallback")}
        className="absolute bottom-6 right-5 sm:right-9"
      />
    </footer>
  );
}
