import { lines } from "@/lib/resume";

/**
 * How the admin's Server Actions read a form.
 *
 * Every field the editor submits goes through one of these, so the rules —
 * what counts as a key, a date, a link — are stated once and tested once
 * (src/lib/__tests__/forms.test.ts) rather than re-derived per action. Pure
 * functions over `FormData` and strings: no database, no request, nothing
 * that needs Next.
 */

export const str = (form: FormData, key: string): string =>
  String(form.get(key) ?? "").trim();

/**
 * Verbatim, including leading and trailing spaces.
 *
 * Copy has to be read this way. `footer.timePrefix` is `"青岛 · "` and
 * `timeSuffix` is `" in Qingdao"` — the two of them bracket a clock, and which
 * side the city sits on differs by language. Trimming them silently closes the
 * gap, and nothing downstream notices: the markup still renders, HTML collapses
 * the whitespace, and the line just reads slightly wrong forever.
 */
export const raw = (form: FormData, key: string): string =>
  String(form.get(key) ?? "");

/** Narrows to the locale union — excluding literals off `string` does not. */
export const parseLocale = (value: string): "zh" | "en" | null =>
  value === "zh" || value === "en" ? value : null;

export const localized = (form: FormData, key: string) => ({
  zh: str(form, `${key}.zh`),
  en: str(form, `${key}.en`),
});

/** A bilingual textarea read as a list — one item per line, blanks dropped. */
export const localizedLines = (form: FormData, key: string) => ({
  zh: lines(raw(form, `${key}.zh`)),
  en: lines(raw(form, `${key}.en`)),
});

/**
 * A comma-separated field as a list: tags, platforms. Either comma — the
 * full-width one a Chinese keyboard produces is the same character to the
 * author, the same way the résumé's grammar takes either pipe.
 */
export const list = (form: FormData, key: string): string[] =>
  str(form, key)
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);

/** Shared by every keyed table — an empty key would upsert a "" row forever.
 *  Post slugs obey the same grammar (they become URLs). */
export const validKey = (key: string): boolean => /^[a-z0-9][a-z0-9-]*$/.test(key);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The regex is happy with 2026-02-30; the round trip through `Date` is not
 *  (a date-only ISO string parses as UTC, so it comes back unchanged). */
export const validDate = (value: string): boolean => {
  if (!DATE_RE.test(value)) return false;
  const time = Date.parse(value);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
};

/**
 * A site-relative path: one leading slash and no way off the site.
 * `//evil.com` also starts with "/" — a browser reads that as
 * protocol-relative — and so does `/\evil.com`, since URL parsing treats a
 * backslash as a slash.
 */
export const validPath = (value: string): boolean =>
  value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");

/**
 * Anything a page renders as an `href` or `src`: a full http(s) URL, or a
 * path on this site. Everything else with a scheme — `javascript:`, `data:`
 * — is refused, the same belt the markdown pipeline wears (lib/markdown.ts).
 * Only the author writes here; this is for the day that stops being true.
 */
export const validLink = (value: string): boolean =>
  /^https?:\/\/\S+$/.test(value) || validPath(value);

/** A GitHub account name — it is spliced into a URL path on /resume. */
export const validGithubUser = (value: string): boolean =>
  /^[A-Za-z0-9-]{1,39}$/.test(value);

/** What a Postgres `integer` column holds. `Number.isInteger(1e10)` is true,
 *  and the column would still refuse it — as a database error, not a form one. */
const INT4_MIN = -2147483648;
const INT4_MAX = 2147483647;

/**
 * `Number(form.get("sort") ?? 0)` looked safe and was not: `Number("abc")` is
 * NaN and `Number("1e400")` is Infinity, and either reaches the integer column
 * as a database error rather than a form one. Empty means `fallback`; anything
 * else has to be a whole number the column can hold.
 */
export function intField<Fallback extends number | null>(
  form: FormData,
  key: string,
  label: string,
  fallback: Fallback
): { ok: true; value: number | Fallback } | { ok: false; error: string } {
  const text = str(form, key);
  if (!text) return { ok: true, value: fallback };
  const n = Number(text);
  if (!Number.isInteger(n)) return { ok: false, error: `${label}要填整数。` };
  if (n < INT4_MIN || n > INT4_MAX) return { ok: false, error: `${label}超出范围了。` };
  return { ok: true, value: n };
}
