"use client";

import { useEffect, useRef } from "react";
import { jukebox, reportGesture, reportPlayback, useJukebox } from "@/lib/jukebox";
import { trackFile } from "@/lib/tracks";

/**
 * The record player behind the wall.
 *
 * Mounted once in the locale layout and never seen: one `<audio loop>`,
 * playing whatever record the signs ask for (`lib/jukebox`, `lib/tracks`).
 * `preload="none"` until someone actually wants music, so a reader who never
 * touches a sign never fetches a megabyte of it; `loop` keeps the tune going,
 * so there is nothing to restart; pausing and resuming is the element's own
 * position. A room that asks for its own record gets a new `src`, from the
 * top.
 *
 * What the element reports is what the rest of the site believes: a play the
 * browser refused (the reader has not touched the page yet) never fires
 * `play`, so `playing` stays false and the sign stays unlit until the first
 * click or key anywhere tries again.
 *
 * This used to be two players — a Spotify embed with a NetEase stand-in
 * behind it — and both are gone now that every record is a file of ours
 * (`lib/tracks` has the note).
 */
export function Jukebox() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { wanted, track } = useJukebox();
  const file = trackFile(track);

  // Browsers only let a page make sound once the reader has touched it.
  useEffect(() => {
    const onGesture = () => {
      reportGesture();
      const el = audioRef.current;
      if (jukebox().wanted && el?.paused) void el.play().catch(() => {});
    };
    document.addEventListener("pointerdown", onGesture, true);
    document.addEventListener("keydown", onGesture, true);
    return () => {
      document.removeEventListener("pointerdown", onGesture, true);
      document.removeEventListener("keydown", onGesture, true);
    };
  }, []);

  // The element is the source of truth for `playing`.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => reportPlayback({ playing: true });
    const onStop = () => reportPlayback({ playing: false });
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onStop);
    el.addEventListener("error", onStop);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onStop);
      el.removeEventListener("error", onStop);
      el.pause();
      reportPlayback({ playing: false });
    };
  }, [file]);

  // The switch.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (wanted) void el.play().catch(() => {});
    else el.pause();
  }, [wanted, file]);

  return (
    <div className="jukebox" aria-hidden="true" inert>
      <style href="fx-jukebox" precedence="low">{CSS}</style>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- an instrumental, and this player is not a control */}
      <audio ref={audioRef} src={file} loop preload="none" />
    </div>
  );
}

/* Out of sight, and out of the way: an audio element draws nothing, but the
   box stays a box so nothing else can lay out over a zero-sized node. */
const CSS = `
.jukebox {
  position: fixed;
  left: 0;
  bottom: 0;
  width: 0;
  height: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  z-index: 0;
}
`;
