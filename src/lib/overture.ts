/**
 * The opening ritual's handshake, shared by the three components that speak it:
 * the lamp itself (`components/fx/OvertureLight`), the front door that stands
 * in for it on the cover (`components/home/NeonSplash`), and the masthead that
 * waits behind either (`components/home/Opening`).
 *
 * It lives here rather than in the lamp for the same reason `lib/splash.ts`
 * does: a contract two other components read is not the lamp's private
 * business, and importing constants *out of* a component is how the copies
 * start. Storage access is here too — the "blocked storage reads as seen" rule
 * was written twice, and a page stranded behind an opaque curtain is not a
 * failure mode worth having two answers to.
 */
export const OVERTURE_SEEN_KEY = "fhfs-overture-seen";
export const OVERTURE_DONE_EVENT = "fhfs:overture-done";

/**
 * Whether the ritual has already been spent this session.
 *
 * A throw — private mode, a cookie policy — is read as "seen": the curtain is
 * opaque and locks the scroll, so the failure that leaves a reader looking at
 * a black screen must never be the one storage picks by default.
 */
export function overtureSeen(): boolean {
  try {
    return !!sessionStorage.getItem(OVERTURE_SEEN_KEY);
  } catch {
    return true;
  }
}

/** Spend the key. Blocked storage means the ritual simply plays again, which
 *  beats crashing the page over it. */
export function markOvertureSeen(): void {
  try {
    sessionStorage.setItem(OVERTURE_SEEN_KEY, "1");
  } catch {
    /* Replaying the overture beats crashing the page. */
  }
}

/** The masthead is listening for this; the lamp and the door both fire it. */
export function announceOvertureDone(): void {
  window.dispatchEvent(new Event(OVERTURE_DONE_EVENT));
}
