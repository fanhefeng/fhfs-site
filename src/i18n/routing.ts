import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["zh", "en"],
  defaultLocale: "zh",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

/** BCP 47 tag for `<html lang>`, hreflang alternates and the feed. Takes a
 *  plain string because `useLocale()` hands one back. */
export const htmlLang = (locale: string): string =>
  locale === "zh" ? "zh-CN" : "en";
