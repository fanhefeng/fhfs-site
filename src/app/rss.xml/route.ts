import { routing } from "@/i18n/routing";

/**
 * `/rss.xml` is where a feed reader guesses first. The real feeds are
 * per-locale, so this sends the guess to the default language's one. A
 * temporary redirect on purpose: the default locale is configuration, not a
 * fact about the URL, and a 301 would be cached past a change to it.
 */
export function GET(request: Request) {
  const to = new URL(`/${routing.defaultLocale}/rss.xml`, request.url);
  return Response.redirect(to, 302);
}
