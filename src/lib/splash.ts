/**
 * The front door's handshake, shared by the door itself (`NeonSplash`), the
 * opening ritual it stands in for (`OvertureLight`) and the masthead that
 * waits behind it (`Opening`).
 *
 * The door opens once per session, and only on a hard landing on the home
 * page: a reader already inside the site who walks back to the cover must
 * not be shut out again. So the decision is made by an inline script in the
 * page's own HTML — it runs only when that HTML is parsed, never on a client
 * navigation — and is stamped on <html> as `data-splash="due"|"seen"` before
 * first paint, where CSS can act on it before React has hydrated anything.
 *
 * Development only: `?splash` on the URL puts the door back every load and
 * never spends the key. Production ignores the parameter.
 */
export const SPLASH_SEEN_KEY = "fhfs-splash-seen";

const DEBUG_CLAUSE =
  process.env.NODE_ENV === "production" ? "" : 'if(/[?&]splash(=|&|$)/.test(location.search))s="due";';

/** Blocked storage (private mode, cookie policy) must not strand the page behind the wall: a throw reads as "seen". */
export const SPLASH_INIT_SCRIPT = `(function(){var s="due";try{if(sessionStorage.getItem("${SPLASH_SEEN_KEY}"))s="seen"}catch(e){s="seen"}${DEBUG_CLAUSE}document.documentElement.dataset.splash=s})()`;

/** True while the door still stands between the reader and the page. */
export const splashDue = (): boolean => document.documentElement.dataset.splash === "due";

/** The debug replay: shown every load, never remembered. */
export const splashDebug = (): boolean =>
  process.env.NODE_ENV !== "production" && /[?&]splash(=|&|$)/.test(window.location.search);
