/**
 * The route veil's replay hook.
 *
 * The veil plays between routes and nowhere else: `RouteTransition` lets a
 * link to the page it is already on fall through, so the lab's study could
 * only show it by sending the reader somewhere else. This event asks the
 * veil to frost and lift in place — the same cover and reveal, no
 * navigation, and the scroll position kept.
 */
export const VEIL_REPLAY_EVENT = "fhfs:veil-replay";

/** Play the veil once, here, without going anywhere. */
export function replayVeil(): void {
  window.dispatchEvent(new Event(VEIL_REPLAY_EVENT));
}
