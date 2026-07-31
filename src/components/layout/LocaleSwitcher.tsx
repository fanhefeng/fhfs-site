"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * zh ⇄ en toggle, compact enough to sit inside the island tray and the
 * FullNav footer row. The visible label names the *target* language
 * (common.localeSwitch); the aria label spells out the direction.
 *
 * Scroll position survives the swap — router.replace with scroll: false is
 * the locale-switch contract. The whole-page cross-fade for locale swaps is
 * RouteTransition's concern, not this button's.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const other = locale === "zh" ? "en" : "zh";

  return (
    <button
      type="button"
      onClick={() => router.replace(pathname, { locale: other, scroll: false })}
      aria-label={t("localeSwitchAria")}
      // hit-ext keeps the ≥44px touch target without inflating the chip.
      className={`hit-ext cursor-pointer rounded-full px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-meta text-fg-secondary transition-colors hover:text-fg ${className ?? ""}`}
    >
      {t("localeSwitch")}
    </button>
  );
}

export default LocaleSwitcher;
