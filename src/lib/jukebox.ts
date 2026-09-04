"use client";

import { useSyncExternalStore } from "react";

/**
 * The site's one record player, as a store: every sign on the site is a
 * switch for the same music, and the player itself (`components/fx/Jukebox`)
 * lives in the locale layout so the tune survives a route change.
 *
 * Signs write `wanted`; the player reads it and reports back `playing` and
 * `fallback`. Nothing here touches the DOM — the module is plain state, so
 * the front door, the lab study and the note on the island all read the same
 * snapshot without a provider.
 */
export type JukeboxState = {
  /** A sign is lit somewhere: the reader wants music. */
  wanted: boolean;
  /** Sound is actually coming out (as far as the player can tell). */
  playing: boolean;
  /** Spotify could not be had; the stand-in recording is in use. */
  fallback: boolean;
  /** The reader has clicked or typed on the page: a browser will allow sound now. */
  gestured: boolean;
};

let state: JukeboxState = { wanted: false, playing: false, fallback: false, gestured: false };
const listeners = new Set<() => void>();

function set(patch: Partial<JukeboxState>) {
  let changed = false;
  for (const key of Object.keys(patch) as (keyof JukeboxState)[]) {
    if (state[key] !== patch[key]) changed = true;
  }
  if (!changed) return;
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getSnapshot = () => state;
const SERVER: JukeboxState = { wanted: false, playing: false, fallback: false, gestured: false };
const getServerSnapshot = () => SERVER;

/** The live state, for components. */
export function useJukebox(): JukeboxState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The live state, for imperative code (a GSAP callback, an event handler). */
export const jukebox = (): JukeboxState => state;

/** Lights on: the reader wants the music. */
export const wantMusic = () => set({ wanted: true });
/** Lights off: and the music with them. */
export const stopMusic = () => set({ wanted: false });
export const toggleMusic = () => set({ wanted: !state.wanted });

/** For the player only. */
export const reportPlayback = (patch: Pick<JukeboxState, "playing"> | Pick<JukeboxState, "fallback">) =>
  set(patch);
export const reportGesture = () => set({ gestured: true });
