import "client-only";

/**
 * How anything on the page opens the search palette: an event on `window`,
 * which the one `SearchLauncher` in the layout listens for. The buttons in
 * the island and the full-screen menu dispatch it, and neither has to import
 * the palette — that chunk loads the first time the event is heard.
 */
export const SEARCH_EVENT = "fhfs:search";

export function openSearch(): void {
  window.dispatchEvent(new Event(SEARCH_EVENT));
}

/** Whether a key press landed somewhere that types — `/` there is a slash, not a shortcut. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}
