/**
 * The site's search, as plain functions: what the index holds, and how a
 * query picks from it. The index is built on the server
 * (`app/[locale]/search.json`) and fetched by the palette the first time it
 * opens; everything here runs in the browser against that list, so a key
 * press never waits on the network.
 *
 * Every query term is required. Chinese keeps substring matching; Latin
 * terms match at word starts, so AI does not find "waited" or "again".
 * A few hundred short entries need no separately built search index.
 */

/** What an entry is — the palette groups and labels by it. */
export const SEARCH_KINDS = [
  "page",
  "post",
  "secret",
  "app",
  "lab",
  "film",
  "idol",
  "moment",
] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export type SearchEntry = {
  kind: SearchKind;
  title: string;
  /** Searched as well as the title, and where a snippet is cut from. */
  text: string;
  /** A path without the locale — `/blog/x`, `/moments#m-…`. */
  href: string;
  /** A short mono note beside the title: a date, a year, a category. */
  meta?: string;
};

export type SearchHit = SearchEntry & { snippet: string };

/** The words of a query, lower-cased, blanks dropped. */
export const queryTerms = (query: string): string[] =>
  query.toLowerCase().split(/\s+/).filter(Boolean);

/** Both arguments are lower-cased; CJK text can border a Latin word. */
function termIndex(text: string, term: string): number {
  let at = text.indexOf(term);
  if (!/^[a-z0-9]/.test(term)) return at;
  while (at !== -1) {
    if (at === 0 || !/[a-z0-9]/.test(text[at - 1]!)) return at;
    at = text.indexOf(term, at + 1);
  }
  return -1;
}

/**
 * A line of `text` around the first place a term occurs, `radius` characters
 * either side, with an ellipsis where it was cut; the text's opening when no
 * term is in it. Newlines are flattened — a snippet is one line.
 */
export function snippet(text: string, terms: readonly string[], radius = 36): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const lower = flat.toLowerCase();
  let at = -1;
  for (const term of terms) {
    const i = termIndex(lower, term);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) return flat.length > radius * 2 ? `${flat.slice(0, radius * 2)}…` : flat;
  const start = Math.max(0, at - radius);
  const end = Math.min(flat.length, at + radius);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}

/**
 * The entries every term of `query` occurs in, best first: a hit in the
 * title outranks one only in the text, then the kinds in `SEARCH_KINDS`
 * order (a page before a post before a moment), then the index's own order,
 * which is newest first within a kind. An empty query finds nothing — the
 * palette shows its own suggestions then.
 */
export function search(entries: readonly SearchEntry[], query: string, limit = 40): SearchHit[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  const scored: { entry: SearchEntry; score: number; order: number }[] = [];
  entries.forEach((entry, order) => {
    const title = entry.title.toLowerCase();
    const all = `${title}\n${entry.text.toLowerCase()}`;
    if (!terms.every((term) => termIndex(all, term) !== -1)) return;
    const inTitle = terms.filter((term) => termIndex(title, term) !== -1).length;
    const score = inTitle * 100 - SEARCH_KINDS.indexOf(entry.kind);
    scored.push({ entry, score, order });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored
    .slice(0, limit)
    .map(({ entry }) => ({ ...entry, snippet: entry.text ? snippet(entry.text, terms) : "" }));
}
