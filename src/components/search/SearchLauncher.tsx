"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { isTyping, SEARCH_EVENT } from "@/lib/client/search";

/** The palette itself, fetched the first time anyone asks for it. */
const SearchPalette = dynamic(() => import("./SearchPalette").then((m) => m.SearchPalette), {
  ssr: false,
});

/**
 * The one listener behind every way into search: ⌘K / Ctrl+K anywhere, `/`
 * outside a text field, and the search buttons (`openSearch()`). Until the
 * first of those it renders nothing and has loaded nothing but this file;
 * the palette's chunk and its index are fetched on demand.
 */
export function SearchLauncher() {
  // null until first opened — then the palette stays mounted, closed or not,
  // so its index is not fetched twice.
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    const show = () => setOpen(true);
    const onKey = (event: KeyboardEvent) => {
      const combo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const slash =
        event.key === "/" && !event.metaKey && !event.ctrlKey && !isTyping(event.target);
      if (!combo && !slash) return;
      event.preventDefault();
      setOpen((was) => (combo && was ? false : true));
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(SEARCH_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(SEARCH_EVENT, show);
    };
  }, []);

  return open === null ? null : <SearchPalette open={open} onClose={() => setOpen(false)} />;
}
