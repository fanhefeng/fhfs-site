/**
 * A row of bilingual pairs, read in one language.
 *
 * The tables keep short copy as `{ zh, en }` and lists of lines as
 * `{ zh: [...], en: [...] }` (`Localized`, `LocalizedLines` in the schema).
 * A page that renders a whole row — a film, an idol — would otherwise say
 * `[locale]` on every field; this walks the row once and hands back the same
 * shape with every pair replaced by its side.
 *
 * A side left empty reads the other one, the way a post missing in one
 * language falls back to the other: a film written up in Chinese first shows
 * its Chinese on the English page until the English is written, rather than
 * blank headings.
 */
export type InLocale<T> = T extends { zh: string; en: string }
  ? string
  : T extends { zh: string[]; en: string[] }
    ? string[]
    : T extends readonly (infer U)[]
      ? InLocale<U>[]
      : T extends object
        ? { [K in keyof T]: InLocale<T[K]> }
        : T;

type Locale = "zh" | "en";

const isPair = (value: object): value is { zh: unknown; en: unknown } => {
  const keys = Object.keys(value);
  return keys.length === 2 && keys.includes("zh") && keys.includes("en");
};

export function inLocale<T>(value: T, locale: Locale): InLocale<T> {
  return walk(value, locale) as InLocale<T>;
}

function walk(value: unknown, locale: Locale): unknown {
  if (Array.isArray(value)) return value.map((item) => walk(item, locale));
  if (value === null || typeof value !== "object" || value instanceof Date) return value;
  if (isPair(value)) {
    const other = locale === "zh" ? "en" : "zh";
    const mine = value[locale];
    const empty = Array.isArray(mine) ? mine.length === 0 : !mine;
    return empty ? value[other] : mine;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item, locale)]));
}
