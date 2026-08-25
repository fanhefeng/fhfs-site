import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing, htmlLang, type Locale } from "@/i18n/routing";
import { site } from "@/config/site";

/**
 * hreflang language map for a locale-less path, e.g. "/blog/my-post".
 *
 * `available` narrows the map to the locales that really have a version of
 * the page. A post that only exists in one language is still *served* under
 * the other prefix (the read layer falls back rather than 404ing), but an
 * hreflang pointing at that fallback would tell crawlers two translations
 * exist where there is one. Static pages have every locale, hence the default.
 */
export function localeLanguages(
  path: string,
  available: readonly Locale[] = routing.locales
): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of available) {
    languages[htmlLang(locale)] = `${site.url}/${locale}${path}`;
  }
  return languages;
}

/** The feed link every page carries — a page that sets its own `alternates`
 *  replaces the layout's object wholesale, so this has to ride along here. */
export function feedTypes(locale: string): Record<string, string> {
  return { "application/rss+xml": `${site.url}/${locale}/rss.xml` };
}

/** hreflang alternates for a localized path — the `languages` map above plus
 *  x-default and this page's canonical. x-default is the default locale when
 *  it has a version, else the first locale that does. */
export function localeAlternates(
  path: string,
  currentLocale: string,
  available: readonly Locale[] = routing.locales
): NonNullable<Metadata["alternates"]> {
  const languages = localeLanguages(path, available);
  const xDefault = available.includes(routing.defaultLocale)
    ? routing.defaultLocale
    : available[0];
  if (xDefault) languages["x-default"] = `${site.url}/${xDefault}${path}`;
  return {
    canonical: `${site.url}/${currentLocale}${path}`,
    languages,
    types: feedTypes(currentLocale),
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
