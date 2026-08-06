import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { getCopyOverrides } from "@/lib/content";
import { routing } from "./routing";

type Messages = Record<string, unknown>;

/**
 * Overlays `override` onto `base`, one key at a time. Only plain objects
 * recurse; a string in the override replaces whatever was there.
 */
function merge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    out[key] =
      isPlainObject(existing) && isPlainObject(value)
        ? merge(existing, value)
        : value;
  }
  return out;
}

function isPlainObject(value: unknown): value is Messages {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

  return { locale, messages: merge(catalogue, overrides) };
});
