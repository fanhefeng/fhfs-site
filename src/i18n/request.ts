import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { site } from "@/config/site";
import { getCopyOverrides } from "@/lib/content";
import { merge, type Messages } from "@/lib/messages";
import { routing } from "./routing";

/**
 * Messages are read in two layers.
 *
 * The JSON catalogue is the base and still holds everything: UI labels, aria
 * descriptions, plural forms — and a full copy of the site's prose. Rows in
 * `copy_blocks` are laid over it, so editing a headline in the admin changes
 * the site, while an empty (or unreachable) table leaves it reading exactly as
 * the files say. That makes this both the edit path and the fallback.
 *
 * The override query is cached and tagged, which matters more than it looks:
 * this function runs on every render, and in a prerender the tags it collects
 * are what let `updateTag` invalidate the pages afterwards. An uncached read
 * here would still render the right words on a cold build and then never
 * update again — no error, just a site that ignores its own editor.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const [catalogue, overrides] = await Promise.all([
    import(`../../messages/${locale}.json`).then((m) => m.default as Messages),
    getCopyOverrides(locale),
  ]);

  // The zone `getFormatter().dateTime` formats in — a post's date, the
  // résumé's "updated" month. Pinned so the value does not depend on where
  // the page happened to be rendered; without it next-intl falls back to
  // the machine's zone and says so on every render in development.
  return {
    locale,
    timeZone: site.timeZone,
    messages: merge(catalogue, overrides),
  };
});
