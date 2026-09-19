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

/** `--bg` in each theme (globals.css), for the browser's own chrome: the
 *  layout's `theme-color` metas are written from this. */
export const THEME_COLOR = { light: "#faf9f6", dark: "#0e0e11" } as const;

/**
 * The layout ships one `theme-color` per `prefers-color-scheme`, which is
 * right until the reader flips the light by hand — the metas go on answering
 * for the OS. Writing the chosen colour into every one of them makes the
 * media queries moot, so the address bar follows the room.
 */
export function paintBrowserChrome(theme: Theme): void {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    if (meta.content !== THEME_COLOR[theme]) meta.content = THEME_COLOR[theme];
  }
}

export const readTheme = (): Theme =>
  typeof document !== "undefined" && document.documentElement.dataset.theme === "dark"
    ? "dark"
    : "light";

let vtCleanup: number | undefined;

/** Flips the theme, wrapped in the 1.2s view-transition cross-fade. */
export function toggleTheme(): void {
  // Read inside `apply`, not here: `startViewTransition` runs its callback
  // after the snapshot, so a second flip that lands before the first callback
  // would otherwise read the theme it is already on its way to setting, and
  // both presses would resolve to the same side.
  const apply = () => {
    const next: Theme = readTheme() === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    paintBrowserChrome(next);
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
