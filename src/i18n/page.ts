import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "./routing";

/**
 * The first line of every page under `[locale]`: the segment, checked against
 * the locales the site has — an unknown one is a 404, not a page in a language
 * that does not exist — and handed back already narrowed to `Locale`, for the
 * getters that take one.
 *
 * It used to hand the locale to next-intl as well (`setRequestLocale`), and a
 * page that forgot to quietly rendered dynamically on every request. next-intl
 * now reads the segment itself as a root param (i18n/request.ts), so that half
 * is gone and a missed call can no longer cost the prerender.
 *
 * Pages with more params still await them for the rest — the promise
 * resolves to the same object, so awaiting it twice costs nothing.
 */
export async function pageLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return locale;
}
