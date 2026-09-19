"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A filter that lives in the address bar — `?key=value` — on a page that stays
 * static.
 *
 * `useSearchParams` would do it and cost the page its prerender (or a Suspense
 * boundary around the very list a crawler came for). This reads the query once,
 * after hydration, and writes it back with `history.replaceState`, which Next
 * keeps in step with its router. The server render is always the unfiltered
 * page; a link that carries a choice narrows it a moment after it lands.
 *
 * `replaceState`, not `pushState`: a filter is a view of the page, not a place
 * in it, and five chips pressed should not be five presses of Back to leave.
 * What this buys is the other three — a reload, a shared link and a return
 * through the history all come back to the same view.
 *
 * `allowed` is what the page actually offers: anything else in the query — an
 * old link, a typo — is no choice at all, rather than an empty list.
 */
export function useUrlChoice(
  key: string,
  allowed: readonly string[],
): [string | null, (value: string | null) => void] {
  const [choice, setChoice] = useState<string | null>(null);
  const allowedKey = allowed.join("\n");

  useEffect(() => {
    const read = () => {
      const value = new URLSearchParams(window.location.search).get(key);
      setChoice(value !== null && allowedKey.split("\n").includes(value) ? value : null);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [key, allowedKey]);

  const choose = useCallback(
    (value: string | null) => {
      setChoice(value);
      const url = new URL(window.location.href);
      if (value === null) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
      // `null`, as Next's docs have it: handed its own state object back, the
      // patched replaceState takes the call for one of its own and skips the
      // sync with the router.
      window.history.replaceState(null, "", url);
    },
    [key],
  );

  return [choice, choose];
}
