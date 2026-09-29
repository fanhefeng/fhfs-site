import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DEFAULT_TRACK } from "../tracks";

// The store is module state. Each case imports a fresh copy, so none of them
// leans on what the one before it left behind, and any order passes.
let store: typeof import("../client/jukebox");
beforeEach(async () => {
  vi.resetModules();
  store = await import("../client/jukebox");
});

describe("the jukebox store", () => {
  it("starts dark, on the theme, with nobody having said no", () => {
    expect(store.jukebox()).toEqual({
      wanted: false,
      track: DEFAULT_TRACK,
      silenced: false,
      held: false,
    });
  });

  // A voice note on the board takes the floor: the switch stays on and the
  // sign stays lit, but the record waits — and neither the reader's "no" nor
  // the switch is touched on the way back.
  it("steps aside for another player and comes back with the switch untouched", () => {
    const { holdMusic, jukebox, releaseMusic, stopMusic, wantMusic } = store;
    wantMusic();
    holdMusic();
    expect(jukebox()).toMatchObject({ wanted: true, held: true, silenced: false });
    releaseMusic();
    expect(jukebox()).toMatchObject({ wanted: true, held: false });
    stopMusic();
    holdMusic();
    expect(jukebox()).toMatchObject({ wanted: false, held: true, silenced: true });
    releaseMusic();
    expect(jukebox()).toMatchObject({ wanted: false, held: false, silenced: true });
  });

  it("remembers a reader's no, and forgets it when they switch the music on", () => {
    const { jukebox, toggleMusic, wantMusic } = store;
    toggleMusic();
    expect(jukebox()).toMatchObject({ wanted: true, silenced: false });
    toggleMusic();
    expect(jukebox()).toMatchObject({ wanted: false, silenced: true });
    wantMusic();
    expect(jukebox()).toMatchObject({ wanted: true, silenced: false });
  });

  it("lets a room put its record on and take it off without touching that no", () => {
    const { jukebox, roomStart, roomStop, setTrack, stopMusic } = store;
    stopMusic();
    setTrack("lovely");
    roomStart();
    expect(jukebox()).toMatchObject({ wanted: true, silenced: true, track: "lovely" });
    roomStop();
    setTrack(DEFAULT_TRACK);
    expect(jukebox()).toMatchObject({ wanted: false, silenced: true, track: DEFAULT_TRACK });
  });

  it("hands out a new snapshot only when something changed", () => {
    const { holdMusic, jukebox, releaseMusic } = store;
    const before = jukebox();
    releaseMusic();
    expect(jukebox()).toBe(before);
    holdMusic();
    expect(jukebox()).not.toBe(before);
  });

  // Every sign reads `wanted`: a record that will not load has to put the
  // lights out, or the sign stays lit over silence.
  it("switches off when the record fails to load, without calling it the reader's no", () => {
    const { jukebox, reportFailure, wantMusic } = store;
    wantMusic();
    reportFailure();
    expect(jukebox()).toMatchObject({ wanted: false, silenced: false });
  });
});
