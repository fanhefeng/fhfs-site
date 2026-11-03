import type { SearchEntry } from "../search";

// Only unfinished reads are shared. Completed content belongs to the server's
// 30-second cache, so reopening search can see edits from either deployment.
const pending = new Map<string, Promise<SearchEntry[]>>();

export function loadSearchIndex(locale: string): Promise<SearchEntry[]> {
  const existing = pending.get(locale);
  if (existing) return existing;
  const request = fetch(`/${locale}/search.json`, {
    credentials: "omit",
    cache: "no-cache",
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(String(response.status));
      const entries: SearchEntry[] = await response.json();
      if (!Array.isArray(entries)) throw new Error("Invalid search index");
      return entries;
    })
    .finally(() => {
      if (pending.get(locale) === request) pending.delete(locale);
    });
  pending.set(locale, request);
  return request;
}
