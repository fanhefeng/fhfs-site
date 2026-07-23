"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const other = locale === "zh" ? "en" : "zh";

  return (
    <button
      type="button"
      onClick={() =>
        router.replace(pathname, { locale: other, scroll: false })
      }
      className="ml-2 cursor-pointer rounded border border-line px-3 py-1.5 text-xs text-muted-fg transition-colors hover:border-gold/50 hover:text-gold"
      aria-label={t("localeSwitch")}
    >
      {t("localeSwitch")}
    </button>
  );
}
