"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_TRACK, type TrackId } from "./tracks";

/**
 * The site's one record player, as a store: every sign on the site is a
 * switch for the same music, and the player itself (`components/fx/Jukebox`)
 * lives in the locale layout so the tune survives a route change.
 *
 * Signs write `wanted`; the player reads it and reports back `playing` and
 * `fallback`. Rooms write `track` — the board and the secrets each play the
 * song they are named after, and hand the theme back on the way out. Nothing
 * here touches the DOM — the module is plain state, so the front door, the
 * lab study, the rooms and the note on the island all read the same snapshot
 * without a provider.
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
  /** Which record is on — see `lib/tracks`. */
  track: TrackId;
  /**
   * The reader switched the music off themselves. A room that would put its
   * own record on when entered leaves the player alone while this holds —
   * "no" was said once, and walking through a door is not a change of mind.
   * Switching the music on again clears it.
   */
  silenced: boolean;
};

const INITIAL: JukeboxState = {
  wanted: false,
  playing: false,
  fallback: false,
  gestured: false,
  track: DEFAULT_TRACK,
  silenced: false,
};

let state: JukeboxState = INITIAL;
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
const getServerSnapshot = () => INITIAL;

/** The live state, for components. */
export function useJukebox(): JukeboxState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The live state, for imperative code (a GSAP callback, an event handler). */
export const jukebox = (): JukeboxState => state;

/** Lights on: the reader wants the music. */
export const wantMusic = () => set({ wanted: true, silenced: false });
/** Lights off: and the music with them. Said by the reader, so it is remembered. */
export const stopMusic = () => set({ wanted: false, silenced: true });
export const toggleMusic = () => (state.wanted ? stopMusic() : wantMusic());

/**
 * For the rooms only: put a record on, or take it off, without touching the
 * switch. A room that starts the music on entry uses `wantMusic` for that
 * part — that is the reader's switch, and it clears `silenced` as it should
 * not — so the room checks `silenced` first and calls `roomStart` instead.
 */
export const setTrack = (track: TrackId) => set({ track });
/** Music on because a room was entered, not because a switch was thrown:
 *  `silenced` stays as it was. */
export const roomStart = () => set({ wanted: true });
/** The room's music off again on the way out — likewise not a "no" from the reader. */
export const roomStop = () => set({ wanted: false });

/** For the player only. */
export const reportPlayback = (patch: Pick<JukeboxState, "playing"> | Pick<JukeboxState, "fallback">) =>
  set(patch);
export const reportGesture = () => set({ gestured: true });
