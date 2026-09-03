"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP, ScrollTrigger, EASE, isFinePointer } from "@/lib/gsap";
import { Reveal } from "@/components/fx/Reveal";
import type { NeonStillSpan } from "./neonStills";

export type NeonStillItem = {
  src: string;
  width: number;
  height: number;
  span: NeonStillSpan;
  alt: string;
  title: string;
  meta: string;
};

type Props = {
  welcome: string;
  signOn: string;
  signOff: string;
  toggleHint: string;
  tonight: string;
  trackTitle: string;
  trackArtist: string;
  /** The artist line when the stand-in player is up: a different recording. */
  fallbackTrackArtist: string;
  /** Why the player looks different, and that it wants a press of play. */
  fallbackHint: string;
  playerTitle: string;
  galleryKicker: string;
  galleryTitle: string;
  galleryLede: string;
  credit: string;
  stills: NeonStillItem[];
};

/** Mia & Sebastian's Theme — Justin Hurwitz, La La Land (2016). */
const TRACK_ID = "1Vk4yRsz0iBzDiZEoFMQyv";
const TRACK_URI = `spotify:track:${TRACK_ID}`;
const PLAYER_HEIGHT = 152;

/**
 * The stand-in when Spotify cannot be reached at all (its host is reset from
 * some networks, mainland China's among them): NetEase Cloud Music's own
 * embed of Hurwitz's 10th-anniversary re-recording of the same theme — the
 * one version of it there that streams without a login. The embed has no
 * remote, so the sign cannot start or stop it; it is mounted while the lights
 * are on and unmounted when they go off, and asked to autoplay only once the
 * reader has touched the page, which is when a browser would allow it.
 */
const NETEASE_ID = "3420987569";
const NETEASE_HEIGHT = 86;
const neteaseSrc = (auto: boolean) =>
  `https://music.163.com/outchain/player?type=2&id=${NETEASE_ID}&auto=${auto ? 1 : 0}&height=66`;
/** How long to wait for Spotify's script before giving up on it. */
const SPOTIFY_TIMEOUT = 12_000;

/* ------------------------------------------------------------------ */
/* The sign, in the units of the drawing it is traced from: the SEB'S    */
/* over the door of Seb's, vectorised from the film on Wikimedia Commons */
/* (File:Seb's.svg, Espandero, CC BY-SA 4.0). Measured off that trace:   */
/* the ring is a circle about (401, 595) of radius 323, its tube 15.6    */
/* wide, the letters' 12.7; it is broken at the top right where the      */
/* note's stem leaves it, and its left arc simply ends at the lower left */
/* while the right arc runs on round the bottom and folds back up into   */
/* the bar — one tube. The letters stand upright, cap ≈ 343, on a        */
/* baseline that climbs to the right by 9.5°.                            */
/* ------------------------------------------------------------------ */

const VIEW_BOX = "0 150 802 802";

/** Tube width, in drawing units; the core sits centred inside it. */
const TUBE = 13;
/** The ring and the bar are bent from a slightly heavier tube. */
const RING_TUBE = 14;

/** The left arc: from the note's stem (−60°) over the top and down the left to 155°. */
const ARC_L = "M562.8 314.9A323.3 323.3 0 0 0 108.2 731.4";
/**
 * The right arc and the bar: down from −30° round the bottom to 135°, then a
 * hairpin back up along the bar to its free end under the S.
 */
const ARC_R_BAR = "M681.2 433.2A323.3 323.3 0 0 1 172.6 823.4L616.2 738.2";

/**
 * The note is the trace's: an outlined stem and an outlined head, one solid
 * shape whose tube the filter finds. The original sits on the B's shoulder;
 * here it has to clear the second F's arm, so it is raised and its stem cut
 * shorter by as much, to stand as far above the ring as the original does.
 */
const NOTE_D =
  "m627.7 271c-11.33 2.004-22.67 4.272-33.92 6.473-0.18 23.5-0.08 47-0.18 70.6v8.585c-2.427-0.8046-1.197 1.28-1.991 2.069-16.85 4.82-32.92 14.4-42.95 29.05-6.548 9.536-10.03 21.17-9.495 32.75 0.3086 6.572 2.091 13.37 6.29 18.56 5.043 5.836 13.12 8.465 20.7 7.743 10.76-0.3604 20.68-5.582 29.24-11.74 13.36-9.731 24.64-22.77 30.58-38.33 2.126-5.701 3.979-11.63 4.364-17.73 0.1006-18.58-0.4451-37.15-0.6702-55.73-0.6-17.2-1.2-34.4-1.8-51.6-0.0923-0.1478 0.1219-0.731-0.1997-0.6646z";
const NOTE_T = "translate(8 -60)";

type GlyphName = "F" | "H" | "S";

/**
 * The letters, as solid outer outlines. S is the trace's S. F is the trace's
 * E without its foot: E's outline up to its bottom-left corner, the stem
 * closed with an arm-end corner, then up the stem's inner edge into E's own
 * middle arm and top. The original has no H; this one is two stems of B's
 * weight joined by a bar of E's middle arm's weight, its horizontals on the
 * same tilt as the rest of the word.
 */
const GLYPH: Record<GlyphName, string> = {
  F: "m365.8 422.3c-19.73 1.727-39.32 4.849-58.97 7.356-9.121 1.129-18.5 2.519-26.41 7.56-12.64 7.098-21.2 20.07-24.24 34.09-0.9372 6.707-0.1556 13.65-0.4318 20.45-0.174 46.59 0.0762 93.2-0.596 139.8-6.246 0.1185-12.76 3.338-15 9.491-0.8736 4.727-0.0398 9.858-0.276 14.74 0.2027 8.737-0.1766 17.55 0.7413 26.24 2.307 4.899 7.825 7.031 12.94 7.305 4.422-0.8033 3.933 2.739 3.771 5.992 0.3519 16.16-0.1292 32.36 0.8981 48.49 2.456 8.121 8.263 15.36 15.63 19.6 4.142 2.485 9.063 2.344 13.64 1.385l12.5-1.6c4.06-1.41 7.4-5.24 8.23-9.35l-2-71.8c3.018-4.347 8.845-3.133 13.34-4.191 11.6-1.684 23.27-3.066 34.75-5.428 4.355-1.955 7.15-6.368 8.502-10.72-0.3588-11.42 0.2612-22.9-0.7917-34.27-1.777-5.115-6.638-9.777-12.21-10.05-14.31 1.082-28.62 2.928-42.85 4.466-1.524-0.3207-0.2152-2.956-0.7402-3.991-0.232-38.55 0.0163-77.12 0.4546-115.7 0.5089-4.955-0.5158-10.54 2.032-15.03 3.011-3.947 7.539-6.764 12.63-6.698 14.43-1.553 29.03-1.817 43.37-4.073 6.916-2.248 12.08-8.588 13.74-15.48 0.0177-10.04 1.317-20.14 0.2696-30.15-1.259-5.534-7.538-8.471-12.79-8.365z",
  H: "M267 447.6Q267 438.6 275.9 437.5L302.1 434.2Q311 433.1 311 442.1L311 617.4Q311 621.4 315 620.9L359 615.6Q363 615.2 363 611.2L363 435.6Q363 426.6 371.9 425.5L398.1 422.2Q407 421.1 407 430.1L407 740.6Q407 749.6 398.1 750.7L371.9 754.1Q363 755.2 363 746.2L363 675.8Q363 671.8 359 672.4L315 678.5Q311 679.1 311 683.1L311 752.9Q311 761.9 302.1 763L275.9 766.4Q267 767.5 267 758.5z",
  S: "m180.2 452.4c-12.83 14.14-23.85 30.03-32.42 47.12-9.855 19.54-15.76 41.3-15.24 63.29 0.2581 19.02 4.073 38.24 12.65 55.31 4.936 10.3 13.01 19.12 15.9 30.35 2.212 10.43 0.8882 21.27-0.8568 31.67-5.541 28.76-18.61 55.51-34.06 80.19-2.153 3.587-4.791 7.026-6.699 10.68 11.33 7.074 22.85 13.97 34.44 20.54 13.96-17.54 26.35-36.31 37.65-55.66 11.57-20.06 22.45-41.08 26.64-64.08 3.204-17.15 3.671-34.87 1.153-52.14-1.896-12.63-8-24.1-15.2-34.47-7.914-11.11-14.78-23.4-17.03-37.02-3.405-20.84 0.2894-42.78 10.05-61.47 3.265-6.102 7.715-11.5 12.07-16.8-9.413-5.732-18.53-11.99-28.18-17.31-0.2774-0.1062-0.5762-0.2552-0.8818-0.2023z",
};

/**
 * Where each letter stands. The glyphs keep the trace's coordinates (E's, S's
 * at the second S); the offsets put the word where SEB'S was — the first F on
 * the first S's spot, the S on the second's — each letter's foot on the
 * baseline climbing at 9.5°.
 */
const WORD: { g: GlyphName; x: number; y: number }[] = [
  { g: "F", x: -120.2, y: 22.9 },
  { g: "H", x: 0, y: 0 },
  { g: "F", x: 175.3, y: -26.4 },
  { g: "S", x: 483, y: -80.5 },
];

const SEGS = ["ring", "bar", "note", "l0", "l1", "l2", "l3"] as const;
type SegName = (typeof SEGS)[number];
const LETTER_SEGS: SegName[] = ["l0", "l1", "l2", "l3"];

/**
 * The neon, made from a painted shape.
 *
 * Erode the shape by the tube's width and subtract: what is left is a band
 * of constant width hugging the outline — which is precisely what a neon
 * shop does with tube around lettering. The core is a thinner band eroded
 * from the same shape; the glow and the halo are that band blurred, the
 * halo dilated first so it carries. All four are merged back into one.
 */
function NeonFilter({
  id,
  x,
  y,
  width,
  height,
}: {
  id: string;
  x: string;
  y: string;
  width: string;
  height: string;
}) {
  return (
    <filter id={id} x={x} y={y} width={width} height={height} colorInterpolationFilters="sRGB">
      <feMorphology in="SourceAlpha" operator="erode" radius={TUBE} result="inner" />
      <feComposite in="SourceAlpha" in2="inner" operator="out" result="band" />
      <feMorphology in="SourceAlpha" operator="erode" radius={3.7} result="c1" />
      <feMorphology in="SourceAlpha" operator="erode" radius={8.9} result="c2" />
      <feComposite in="c1" in2="c2" operator="out" result="coreA" />

      <feMorphology in="band" operator="dilate" radius={10} result="wide" />
      <feFlood floodColor="#2b57ff" floodOpacity={0.6} />
      <feComposite in2="wide" operator="in" />
      <feGaussianBlur stdDeviation={13} result="halo" />

      <feMorphology in="band" operator="dilate" radius={3} result="near" />
      <feFlood floodColor="#3f78ff" floodOpacity={0.9} />
      <feComposite in2="near" operator="in" />
      <feGaussianBlur stdDeviation={4} result="glow" />

      <feFlood floodColor="#a9cbff" />
      <feComposite in2="band" operator="in" result="tube" />
      <feFlood floodColor="#f4f9ff" />
      <feComposite in2="coreA" operator="in" result="core" />

      <feMerge>
        <feMergeNode in="halo" />
        <feMergeNode in="glow" />
        <feMergeNode in="tube" />
        <feMergeNode in="core" />
      </feMerge>
    </filter>
  );
}

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

type Music = {
  controller: SpotifyController | null;
  ready: boolean;
  /** The bar wants music: lights are on. */
  wanted: boolean;
  playing: boolean;
  started: boolean;
  /** We paused it (lights off) — as opposed to the reader pressing pause. */
  ourPause: boolean;
  /** The reader pressed pause; leave it alone until the switch is flipped. */
  userPaused: boolean;
  /** A restart has been asked for and the position has not come back round yet. */
  restarting: boolean;
};

/** A flicker score: hold for `hold` seconds at brightness `v`, then the next step. */
type Step = [hold: number, v: number];

/**
 * Welcome to fhf's.
 *
 * The neon over the door of Seb's, re-lettered by hand. Nothing here is a
 * picture but the stills: the brick is painted once by a 2D canvas, and the
 * sign is painted shapes turned into tube by an SVG filter — erode, subtract,
 * blur — four layers merged back into one. Lighting up is a fixed score of
 * blinks, after which nothing is repainted. The sign is the bar's switch:
 * lights and music together. The music is Spotify's embed with its remote,
 * asked to play once the sign holds steady; if the browser refuses (the
 * reader has not touched the site yet), the first click or key tries again.
 */
export function NeonSignDemo({
  welcome,
  signOn,
  signOff,
  toggleHint,
  tonight,
  trackTitle,
  trackArtist,
  fallbackTrackArtist,
  fallbackHint,
  playerTitle,
  galleryKicker,
  galleryTitle,
  galleryLede,
  credit,
  stills,
}: Props) {
  const scope = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const wallRef = useRef<HTMLCanvasElement>(null);
  const spillRef = useRef<HTMLDivElement>(null);
  const welcomeRef = useRef<HTMLParagraphElement>(null);
  const switchRef = useRef<HTMLButtonElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const playerHostRef = useRef<HTMLDivElement>(null);

  const [powered, setPowered] = useState(false);
  const poweredRef = useRef(false);
  /** Spotify cannot be had (blocked, offline, or silent for too long): the stand-in player instead. */
  const [playerFallback, setPlayerFallback] = useState(false);
  /** The stand-in's URL while it is mounted — fixed per power cycle so a re-render never reloads it. */
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);
  /** The reader has clicked or typed somewhere: a browser will now allow sound. */
  const gesturedRef = useRef(false);
  /** Set by the choreography; the switch calls it. */
  const toggleRef = useRef<(() => void) | null>(null);
  const stutterRef = useRef<(() => void) | null>(null);

  const music = useRef<Music>({
    controller: null,
    ready: false,
    wanted: false,
    playing: false,
    started: false,
    ourPause: false,
    userPaused: false,
    restarting: false,
  });

  const requestPlay = () => {
    const m = music.current;
    m.wanted = true;
    if (!m.ready || !m.controller || m.playing || m.userPaused) return;
    if (m.started) m.controller.resume();
    else m.controller.play();
  };
  const requestPause = () => {
    const m = music.current;
    m.wanted = false;
    if (m.ready && m.controller && m.playing) {
      m.ourPause = true;
      m.controller.pause();
    }
  };

  /* ---- the wall ---- */
  useEffect(() => {
    const stage = stageRef.current;
    const wall = wallRef.current;
    const sign = switchRef.current;
    if (!stage || !wall || !sign) return;

    let frame = 0;
    const layout = () => {
      frame = 0;
      const r = stage.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      // The light on the bricks is centred on the sign, whatever the viewport
      // made of the layout.
      const s = sign.getBoundingClientRect();
      const sx = ((s.left + s.width / 2 - r.left) / r.width) * 100;
      const sy = ((s.top + s.height / 2 - r.top) / r.height) * 100;
      stage.style.setProperty("--nb-sx", `${sx.toFixed(2)}%`);
      stage.style.setProperty("--nb-sy", `${sy.toFixed(2)}%`);
      stage.style.setProperty("--nb-sr", `${(s.width * 0.72).toFixed(0)}px`);
      paintWall(wall, r.width, r.height);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(layout);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(stage);
    schedule();

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  /* ---- the music ---- */
  useEffect(() => {
    const host = playerHostRef.current;
    if (!host) return;
    let disposed = false;
    // Spotify took too long: the stand-in is up, and a late arrival is ignored.
    let gaveUp = false;
    const m = music.current;

    // The API replaces the element it is given, so it gets one of its own
    // inside the box React owns.
    const mount = document.createElement("div");
    host.replaceChildren(mount);

    // A blocked host usually fails fast; one that drops packets can hang the
    // script for a minute. Either way the box must not sit empty that long.
    const giveUp = () => {
      if (disposed || gaveUp || m.controller) return;
      gaveUp = true;
      setPlayerFallback(true);
    };
    const timer = window.setTimeout(giveUp, SPOTIFY_TIMEOUT);

    loadSpotifyApi().then(
      (api) => {
        window.clearTimeout(timer);
        if (disposed || gaveUp) return;
        api.createController(mount, { uri: TRACK_URI, width: "100%", height: PLAYER_HEIGHT }, (controller) => {
          if (disposed) {
            controller.destroy();
            return;
          }
          m.controller = controller;
          controller.addListener("ready", () => {
            m.ready = true;
            if (m.wanted) requestPlay();
          });
          controller.addListener("playback_update", (e) => {
            const d = e.data;
            const was = m.playing;
            m.playing = !d.isPaused;
            // The end of the track (or of the 30s preview) arrives as a
            // "playing" update parked on the last millisecond, never as a
            // pause — so the end is read off the position, and a beat early:
            // once the embed has reached its own end state it puts up its
            // upsell card and ignores a restart. Updates come about a second
            // apart, so 1.5s of headroom catches the last one before that.
            const ended = d.duration > 0 && d.position >= d.duration - 1500;
            if (ended) {
              m.playing = false;
              if (m.wanted && !m.userPaused && !m.restarting) {
                m.restarting = true;
                controller.restart();
              }
              return;
            }
            if (d.position < 1000) m.restarting = false;
            if (m.playing) {
              m.started = true;
              m.ourPause = false;
              m.userPaused = false;
              return;
            }
            if (!was) return;
            // Just stopped short of the end: our own switch, or the reader.
            if (!m.ourPause) m.userPaused = true;
          });
        });
      },
      () => {
        window.clearTimeout(timer);
        giveUp();
      }
    );

    // Browsers only let a page make sound once the reader has touched it.
    // If the first attempt was refused, the first click or key tries again.
    const onGesture = () => {
      gesturedRef.current = true;
      if (m.wanted && !m.playing && !m.userPaused) requestPlay();
    };
    document.addEventListener("pointerdown", onGesture, true);
    document.addEventListener("keydown", onGesture, true);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onGesture, true);
      document.removeEventListener("keydown", onGesture, true);
      m.controller?.destroy();
      m.controller = null;
      m.ready = false;
      host.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mounts once; requestPlay reads refs only
  }, []);

  // The stand-in follows the switch: mounted with the lights, gone without
  // them. Whether it may start by itself is decided once per power cycle —
  // the sign lit by the reader's scroll alone gets a player waiting for a
  // press of play; lit by a click, one that starts. A gesture arriving later
  // must not touch the URL, or the player would reload under a listener.
  useEffect(() => {
    if (!playerFallback) return;
    setFallbackSrc(powered ? neteaseSrc(gesturedRef.current) : null);
  }, [playerFallback, powered]);

  /* ---- the choreography ---- */
  useGSAP(
    (_ctx, contextSafe) => {
      const stage = stageRef.current;
      const svg = svgRef.current;
      const spill = spillRef.current;
      const welcomeEl = welcomeRef.current;
      const sign = switchRef.current;
      if (!stage || !svg || !spill || !welcomeEl || !sign || !contextSafe) return;

      const q = gsap.utils.selector(svg);
      const seg = (name: SegName) => q(`.nb-seg[data-seg="${name}"]`);
      const ring = seg("ring");
      const bar = seg("bar");
      const note = seg("note");
      const letters = LETTER_SEGS.map(seg);
      const everything = [ring, bar, note, ...letters, [spill]];

      /* The score. Times in seconds; each segment holds a brightness for a
         beat and moves to the next. A transformer warming up, roughly. */
      const main = gsap.timeline({ paused: true, onComplete: () => requestPlay() });
      for (const s of everything) main.set(s, { opacity: 0 }, 0);

      const RING_SCORE: Step[] = [
        [0.05, 1], [0.09, 0], [0.04, 1], [0.12, 0], [0.03, 0.55], [0.05, 0], [0.28, 1], [0.04, 0], [0.05, 1],
      ];
      score(main, ring, 0.55, RING_SCORE);
      // The bricks catch what the ring gives — same blinks, dimmer — then
      // brighten as the letters come on.
      score(main, [spill], 0.55, RING_SCORE.map(([hold, v]) => [hold, v * 0.5] as Step));
      main.to(spill, { opacity: 1, duration: 1.4, ease: "none" }, 1.3);

      score(main, bar, 0.95, [[0.04, 1], [0.06, 0], [0.3, 1], [0.03, 0], [0.05, 1]]);

      const LETTER_SCORES: Step[][] = [
        [[0.05, 1], [0.07, 0], [0.04, 1], [0.05, 0], [1, 1]],
        [[0.06, 0.4], [0.04, 0], [0.05, 1], [0.09, 0], [1, 1]],
        [[0.04, 1], [0.03, 0], [1, 1]],
        [[0.04, 1], [0.08, 0], [0.05, 0.5], [0.04, 1]],
      ];
      letters.forEach((l, i) => score(main, l, 1.1 + i * 0.2, LETTER_SCORES[i]));
      score(main, note, 1.95, [[0.05, 1], [0.06, 0], [0.05, 1]]);
      // Two late second thoughts, then it holds.
      score(main, letters[2], 2.3, [[0.03, 0], [0.04, 1]]);
      score(main, letters[1], 2.62, [[0.03, 0], [0.05, 1]]);

      const off = gsap.timeline({ paused: true });
      off.set(q(".nb-lit"), { opacity: 0.55 }, 0);
      off.set(q(".nb-lit"), { opacity: 0 }, 0.06);
      off.to(spill, { opacity: 0, duration: 0.3, ease: EASE.exit }, 0);

      let lit = false;
      const powerOn = () => {
        if (poweredRef.current) return;
        poweredRef.current = true;
        setPowered(true);
        off.pause(0);
        gsap.set(q(".nb-lit"), { opacity: 1 });
        if (!lit) {
          lit = true;
          gsap.fromTo(
            welcomeEl,
            { autoAlpha: 0, filter: "blur(6px)" },
            { autoAlpha: 1, filter: "blur(0px)", duration: 1.1, ease: EASE.default }
          );
        }
        // Flipping the switch is a decision: even a reader who paused the
        // player gets the music back with the lights.
        music.current.userPaused = false;
        music.current.wanted = true;
        main.restart();
      };
      const powerOff = () => {
        if (!poweredRef.current) return;
        poweredRef.current = false;
        setPowered(false);
        main.pause();
        off.restart();
        requestPause();
      };
      toggleRef.current = contextSafe(() => (poweredRef.current ? powerOff() : powerOn()));

      // One tube loses its nerve for a moment under the pointer.
      let stutter: gsap.core.Timeline | null = null;
      stutterRef.current = contextSafe(() => {
        if (!poweredRef.current || main.isActive() || stutter?.isActive() || !isFinePointer()) return;
        const i = Math.floor(Math.random() * letters.length);
        stutter = gsap.timeline();
        score(stutter, letters[i], 0, [[0.04, 0], [0.05, 1], [0.03, 0], [0.04, 0.6], [0.03, 1]]);
      });

      // Lights come on as the reader arrives, once.
      const trigger = ScrollTrigger.create({
        trigger: stage,
        start: "top 70%",
        once: true,
        onEnter: () => powerOn(),
      });

      // While the wall is the top of the frame, the island's paper scrim
      // would lie across the bricks like a strip of tape — the same call the
      // grove makes (approach.css.ts), stamped here for as long as it lasts.
      const immersed = ScrollTrigger.create({
        trigger: stage,
        start: "top 96px",
        end: "bottom 96px",
        onToggle: (self) => {
          if (self.isActive) document.body.dataset.neonImmersed = "1";
          else delete document.body.dataset.neonImmersed;
        },
      });

      // The sign hangs a little in front of the wall: it rides the pointer
      // more than the light it throws does.
      let onMove: ((e: PointerEvent) => void) | null = null;
      if (isFinePointer()) {
        const signX = gsap.quickTo(sign, "x", { duration: 0.7, ease: EASE.default });
        const signY = gsap.quickTo(sign, "y", { duration: 0.7, ease: EASE.default });
        const spillX = gsap.quickTo(spill, "x", { duration: 0.9, ease: EASE.default });
        const spillY = gsap.quickTo(spill, "y", { duration: 0.9, ease: EASE.default });
        onMove = (e) => {
          const r = stage.getBoundingClientRect();
          const nx = (e.clientX - r.left) / r.width - 0.5;
          const ny = (e.clientY - r.top) / Math.min(r.height, window.innerHeight) - 0.5;
          signX(nx * 16);
          signY(ny * 12);
          spillX(nx * 9);
          spillY(ny * 7);
        };
        stage.addEventListener("pointermove", onMove, { passive: true });
      }

      return () => {
        trigger.kill();
        immersed.kill();
        delete document.body.dataset.neonImmersed;
        main.kill();
        off.kill();
        stutter?.kill();
        toggleRef.current = null;
        stutterRef.current = null;
        if (onMove) stage.removeEventListener("pointermove", onMove);
        // The lights belong to this run: a re-run (dev's double mount, a
        // remount) starts dark again, or its trigger would find the switch
        // already thrown and never light the sign.
        poweredRef.current = false;
        setPowered(false);
        music.current.wanted = false;
      };
    },
    { scope }
  );

  return (
    <section ref={scope} className="nb">
      <style href="lab-neon-sign" precedence="medium">
        {CSS}
      </style>

      <div ref={stageRef} className="nb-stage">
        <canvas ref={wallRef} className="nb-wall" aria-hidden="true" />
        <div ref={spillRef} className="nb-spill" aria-hidden="true" />

        {/* The first screen: the door. */}
        <div className="nb-room">
          <div className="nb-body">
            <p ref={welcomeRef} className="nb-welcome">
              {welcome}
            </p>

            <button
              ref={switchRef}
              type="button"
              className="nb-switch"
              aria-pressed={powered}
              aria-label={powered ? signOff : signOn}
              onClick={() => toggleRef.current?.()}
              onPointerEnter={() => stutterRef.current?.()}
            >
              <svg ref={svgRef} className="nb-sign" viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
                <defs>
                  <NeonFilter id="nb-lit" x="-40%" y="-15%" width="180%" height="130%" />
                  <NeonFilter id="nb-lit-ring" x="-15%" y="-15%" width="130%" height="130%" />
                  <NeonFilter id="nb-lit-bar" x="-15%" y="-15%" width="130%" height="130%" />
                  <NeonFilter id="nb-lit-note" x="-40%" y="-20%" width="180%" height="140%" />
                  {/* The glass by daylight: the same band, unlit. */}
                  <filter id="nb-dark" x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
                    <feMorphology in="SourceAlpha" operator="erode" radius={TUBE} result="inner" />
                    <feComposite in="SourceAlpha" in2="inner" operator="out" result="band" />
                    <feFlood floodColor="#9caadc" floodOpacity={0.16} />
                    <feComposite in2="band" operator="in" />
                  </filter>

                  <path id="nb-sh-ring" d={ARC_L} fill="none" stroke="#000" strokeWidth={RING_TUBE} strokeLinecap="round" />
                  <path
                    id="nb-sh-bar"
                    d={ARC_R_BAR}
                    fill="none"
                    stroke="#000"
                    strokeWidth={RING_TUBE}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path id="nb-sh-note" d={NOTE_D} transform={NOTE_T} fill="#000" />
                  {WORD.map((l, i) => (
                    <path key={i} id={`nb-sh-l${i}`} d={GLYPH[l.g]} transform={`translate(${l.x} ${l.y})`} fill="#000" />
                  ))}
                </defs>

                {/* Unlit, always there. */}
                <g filter="url(#nb-dark)">
                  <use href="#nb-sh-ring" />
                  <use href="#nb-sh-bar" />
                  <use href="#nb-sh-note" />
                  {WORD.map((_, i) => (
                    <use key={i} href={`#nb-sh-l${i}`} />
                  ))}
                </g>

                {/* Lit, one segment at a time. */}
                <g className="nb-lit">
                  <g className="nb-seg" data-seg="ring" filter="url(#nb-lit-ring)">
                    <use href="#nb-sh-ring" />
                  </g>
                  <g className="nb-seg" data-seg="bar" filter="url(#nb-lit-bar)">
                    <use href="#nb-sh-bar" />
                  </g>
                  <g className="nb-seg" data-seg="note" filter="url(#nb-lit-note)">
                    <use href="#nb-sh-note" />
                  </g>
                  {WORD.map((_, i) => (
                    <g key={i} className="nb-seg" data-seg={`l${i}`} filter="url(#nb-lit)">
                      <use href={`#nb-sh-l${i}`} />
                    </g>
                  ))}
                </g>
              </svg>
            </button>

            <p className="nb-hint">{toggleHint}</p>
          </div>

          <div className="nb-foot">
            <p className="nb-kicker">{tonight}</p>
            <div className={playerFallback ? "nb-player is-alt" : "nb-player"}>
              {playerFallback ? (
                fallbackSrc && (
                  <iframe
                    className="nb-player-alt"
                    title={playerTitle}
                    src={fallbackSrc}
                    width="100%"
                    height={NETEASE_HEIGHT}
                    allow="autoplay; encrypted-media"
                  />
                )
              ) : (
                <div ref={playerHostRef} className="nb-player-host" aria-label={playerTitle} role="region" />
              )}
            </div>
            <p className="nb-track">
              <span className="nb-track-title">{trackTitle}</span>
              <span className="nb-track-artist">{playerFallback ? fallbackTrackArtist : trackArtist}</span>
            </p>
            {playerFallback && <p className="nb-player-note">{fallbackHint}</p>}
          </div>
        </div>

        {/* Further along the wall: the stills. */}
        <section className="nb-gallery" aria-labelledby="nb-gallery-title">
          <div className="nb-gallery-head">
            <p className="nb-kicker">{galleryKicker}</p>
            <h2 id="nb-gallery-title" className="nb-gallery-title">
              {galleryTitle}
            </h2>
            <p className="nb-gallery-lede">{galleryLede}</p>
          </div>
          <Reveal as="ul" className="nb-prints" stagger={0.08}>
            {stills.map((still) => (
              <li key={still.src} className={`nb-print nb-print-${still.span}`}>
                <figure className="nb-print-fig">
                  <div className="nb-print-frame">
                    <Image
                      src={still.src}
                      alt={still.alt}
                      width={still.width}
                      height={still.height}
                      sizes={
                        still.span === "one"
                          ? "(min-width: 900px) 30vw, (min-width: 560px) 46vw, 92vw"
                          : "(min-width: 900px) 62vw, 92vw"
                      }
                      className="nb-print-img"
                    />
                  </div>
                  <figcaption className="nb-print-cap">
                    <span className="nb-print-title">{still.title}</span>
                    <span className="nb-print-meta">{still.meta}</span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </Reveal>
          <p className="nb-credit">{credit}</p>
        </section>
      </div>
    </section>
  );
}

/** Writes a flicker score onto the timeline from `at`; returns when it ends. */
function score(tl: gsap.core.Timeline, targets: Element[], at: number, steps: Step[]): number {
  let t = at;
  for (const [hold, v] of steps) {
    tl.set(targets, { opacity: v }, t);
    t += hold;
  }
  return t;
}

/* ---- the bricks ---- */

/** Brick face and mortar, in CSS pixels. Wide bricks, as on the poster. */
const BRICK = { w: 106, h: 42, mortar: 7 };
/** Pixel budget for the wall: painted once, and the wall is two screens tall. */
const WALL_PIXELS = 6_500_000;

let noiseTile: HTMLCanvasElement | null = null;

/** A small tile of grey noise, made once and repeated over the wall. */
function noise(): HTMLCanvasElement {
  if (noiseTile) return noiseTile;
  const size = 160;
  const tile = document.createElement("canvas");
  tile.width = tile.height = size;
  const ctx = tile.getContext("2d");
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const data = img.data;
    let seed = 91;
    for (let i = 0; i < data.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const v = seed >>> 24;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  noiseTile = tile;
  return tile;
}

/**
 * Paints the wall: rows of bricks, every other row shifted half a brick,
 * each brick its own dark blue-grey, lit along its top edge and shadowed
 * under its bottom, grain over the lot and the corners falling into dark.
 * Deterministic — the same wall every visit — and painted once per resize.
 */
function paintWall(canvas: HTMLCanvasElement, w: number, h: number) {
  const budget = Math.sqrt(WALL_PIXELS / (w * h));
  const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.max(1, budget));
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Mortar under everything.
  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, w, h);

  const pitchX = BRICK.w + BRICK.mortar;
  const pitchY = BRICK.h + BRICK.mortar;
  const rows = Math.ceil(h / pitchY) + 1;
  const cols = Math.ceil(w / pitchX) + 2;
  let seed = 2016;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let r = 0; r < rows; r++) {
    const y = r * pitchY;
    const shift = r % 2 ? pitchX / 2 : 0;
    for (let c = -1; c < cols; c++) {
      const x = c * pitchX + shift;
      const hue = 226 + rnd() * 16 - 8;
      const sat = 12 + rnd() * 10;
      const light = 12 + rnd() * 6;
      ctx.fillStyle = `hsl(${hue.toFixed(0)} ${sat.toFixed(0)}% ${light.toFixed(1)}%)`;
      ctx.beginPath();
      ctx.roundRect(x, y, BRICK.w, BRICK.h, 2);
      ctx.fill();
      // A hairline of light along the top edge, a shadow under the bottom.
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(x + 1, y, BRICK.w - 2, 1.5);
      ctx.fillStyle = "rgba(0,0,0,0.38)";
      ctx.fillRect(x + 1, y + BRICK.h - 2.5, BRICK.w - 2, 2.5);
      // Now and then a brick that was fired darker.
      if (rnd() < 0.08) {
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(x, y, BRICK.w, BRICK.h);
      }
    }
  }

  const grain = ctx.createPattern(noise(), "repeat");
  if (grain) {
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  // The first screen falls away into the night at its corners; further
  // down the wall it simply stays dim.
  const first = Math.min(h, window.innerHeight || h);
  const vignette = ctx.createRadialGradient(
    w / 2, first * 0.42, Math.min(w, first) * 0.12,
    w / 2, first * 0.42, Math.max(w, first) * 0.72
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(0.5, "rgba(0,0,0,0.42)");
  vignette.addColorStop(1, "rgba(0,0,0,0.9)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, first);
  if (h > first) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, first, w, h - first);
  }
}

const CSS = `
.nb { color: #f3f1ea; }

/* The header's paper scrim, off while the bricks are the top of the frame. */
body[data-neon-immersed] .hd-scrim { opacity: 0; }

.nb-stage {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border-block: 1px solid var(--line);
  /* Until the canvas paints: mortar and a plain course of bricks. */
  background-color: #14151d;
  background-image:
    linear-gradient(#0a0a0f 7px, transparent 7px),
    linear-gradient(90deg, #0a0a0f 7px, transparent 7px);
  background-size: 100% 49px, 113px 49px;
}

.nb-wall {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: block;
  width: 100%;
  height: 100%;
}

/* The blue the sign throws on the bricks. Screen over the wall, opacity
   driven by the score — a static layer once the sign holds. */
.nb-spill {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  mix-blend-mode: screen;
  opacity: 0;
  background:
    radial-gradient(
      circle var(--nb-sr, 340px) at var(--nb-sx, 50%) var(--nb-sy, 44%),
      rgba(76, 124, 255, 0.82) 0%,
      rgba(48, 90, 240, 0.42) 36%,
      rgba(24, 48, 170, 0.12) 68%,
      rgba(0, 0, 0, 0) 100%
    );
}

/* The door: one screen. */
.nb-room {
  position: relative;
  z-index: 2;
  min-height: 100svh;
  display: grid;
  grid-template-rows: 1fr auto;
}

.nb-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(0.5rem, 1.6vh, 1rem);
  padding: clamp(3.5rem, 8vh, 5rem) 1.5rem 0.25rem;
}

/* The channel letters over the sign: warm, lit from inside, a little haze. */
.nb-welcome {
  margin: 0;
  padding-left: 0.34em;
  font-family: var(--font-stack-serif);
  font-size: clamp(1.05rem, 2.6vw, 1.7rem);
  font-weight: 400;
  letter-spacing: 0.34em;
  text-transform: uppercase;
  color: #f6eedf;
  text-shadow:
    0 0 10px rgba(255, 236, 210, 0.55),
    0 0 30px rgba(255, 222, 184, 0.25);
}

.nb-switch {
  appearance: none;
  display: block;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  border-radius: 50%;
  line-height: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  will-change: transform;
}
.nb-switch:focus-visible {
  outline: 2px solid rgba(180, 200, 255, 0.85);
  outline-offset: 14px;
}
.nb-switch:active { transform: none; }

.nb-sign {
  display: block;
  /* Sized so that on a laptop the welcome, the sign and the player share one
     screen; the room simply grows when they cannot. */
  width: min(50vh, 82vw, 520px);
  aspect-ratio: 1;
  height: auto;
  overflow: visible;
}
.nb-lit .nb-seg { opacity: 0; }

.nb-hint {
  margin: 0.25rem 0 0;
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(243, 241, 234, 0.42);
}

.nb-foot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem clamp(1.25rem, 3.5vh, 2.25rem);
}
.nb-kicker {
  margin: 0;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(243, 241, 234, 0.55);
}
.nb-player {
  width: min(100%, 456px);
  min-height: ${PLAYER_HEIGHT}px;
  border-radius: 12px;
  background: #121216;
  box-shadow: 0 14px 44px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}
.nb-player-host {
  display: block;
  width: 100%;
  min-height: ${PLAYER_HEIGHT}px;
  border: 0;
}
.nb-player-host iframe {
  display: block;
  width: 100%;
  height: ${PLAYER_HEIGHT}px;
  border: 0;
  border-radius: 12px;
}
/* The stand-in: a shorter, light-themed player, centred in the same box and
   inverted to sit on the dark wall. Empty while the lights are off. */
.nb-player.is-alt {
  display: flex;
  align-items: center;
}
.nb-player-alt {
  display: block;
  width: 100%;
  height: ${NETEASE_HEIGHT}px;
  border: 0;
  filter: invert(0.9) hue-rotate(180deg);
}
.nb-player-note {
  margin: -0.25rem 0 0;
  max-width: 46ch;
  text-align: center;
  font-size: 0.75rem;
  line-height: 1.6;
  color: rgba(243, 241, 234, 0.5);
}
.nb-track {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem 0.75rem;
  text-align: center;
  font-size: 0.875rem;
  line-height: 1.5;
}
.nb-track-title { color: rgba(243, 241, 234, 0.88); }
.nb-track-artist { color: rgba(243, 241, 234, 0.5); }

/* ---- the stills, further along the wall ---- */
.nb-gallery {
  position: relative;
  z-index: 2;
  max-width: 1180px;
  margin: 0 auto;
  padding: clamp(3rem, 8vh, 5.5rem) clamp(1.25rem, 4vw, 3rem) clamp(3rem, 7vh, 4.5rem);
}
.nb-gallery-head { max-width: 46ch; }
.nb-gallery-title {
  margin: 0.6rem 0 0;
  font-size: clamp(1.5rem, 3.2vw, 2.25rem);
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.15;
  color: #f6f2e8;
}
.nb-gallery-title:lang(zh) { letter-spacing: 0.01em; }
.nb-gallery-lede {
  margin: 0.8rem 0 0;
  font-size: 0.9375rem;
  line-height: 1.7;
  color: rgba(243, 241, 234, 0.66);
}

.nb-prints {
  list-style: none;
  margin: clamp(1.75rem, 4vh, 2.75rem) 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: clamp(1rem, 2.4vw, 1.75rem);
}
.nb-print { grid-column: span 2; min-width: 0; }
.nb-print-wide { grid-column: span 4; }
.nb-print-full { grid-column: span 6; }

.nb-print-fig { margin: 0; }
/* Framed prints: a black mat, a hairline rim, and the sign's blue on the
   top edge as if it were lighting them. */
.nb-print-frame {
  padding: 0.5rem;
  border-radius: 4px;
  background: #0b0b10;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 30px 60px rgba(0, 0, 0, 0.6),
    0 2px 6px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(140, 170, 255, 0.28);
  transition: transform 0.4s cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow 0.4s;
}
.nb-print-img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 2px;
  filter: saturate(0.94) brightness(0.92);
  transition: filter 0.4s;
}
.nb-print-full .nb-print-img { aspect-ratio: 21 / 9; }
/* Beside the wide print, an upright crop stands as tall as it. */
.nb-print-tall .nb-print-img { aspect-ratio: 5 / 6; object-position: 82% 45%; }
@media (hover: hover) and (pointer: fine) {
  .nb-print-fig:hover .nb-print-frame {
    transform: translateY(-4px);
    box-shadow:
      0 36px 70px rgba(0, 0, 0, 0.65),
      0 2px 6px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(140, 170, 255, 0.4);
  }
  .nb-print-fig:hover .nb-print-img { filter: saturate(1) brightness(1); }
}

.nb-print-cap {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.75rem;
  margin: 0.8rem 0.25rem 0;
}
.nb-print-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: rgba(246, 242, 232, 0.92);
}
.nb-print-meta {
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(243, 241, 234, 0.48);
}

.nb-credit {
  margin: clamp(1.75rem, 4vh, 2.5rem) 0 0;
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.08em;
  line-height: 1.7;
  color: rgba(243, 241, 234, 0.4);
}

@media (max-width: 899px) {
  .nb-prints { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .nb-print { grid-column: span 1; }
  .nb-print-wide,
  .nb-print-full { grid-column: span 2; }
}
@media (max-width: 899px) {
  .nb-print-tall .nb-print-img { aspect-ratio: 16 / 9; }
}
@media (max-width: 559px) {
  .nb-prints { grid-template-columns: minmax(0, 1fr); }
  .nb-print,
  .nb-print-wide,
  .nb-print-full { grid-column: span 1; }
  .nb-print-full .nb-print-img { aspect-ratio: 16 / 9; }
}
`;
