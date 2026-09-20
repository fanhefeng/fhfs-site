import "server-only";

import { flattenCopy, type Catalogue } from "./copy";

/**
 * Both message catalogues, flattened to `a.b.c` → string.
 *
 * The files are the full list of what the site can say, so this is what the
 * copy editor is built from and what a saved override is measured against.
 * Read by dynamic import the way `i18n/request.ts` reads them: bundled for the
 * server, never sent to the browser — 885 lines in two languages have no
 * business in the RSC payload of a page that shows one group of them.
 */
export async function copyCatalogues(): Promise<{
  zh: Record<string, string>;
  en: Record<string, string>;
}> {
  const [zh, en] = await Promise.all(
    (["zh", "en"] as const).map((locale) =>
      import(`../../messages/${locale}.json`).then((m) => flattenCopy(m.default as Catalogue)),
    ),
  );
  return { zh: zh!, en: en! };
}
