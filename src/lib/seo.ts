import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { site } from "@/config/site";

/**
 * hreflang alternates for a localized path.
 * `path` is the locale-less pathname, e.g. "/blog/my-post".
 */
export function localeAlternates(
  path: string,
  currentLocale: string
): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale === "zh" ? "zh-CN" : "en"] = `${site.url}/${locale}${path}`;
  }
  languages["x-default"] = `${site.url}/${routing.defaultLocale}${path}`;
  return {
    canonical: `${site.url}/${currentLocale}${path}`,
    languages,
  };
}
