"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { site } from "@/config/site";
import { LightSwitch } from "@/components/ui/LightSwitch";
import { PeelSticker } from "@/components/ui/PeelSticker";

const NAV_ITEMS = [
  { href: "/blog", key: "blog" },
  { href: "/about", key: "about" },
  { href: "/portfolio", key: "portfolio" },
  { href: "/software", key: "software" },
] as const;

/**
 * "HH:mm in Qingdao" — the colophon clock. Formats wall time for
 * Asia/Shanghai regardless of the visitor's zone and re-renders on the
 * minute (first tick aligned to the next :00 so it never drifts a minute
 * behind). Renders a placeholder until mounted, so SSR and hydration agree.
 */
function useQingdaoTime(): string | null {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "Asia/Shanghai",
    });
    const update = () => setTime(fmt.format(new Date()));
    update();

    let interval: number | undefined;
    const align = window.setTimeout(
      () => {
        update();
        interval = window.setInterval(update, 60_000);
      },
      (60 - new Date().getSeconds()) * 1000 + 100
    );
    return () => {
      window.clearTimeout(align);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, []);

  return time;
}

/**
 * The quietest place on the site: a single-line colophon strip. Small
 * wordmark, the four sections, RSS/GitHub, the Qingdao clock, and a copy of
 * the light switch — all static, no entrance animation, nothing scrolls or
 * glows. The one indulgence is the tear-off sticker in the corner hiding
 * the email address. (The old ASCII-canvas finale, giant sign name and
 * model credit are retired.)
 */
export function Footer() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const time = useQingdaoTime();

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
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass}>
              {tNav(item.key)}
            </Link>
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
