/**
 * The site-wide theme contract, in one place: localStorage 'fhfs-theme' +
 * documentElement.dataset.theme + the 'fhfs:theme' event. The pre-paint
 * script in the layouts writes the same three-part state; LightSwitch and
 * RadialFab both flip it through here.
 *
 * Browser-only by nature — call from event handlers and effects.
 */

export type Theme = "dark" | "light";

/** The localStorage key. The pre-paint script in `app/themeInit.ts` must
 *  repeat this string literally — it is inlined raw into the HTML. */
export const THEME_STORAGE_KEY = "fhfs-theme";

export const readTheme = (): Theme =>
  typeof document !== "undefined" &&
  document.documentElement.dataset.theme === "dark"
    ? "dark"
    : "light";

let vtCleanup: number | undefined;

/** Flips the theme, wrapped in the 1.2s view-transition cross-fade. */
export function toggleTheme(): void {
  const next: Theme = readTheme() === "light" ? "dark" : "light";
  const apply = () => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* Private mode etc. — the theme still applies for this page view. */
    }
    window.dispatchEvent(new CustomEvent("fhfs:theme"));
  };

  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => void;
  };
  if (typeof doc.startViewTransition === "function") {
    // Scope the theme cross-fade (globals.css, data-vt="theme") to this
    // transition. One shared timer, reset per toggle — a rapid second flip
    // must not strip the attribute in the middle of its own transition.
    document.documentElement.dataset.vt = "theme";
    doc.startViewTransition(apply);
    window.clearTimeout(vtCleanup);
    vtCleanup = window.setTimeout(() => {
      delete document.documentElement.dataset.vt;
    }, 1400);
    return;
  }
  apply();
}
