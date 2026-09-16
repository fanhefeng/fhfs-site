"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { jukebox, reportGesture, reportPlayback, useJukebox } from "@/lib/jukebox";
import { trackFile, trackStandIn, trackUri, type TrackId } from "@/lib/tracks";

/** Which records exist, and where — `lib/tracks`. The store says which is on. */
const PLAYER_W = 320;
const PLAYER_H = 152;

/**
 * The stand-in when Spotify cannot be reached at all (its host is reset from
 * some networks, mainland China's among them): NetEase Cloud Music's own
 * embed of whatever version of the record streams there without a login — a
 * piano rendition for each of the three songs (`lib/tracks` says which, and
 * the room says so on the page). The embed has no remote, so it is mounted
 * with the music wanted and unmounted without, and only ever mounted with
 * autoplay once the reader has touched the page, which is when a browser
 * would allow it. The theme needs none of this: it is our own file.
 */
const NETEASE_H = 86;
/** How long to wait for Spotify's script before giving up on it. */
const SPOTIFY_TIMEOUT = 12_000;

/* ------------------------------------------------------------------ */
/* Spotify's iFrame API — the embed with a remote.                       */
/* ------------------------------------------------------------------ */

type PlaybackUpdate = {
  data: { playingURI: string; isPaused: boolean; isBuffering: boolean; duration: number; position: number };
};
type SpotifyController = {
  play(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  /** Swaps the record without rebuilding the embed. */
  loadUri(uri: string): void;
  destroy(): void;
  addListener(event: "ready", cb: () => void): void;
  addListener(event: "playback_update", cb: (e: PlaybackUpdate) => void): void;
};
type SpotifyIFrameAPI = {
  createController(
    element: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number },
    callback: (controller: SpotifyController) => void
  ): void;
};

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void;
    /** The API object, once it has arrived — it only ever arrives once. */
    __spotifyIframeApi?: SpotifyIFrameAPI;
  }
}

const SPOTIFY_API_SRC = "https://open.spotify.com/embed/iframe-api/v1";

let spotifyApi: Promise<SpotifyIFrameAPI> | null = null;

/**
 * Loads Spotify's script once per page. The API comes back through a global
 * callback that the script calls exactly once, so the object is kept on
 * `window`: a second mount (or a dev reload of this module) must not load
 * the script again and wait for a call that will never come.
 */
function loadSpotifyApi(): Promise<SpotifyIFrameAPI> {
  if (window.__spotifyIframeApi) return Promise.resolve(window.__spotifyIframeApi);
  if (spotifyApi) return spotifyApi;
  spotifyApi = new Promise((resolve, reject) => {
    window.onSpotifyIframeApiReady = (api) => {
      window.__spotifyIframeApi = api;
      resolve(api);
    };
    if (document.querySelector(`script[src="${SPOTIFY_API_SRC}"]`)) return;
    const script = document.createElement("script");
    script.src = SPOTIFY_API_SRC;
    script.async = true;
    script.onerror = () => {
      spotifyApi = null;
      script.remove();
      reject(new Error("Spotify iFrame API failed to load"));
    };
    document.head.appendChild(script);
  });
  return spotifyApi;
}

type Deck = {
  controller: SpotifyController | null;
  ready: boolean;
  playing: boolean;
  started: boolean;
  /** A restart has been asked for and the position has not come back round yet. */
  restarting: boolean;
  /** The record the embed was built with, or last told to load. */
  track: TrackId | null;
};

/**
 * The record player behind the wall.
 *
 * Mounted once in the locale layout and never seen: whatever plays, plays
 * from here, so the tune survives a route change. Which machine it uses
 * depends on the record the signs ask for (`lib/jukebox`, `lib/tracks`):
 *
 * - **Our own file** (the theme): a plain `<audio loop>`, `preload="none"`
 *   until someone actually wants music. No embed, no script, no network but
 *   ours — and the whole recording, not a preview.
 * - **A streamed record** (the three songs): a Spotify embed with its remote,
 *   parked in the corner at opacity 0 and built the first time such a record
 *   is wanted. It follows `wanted` — play or resume up, pause down — and
 *   starts the tune over when it runs out. A room that asks for another
 *   streamed record gets it through `loadUri`, from the top; walking back out
 *   to the theme takes the embed down altogether.
 *
 * Either way, a browser refuses the first play until the reader has touched
 * the page, so the first click or key anywhere tries again.
 *
 * The box stays inside the viewport on purpose: browsers throttle the timers
 * of a cross-origin frame that has scrolled out of view, and the player's
 * buffering runs on them. It is `inert`, so nothing in it can take focus or
 * be read out.
 */
export function Jukebox() {
  const t = useTranslations("common");
  const hostRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { wanted, fallback, gestured, track } = useJukebox();
  /** The file we serve ourselves for this record, if it is one of ours. */
  const file = trackFile(track);
  /** The stand-in's URL while it is mounted; a re-render must never reload it. */
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);
  /** A streamed record has been wanted at least once — a one-way latch. */
  const [armed, setArmed] = useState(false);
  /** Spotify's embed belongs on the page right now. */
  const streaming = armed && !file && !fallback;

  const deck = useRef<Deck>({
    controller: null,
    ready: false,
    playing: false,
    started: false,
    restarting: false,
    track: null,
  });

  // Browsers only let a page make sound once the reader has touched it.
  useEffect(() => {
    const onGesture = () => {
      reportGesture();
      if (!jukebox().wanted) return;
      const el = audioRef.current;
      if (el?.paused) void el.play().catch(() => {});
      const d = deck.current;
      if (d.ready && d.controller && !d.playing) {
        if (d.started) d.controller.resume();
        else d.controller.play();
      }
    };
    document.addEventListener("pointerdown", onGesture, true);
    document.addEventListener("keydown", onGesture, true);
    return () => {
      document.removeEventListener("pointerdown", onGesture, true);
      document.removeEventListener("keydown", onGesture, true);
    };
  }, []);

  // The first time a streamed record is wanted, the player is fetched. Our
  // own file needs nothing fetched, so a reader who only ever hears the theme
  // never loads Spotify's script at all.
  useEffect(() => {
    if (wanted && !file) setArmed(true);
  }, [wanted, file]);

  /* ---- Our own file ---- */

  // What the element reports is what the rest of the site believes: a play
  // the browser refused never fires `play`, so `playing` stays false and the
  // sign stays unlit until the gesture handler above gets it going.
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

  // The switch, for our file: `loop` keeps it going, so there is nothing to
  // restart and nothing to resume — the element remembers its position.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (wanted) void el.play().catch(() => {});
    else el.pause();
  }, [wanted, file]);

  /* ---- Spotify ---- */
  useEffect(() => {
    const host = hostRef.current;
    if (!streaming || !host) return;
    let disposed = false;
    // Spotify took too long: the stand-in is up, and a late arrival is ignored.
    let gaveUp = false;
    const d = deck.current;

    // The API replaces the element it is given, so it gets one of its own
    // inside the box React owns.
    const mount = document.createElement("div");
    host.replaceChildren(mount);

    // A blocked host usually fails fast; one that drops packets can hang the
    // script for a minute. Either way the music must not wait that long.
    const giveUp = () => {
      if (disposed || gaveUp || d.controller) return;
      gaveUp = true;
      reportPlayback({ fallback: true });
    };
    const timer = window.setTimeout(giveUp, SPOTIFY_TIMEOUT);

    loadSpotifyApi().then(
      (api) => {
        window.clearTimeout(timer);
        if (disposed || gaveUp) return;
        // Built with whatever record is on right now — a reader who lands
        // straight in a room gets that room's song, not the one they last
        // heard. If the record has become one of ours in the meantime, this
        // effect is already on its way out; there is nothing to build.
        const uri = trackUri(jukebox().track);
        if (!uri) return;
        d.track = jukebox().track;
        api.createController(mount, { uri, width: PLAYER_W, height: PLAYER_H }, (controller) => {
          if (disposed) {
            controller.destroy();
            return;
          }
          d.controller = controller;
          controller.addListener("ready", () => {
            d.ready = true;
            // The record may have changed while the embed was being built.
            const now = jukebox().track;
            const nowUri = trackUri(now);
            if (nowUri && now !== d.track) {
              d.track = now;
              d.started = false;
              controller.loadUri(nowUri);
            }
            if (jukebox().wanted) controller.play();
          });
          controller.addListener("playback_update", (e) => {
            const data = e.data;
            d.playing = !data.isPaused;
            // The end of the track (or of the 30s preview) arrives as a
            // "playing" update parked on the last millisecond, never as a
            // pause — so the end is read off the position, and a beat early:
            // once the embed has reached its own end state it puts up its
            // upsell card and ignores a restart. Updates come about a second
            // apart, so 1.5s of headroom catches the last one before that.
            const ended = data.duration > 0 && data.position >= data.duration - 1500;
            if (ended) {
              d.playing = false;
              if (jukebox().wanted && !d.restarting) {
                d.restarting = true;
                controller.restart();
              }
              return;
            }
            if (data.position < 1000) d.restarting = false;
            if (d.playing) d.started = true;
            reportPlayback({ playing: d.playing });
          });
        });
      },
      () => {
        window.clearTimeout(timer);
        giveUp();
      }
    );

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      d.controller?.destroy();
      d.controller = null;
      d.ready = false;
      d.playing = false;
      d.started = false;
      d.track = null;
      reportPlayback({ playing: false });
      host.replaceChildren();
    };
  }, [streaming]);

  // The record, for Spotify: a room asking for another streamed song swaps it
  // in from the top. `loadUri` does not start playback by itself, so the
  // switch below sees a stopped deck and plays it if the music is wanted. A
  // record of ours is not Spotify's business — the embed has come down with
  // `streaming` by the time this runs.
  useEffect(() => {
    const d = deck.current;
    const uri = trackUri(track);
    if (!uri || !d.ready || !d.controller || d.track === track) return;
    d.track = track;
    d.started = false;
    d.playing = false;
    d.restarting = false;
    d.controller.loadUri(uri);
    if (jukebox().wanted) d.controller.play();
  }, [track]);

  // The switch, for Spotify: resume or pause whatever is loaded.
  useEffect(() => {
    const d = deck.current;
    if (!d.ready || !d.controller) return;
    if (wanted && !d.playing) {
      if (d.started) d.controller.resume();
      else d.controller.play();
    } else if (!wanted && d.playing) {
      d.controller.pause();
    }
  }, [wanted]);

  // The stand-in follows the switch: mounted with the music wanted, gone
  // without it — and mounted only once the page has been touched, or its
  // autoplay would be refused and there is no remote to try again with. A
  // change of record is a change of URL, i.e. a remount: the embed has no
  // other way to be told.
  useEffect(() => {
    if (!fallback || file) {
      setFallbackSrc(null);
      return;
    }
    const src = trackStandIn(track);
    const up = wanted && gestured && !!src;
    setFallbackSrc(up ? src : null);
    reportPlayback({ playing: up });
  }, [fallback, wanted, gestured, track, file]);

  return (
    <div className="jukebox" aria-hidden="true" inert>
      <style href="fx-jukebox" precedence="low">{CSS}</style>
      {file ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- an instrumental, and this player is not a control
        <audio ref={audioRef} src={file} loop preload="none" />
      ) : fallback ? (
        fallbackSrc && (
          <iframe
            title={t("musicTitle")}
            src={fallbackSrc}
            width={PLAYER_W}
            height={NETEASE_H}
            allow="autoplay; encrypted-media"
          />
        )
      ) : (
        <div ref={hostRef} />
      )}
    </div>
  );
}

/* In the viewport, out of sight: opacity alone, so the frame is never
   throttled as off-screen (see the component note). */
const CSS = `
.jukebox {
  position: fixed;
  left: 0;
  bottom: 0;
  width: ${PLAYER_W}px;
  height: ${PLAYER_H}px;
  opacity: 0;
  pointer-events: none;
  z-index: 0;
}
.jukebox iframe { display: block; border: 0; }
`;
