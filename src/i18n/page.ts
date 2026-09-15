import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "./routing";

/**
 * The first line of every page under `[locale]`.
 *
 * Three things have to happen before a page reads anything: the segment is
 * checked against the locales the site has (an unknown one is a 404, not a
 * page in a language that does not exist), and the locale is handed to
 * next-intl for this render so `getTranslations` can be called without an
 * argument and static rendering stays possible. Seventeen pages carried the
 * same three lines; the one that forgot `setRequestLocale` would have
 * quietly turned dynamic. Now it is one call, and the return is already the
 * narrowed `Locale`.
 *
 * Pages with more params still await them for the rest — the promise
 * resolves to the same object, so awaiting it twice costs nothing.
 */
export async function pageLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return locale;
}
