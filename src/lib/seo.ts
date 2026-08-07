import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
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

/**
 * `generateMetadata` for a section page: title/subtitle from one message
 * namespace plus the alternates above. The section pages differ only in
 * those two strings, so each exports
 * `export const generateMetadata = sectionMetadata("about", "/about")`.
 */
export function sectionMetadata(namespace: string, path: string) {
  return async function generateMetadata({
    params,
  }: {
    params: Promise<{ locale: string }>;
  }): Promise<Metadata> {
    const { locale } = await params;
    if (!hasLocale(routing.locales, locale)) return {};
    const t = await getTranslations({ locale, namespace });
    return {
      title: t("title"),
      description: t("subtitle"),
      alternates: localeAlternates(path, locale),
    };
  };
}
