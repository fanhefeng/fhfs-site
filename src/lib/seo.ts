import type { Metadata } from "next";
import { routing, htmlLang } from "@/i18n/routing";
import { site } from "@/config/site";

/** hreflang language map for a locale-less path, e.g. "/blog/my-post". */
export function localeLanguages(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[htmlLang(locale)] = `${site.url}/${locale}${path}`;
  }
  return languages;
}

/** hreflang alternates for a localized path — the `languages` map above plus
 *  x-default and this page's canonical. */
export function localeAlternates(
  path: string,
  currentLocale: string
): Metadata["alternates"] {
  const languages = localeLanguages(path);
  languages["x-default"] = `${site.url}/${routing.defaultLocale}${path}`;
  return {
    canonical: `${site.url}/${currentLocale}${path}`,
    languages,
  };
}
