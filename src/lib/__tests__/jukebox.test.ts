import { describe, expect, it } from "vitest";
import {
  holdMusic,
  jukebox,
  releaseMusic,
  reportFailure,
  reportGesture,
  reportPlayback,
  roomStart,
  roomStop,
  setTrack,
  stopMusic,
  toggleMusic,
  wantMusic,
} from "../jukebox";
import { DEFAULT_TRACK } from "../tracks";

// One module-level store, so these run in order and each leaves it switched off.
describe("the jukebox store", () => {
  it("starts dark, on the theme, with nobody having said no", () => {
    expect(jukebox()).toEqual({
      wanted: false,
      playing: false,
      gestured: false,
      track: DEFAULT_TRACK,
      silenced: false,
      held: false,
    });
  });

  // A voice note on the board takes the floor: the switch stays on and the
  // sign stays lit, but the record waits — and neither the reader's "no" nor
  // the switch is touched on the way back.
  it("steps aside for another player and comes back with the switch untouched", () => {
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
    toggleMusic();
    expect(jukebox()).toMatchObject({ wanted: true, silenced: false });
    toggleMusic();
    expect(jukebox()).toMatchObject({ wanted: false, silenced: true });
    wantMusic();
    expect(jukebox()).toMatchObject({ wanted: true, silenced: false });
    stopMusic();
  });

  it("lets a room put its record on and take it off without touching that no", () => {
    setTrack("lovely");
    roomStart();
    expect(jukebox()).toMatchObject({ wanted: true, silenced: true, track: "lovely" });
    roomStop();
    setTrack(DEFAULT_TRACK);
    expect(jukebox()).toMatchObject({ wanted: false, silenced: true, track: DEFAULT_TRACK });
  });

  it("hands out a new snapshot only when something changed", () => {
    reportGesture();
    const before = jukebox();
    reportGesture();
    expect(jukebox()).toBe(before);
    expect(before.gestured).toBe(true);
  });

  // Every sign reads `wanted`: a record that will not load has to put the
  // lights out, or the sign stays lit over silence.
  it("switches off when the record fails to load, without calling it the reader's no", () => {
    wantMusic();
    reportPlayback({ playing: true });
    reportFailure();
    expect(jukebox()).toMatchObject({ wanted: false, playing: false, silenced: false });
  });
});
