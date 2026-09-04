"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { jukebox, reportGesture, reportPlayback, useJukebox } from "@/lib/jukebox";

/** Mia & Sebastian's Theme — Justin Hurwitz, La La Land (2016). */
const TRACK_ID = "1Vk4yRsz0iBzDiZEoFMQyv";
const TRACK_URI = `spotify:track:${TRACK_ID}`;
const PLAYER_W = 320;
const PLAYER_H = 152;

/**
 * The stand-in when Spotify cannot be reached at all (its host is reset from
 * some networks, mainland China's among them): NetEase Cloud Music's own
 * embed of Hurwitz's 10th-anniversary re-recording of the same theme — the
 * one version of it there that streams without a login. The embed has no
 * remote, so it is mounted with the music wanted and unmounted without, and
 * only ever mounted with autoplay once the reader has touched the page,
 * which is when a browser would allow it.
 */
const NETEASE_ID = "3420987569";
const NETEASE_H = 86;
const neteaseSrc = () => `https://music.163.com/outchain/player?type=2&id=${NETEASE_ID}&auto=1&height=66`;
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
};

/**
 * The record player behind the wall.
 *
 * Mounted once in the locale layout and never seen: a Spotify embed with its
 * remote, parked in the corner at opacity 0, playing whatever the signs ask
 * for (`lib/jukebox`). It is not loaded until the first sign lights — a
 * reader who never touches one never fetches Spotify's player — and from
 * then on it follows `wanted`: play or resume when it goes up, pause when it
 * goes down, and start the tune over when it runs out. If the browser
 * refuses the first play (the reader has not touched the site yet), the
 * first click or key anywhere tries again.
 *
 * The box stays inside the viewport on purpose: browsers throttle the timers
 * of a cross-origin frame that has scrolled out of view, and the player's
 * buffering runs on them. It is `inert`, so nothing in it can take focus or
 * be read out.
 */
export function Jukebox() {
  const t = useTranslations("common");
  const hostRef = useRef<HTMLDivElement>(null);
  const { wanted, fallback, gestured } = useJukebox();
  /** The stand-in's URL while it is mounted; a re-render must never reload it. */
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);
  /** Spotify is being loaded or is loaded — a one-way latch. */
  const [armed, setArmed] = useState(false);

  const deck = useRef<Deck>({ controller: null, ready: false, playing: false, started: false, restarting: false });

  // Browsers only let a page make sound once the reader has touched it.
  useEffect(() => {
    const onGesture = () => {
      reportGesture();
      const d = deck.current;
      if (jukebox().wanted && d.ready && d.controller && !d.playing) {
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

  // The first time music is wanted, the player is fetched.
  useEffect(() => {
    if (wanted) setArmed(true);
  }, [wanted]);

  /* ---- Spotify ---- */
  useEffect(() => {
    const host = hostRef.current;
    if (!armed || fallback || !host) return;
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
        api.createController(mount, { uri: TRACK_URI, width: PLAYER_W, height: PLAYER_H }, (controller) => {
          if (disposed) {
            controller.destroy();
            return;
          }
          d.controller = controller;
          controller.addListener("ready", () => {
            d.ready = true;
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
      reportPlayback({ playing: false });
      host.replaceChildren();
    };
  }, [armed, fallback]);

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
  // autoplay would be refused and there is no remote to try again with.
  useEffect(() => {
    if (!fallback) return;
    const up = wanted && gestured;
    setFallbackSrc(up ? neteaseSrc() : null);
    reportPlayback({ playing: up });
  }, [fallback, wanted, gestured]);

  return (
    <div className="jukebox" aria-hidden="true" inert>
      <style href="fx-jukebox" precedence="low">{CSS}</style>
      {fallback ? (
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
