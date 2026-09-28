"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  holdMusic,
  jukebox,
  releaseMusic,
  reportFailure,
  reportGesture,
  reportPlayback,
  useJukebox,
} from "@/lib/jukebox";
import type { TrackFiles } from "@/lib/tracks";

/** Players whose file would not load: `paused` still reads false on them. */
const failed = new WeakSet<HTMLMediaElement>();

/** Actually making sound, or about to — not a play request over a dead file. */
const sounding = (media: HTMLMediaElement) => !media.paused && !media.error && !failed.has(media);

const nextSource = (source: HTMLSourceElement) => {
  for (let el = source.nextElementSibling; el; el = el.nextElementSibling) {
    if (el instanceof HTMLSourceElement) return el;
  }
  return null;
};

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
 * The signs follow `wanted`, the player answers with `playing`. A play the
 * browser refused (the reader has not touched the page yet) is simply tried
 * again on the first click or key anywhere. A record that will not load is
 * different — nothing will ever come of it — so the player switches `wanted`
 * back off and every sign goes dark with it (`reportFailure`).
 *
 * It is also the page's one rule about sound: never two things at once.
 * Every `<audio>` and `<video>` on the site — the voice notes and videos on
 * the board, the podcast — fires `play` and `pause` events that do not
 * bubble but can be caught at the document in the capture phase, and this
 * component is the one place that is always mounted to catch them. When one
 * starts, every other player is paused and the record steps aside (`held`);
 * when the last of them stops, the record comes back on its own, if it was
 * wanted. A route change takes the old page's players with it without a
 * pause event, so the hold is checked again there.
 *
 * This used to be two players — a Spotify embed with a NetEase stand-in
 * behind it — and both are gone now that every record is a file of ours
 * (`lib/tracks` has the note).
 *
 * `files` arrives from the layout already hashed (`lib/trackFiles`): resolving
 * them here would put the whole asset manifest in every page's scripts.
 */
export function Jukebox({ files }: { files: TrackFiles }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { wanted, held, track } = useJukebox();
  const file = files[track];
  const pathname = usePathname();

  // Browsers only let a page make sound once the reader has touched it.
  useEffect(() => {
    const onGesture = () => {
      reportGesture();
      const el = audioRef.current;
      const { wanted, held } = jukebox();
      if (wanted && !held && el?.paused) void el.play().catch(() => {});
    };
    document.addEventListener("pointerdown", onGesture, true);
    document.addEventListener("keydown", onGesture, true);
    return () => {
      document.removeEventListener("pointerdown", onGesture, true);
      document.removeEventListener("keydown", onGesture, true);
    };
  }, []);

  // One thing at a time. The record itself is not one of "the others": it is
  // paused through `held`, so that it knows to come back.
  useEffect(() => {
    const others = () =>
      [...document.querySelectorAll<HTMLMediaElement>("audio, video")].filter(
        (media) => media !== audioRef.current,
      );
    const isOther = (target: EventTarget | null): target is HTMLMediaElement =>
      target instanceof HTMLMediaElement && target !== audioRef.current;
    const settle = () => {
      if (!others().some(sounding)) releaseMusic();
    };
    const onStop = (e: Event) => {
      if (isOther(e.target)) settle();
    };
    const onPlay = (e: Event) => {
      if (!isOther(e.target)) return;
      for (const media of others()) {
        if (media !== e.target && !media.paused) media.pause();
      }
      // A player taken out of the page mid-play — a card the filter hid —
      // is paused by the browser, and says so on the element itself, but
      // that `pause` never reaches the document. So listen on the element.
      e.target.addEventListener("pause", onStop, { once: true });
      holdMusic();
    };
    // A file that will not load never pauses: the element keeps `paused`
    // false over silence, and the record would wait for it forever. The
    // failure lands on the element (`src`) or on its last `<source>` — the
    // earlier ones only mean the browser tries the next.
    const onFail = (e: Event) => {
      const target = e.target;
      const media =
        target instanceof HTMLSourceElement && !nextSource(target) ? target.parentElement : target;
      if (!isOther(media)) return;
      failed.add(media);
      settle();
    };
    // A new load is a new chance — the reader pressing play again.
    const onRetry = (e: Event) => {
      if (e.target instanceof HTMLMediaElement) failed.delete(e.target);
    };
    document.addEventListener("play", onPlay, true);
    document.addEventListener("pause", onStop, true);
    document.addEventListener("emptied", onStop, true);
    document.addEventListener("error", onFail, true);
    document.addEventListener("loadstart", onRetry, true);
    return () => {
      document.removeEventListener("play", onPlay, true);
      document.removeEventListener("pause", onStop, true);
      document.removeEventListener("emptied", onStop, true);
      document.removeEventListener("error", onFail, true);
      document.removeEventListener("loadstart", onRetry, true);
    };
  }, []);

  // A player that left with its page never said it stopped.
  useEffect(() => {
    if (!jukebox().held) return;
    const playing = [...document.querySelectorAll<HTMLMediaElement>("audio, video")].some(
      (media) => media !== audioRef.current && sounding(media),
    );
    if (!playing) releaseMusic();
  }, [pathname]);

  // The element is the source of truth for `playing` — and `playing` is the
  // event that means sound, where `play` only means the request was accepted.
  // These files are one to four megabytes behind `preload="none"`, so the gap
  // between the two is the whole of the first buffer. Deliberately no
  // `waiting` handler: a stall mid-track would flicker the state off and on,
  // and the track is still the one playing.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => reportPlayback({ playing: true });
    const onStop = () => reportPlayback({ playing: false });
    el.addEventListener("playing", onPlay);
    el.addEventListener("pause", onStop);
    el.addEventListener("error", reportFailure);
    return () => {
      el.removeEventListener("playing", onPlay);
      el.removeEventListener("pause", onStop);
      el.removeEventListener("error", reportFailure);
      el.pause();
      reportPlayback({ playing: false });
    };
  }, [file]);

  // The switch — and the hold, which is the switch left on with the sound
  // off for a while.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!wanted || held) {
      el.pause();
      return;
    }
    // After a failed load the element is parked: `play()` rejects without
    // fetching again. `load()` is what makes the next press a real retry.
    if (el.error) el.load();
    void el.play().catch(() => {});
  }, [wanted, held, file]);

  return (
    <div className="jukebox" aria-hidden="true" inert>
      <style href="fx-jukebox" precedence="low">
        {CSS}
      </style>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- an instrumental, and this player is not a control */}
      <audio ref={audioRef} src={file} loop preload="none" />
    </div>
  );
}

/* Out of sight, and out of the way: an audio element draws nothing, so the box
   is 0×0 and fixed — out of the flow entirely, with nothing to lay out around. */
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
