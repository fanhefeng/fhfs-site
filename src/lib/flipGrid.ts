import { EASE, Flip, gsap } from "@/lib/gsap";

/**
 * A grid that reshuffles when it is filtered — /software's bento, and the lab
 * study that shows it on its own. Every item stays in the DOM, the filter only
 * toggles `display`, and Flip replays the difference: `captureGrid` in the
 * click handler, before React re-renders; `playGrid` in the layout-phase
 * effect after it.
 */
export type GridState = ReturnType<typeof Flip.getState>;

type Items = NodeListOf<Element> | Element[];

/**
 * The layout as it stands, to be played from.
 *
 * First it finishes whatever the last reshuffle left running and wipes what
 * its entrances and exits wrote inline. That used to be `revertOnUpdate`'s
 * job, and reverting is precisely what went wrong: a *finished* flip whose
 * items had entered through the `fromTo` below reverts to the inline styles
 * those tweens recorded when they were made — mid-flip, `visibility: hidden`
 * and an absolute-positioning transform — so filter A, then B, then "all"
 * left B's cards in the grid, invisible and displaced. Completing and
 * clearing leaves nothing to restore wrongly. A click mid-flight still lands
 * cleanly: all of this, the re-render and the next `Flip.from` happen before
 * the browser paints again.
 */
export function captureGrid(items: Items): GridState {
  Flip.killFlipsOf(items, true);
  gsap.killTweensOf(items);
  gsap.set(items, { clearProps: "opacity,visibility,scale,transform" });
  return Flip.getState(items);
}

/**
 * Play from a captured layout to the one now in the DOM: survivors slide,
 * arrivals fade up from 0.94, departures go the other way. `slow` stretches
 * every duration by the same factor (the study's slow motion).
 */
export function playGrid(state: GridState, { slow = 1, onComplete = () => {} } = {}) {
  return Flip.from(state, {
    duration: 0.55 * slow,
    ease: EASE.travel,
    absolute: true,
    stagger: 0.03 * slow,
    onComplete,
    onEnter: (els) =>
      gsap.fromTo(
        els,
        { autoAlpha: 0, scale: 0.94 },
        { autoAlpha: 1, scale: 1, duration: 0.4 * slow, ease: EASE.soft },
      ),
    onLeave: (els) =>
      gsap.to(els, { autoAlpha: 0, scale: 0.94, duration: 0.25 * slow, ease: EASE.exit }),
  });
}
