"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";
import { Flip } from "gsap/Flip";

// Flip is not part of the shared registry in @/lib/gsap — register locally.
gsap.registerPlugin(Flip);
// Referenced so bundlers keep the plugin; registration lives in @/lib/gsap.
void ScrollTrigger;

/* ------------------------------------------------------------------ */
/* Procedural mini posters                                             */
/* ------------------------------------------------------------------ */

const POSTER_W = 288;
const POSTER_H = 384;
const POSTER_SCALE = 2; // retina crop-proof: draw at 2x, display at ~1x
const POSTER_COUNT = 9;

/**
 * Poster palette is INTENTIONALLY fixed dark and does not follow the site
 * theme — same rationale as the portfolio PosterLightbox: these are night
 * prints pinned to a wall, they stay night prints during the matinee.
 */
const INKS = [
  { field: "#e8b44f", accent: "#ff4d6d" }, // gold field, red accent
  { field: "#ff4d6d", accent: "#4cc9f0" }, // red field, blue accent
  { field: "#4cc9f0", accent: "#e8b44f" }, // blue field, gold accent
];

const SHOWS = [
  { word: "MIDNIGHT SET", date: "FRI · DEC 05 · 1AM SET" },
  { word: "BLUE ROOM", date: "SAT · JAN 17 · DOORS 11PM" },
  { word: "CITY OF STARS", date: "THU · FEB 26 · TWO SETS" },
  { word: "LAST CALL", date: "SUN · MAR 08 · TIL CLOSE" },
  { word: "ON TOUR", date: "1990 ⟶ 2026 · SIX STOPS" },
  { word: "PLANETARIUM", date: "WED · APR 15 · LIGHTS OUT" },
  { word: "AUDITION", date: "MON · MAY 04 · CALLBACK" },
  { word: "AFTER HOURS", date: "SAT · JUN 20 · LATE DOOR" },
  { word: "EPILOGUE", date: "SUN · JUL 05 · FINAL SET" },
];

/** Draw one 288x384 (at 2x) screen-print show poster, return a dataURL. */
function makePosterDataUrl(seed: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = POSTER_W * POSTER_SCALE;
  canvas.height = POSTER_H * POSTER_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.scale(POSTER_SCALE, POSTER_SCALE);

  const ink = INKS[seed % INKS.length];
  const show = SHOWS[seed % SHOWS.length];
  const W = POSTER_W;
  const H = POSTER_H;

  // Deep night ground.
  ctx.fillStyle = "#0e1020";
  ctx.fillRect(0, 0, W, H);

  // Large colour field — placement rotates with the seed so each sheet
  // reads as its own print run.
  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = ink.field;
  if (seed % 4 === 0) {
    ctx.beginPath();
    ctx.arc(W * 0.64, H * 0.3, W * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (seed % 4 === 1) {
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.32);
    ctx.fillRect(-W, -H * 0.16, W * 2, H * 0.32);
    ctx.rotate(0.32);
    ctx.translate(-W / 2, -H / 2);
  } else if (seed % 4 === 2) {
    ctx.fillRect(0, H * 0.54, W, H * 0.46);
  } else {
    ctx.beginPath();
    ctx.arc(W * 0.28, H * 0.66, W * 0.46, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Accent stripe / half moon, slightly off-register like a cheap print.
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = ink.accent;
  if (seed % 2 === 0) {
    ctx.fillRect(W * 0.08, H * 0.08, W * 0.03, H * 0.48);
  } else {
    ctx.beginPath();
    ctx.arc(W * 0.8, H * 0.76, W * 0.15, Math.PI * 0.5, Math.PI * 1.5);
    ctx.fill();
  }
  ctx.restore();

  // Headliner: giant FHF'S — vertical stack on every third sheet.
  ctx.fillStyle = "#f5efe2";
  ctx.textBaseline = "middle";
  if (seed % 3 === 0) {
    ctx.textAlign = "center";
    ctx.font = `900 ${Math.floor(H * 0.14)}px Georgia, "Times New Roman", serif`;
    ["F", "H", "F", "'S"].forEach((ch, i) => {
      ctx.fillText(ch, W * 0.26, H * (0.18 + i * 0.165));
    });
  } else {
    ctx.textAlign = "left";
    ctx.font = `900 ${Math.floor(W * 0.23)}px Georgia, "Times New Roman", serif`;
    ctx.fillText("FHF'S", W * 0.07, H * 0.22);
  }

  // Show word — dark copy then light copy 2px off, screen-print offset.
  ctx.textAlign = "left";
  const wordSize = show.word.length > 11 ? W * 0.062 : W * 0.075;
  ctx.font = `700 ${Math.floor(wordSize)}px Georgia, serif`;
  const wordY = seed % 3 === 0 ? H * 0.79 : H * 0.72;
  ctx.fillStyle = "#0e1020";
  ctx.fillText(show.word, W * 0.09, wordY);
  ctx.fillStyle = "#f5efe2";
  ctx.fillText(show.word, W * 0.09 - 2, wordY - 2);

  // Mono metadata block.
  ctx.font = `400 ${Math.floor(W * 0.036)}px "Courier New", monospace`;
  ctx.fillStyle = "rgba(245, 239, 226, 0.85)";
  ctx.fillText("LIVE · AFTER HOURS", W * 0.09, H * 0.87);
  ctx.fillText(show.date, W * 0.09, H * 0.906);
  ctx.textAlign = "right";
  ctx.fillText(`NO.${String(seed + 1).padStart(2, "0")}`, W * 0.91, H * 0.906);

  // Halftone-ish grain: sparse random dots, two tones.
  for (let i = 0; i < 700; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.fillStyle =
      Math.random() > 0.5 ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.08)";
    ctx.fillRect(x, y, 1.4, 1.4);
  }

  // Vignette so the sheet sits back into the wall.
  const vg = ctx.createRadialGradient(
    W / 2,
    H / 2,
    H * 0.3,
    W / 2,
    H / 2,
    H * 0.75
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // Hairline frame inside the sheet.
  ctx.strokeStyle = "rgba(245,239,226,0.28)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(W * 0.045, H * 0.035, W * 0.91, H * 0.93);

  // JPEG: the noisy dark print compresses far better than PNG here.
  return canvas.toDataURL("image/jpeg", 0.92);
}

/* ------------------------------------------------------------------ */
/* Layout constants                                                    */
/* ------------------------------------------------------------------ */

/** Scattered pose per poster: left/top in % of the (invisible) grid box,
 * rotation in deg, z stacking so overlaps read as hand-pinned sheets. */
const SCATTER = [
  { l: -62, t: -8, r: -9, z: 3 },
  { l: 18, t: -12, r: 6, z: 2 },
  { l: 98, t: -6, r: 12, z: 4 },
  { l: -55, t: 30, r: 7, z: 5 },
  { l: 28, t: 26, r: -12, z: 1 },
  { l: 108, t: 34, r: -5, z: 3 },
  { l: -48, t: 64, r: 11, z: 2 },
  { l: 22, t: 62, r: -7, z: 4 },
  { l: 96, t: 60, r: 4, z: 5 },
] as const;

/** Die-cut sticker tilt per poster — constant, so SSR and client agree. */
const STICKER_ROT = [-8, 5, -4, 10, -11, 3, 7, -6, 9] as const;

const DIM_FILTER = "brightness(0.45) saturate(0.6)";
const LIT_FILTER = "brightness(1) saturate(1)";

type Props = {
  kicker: string;
  heading: string;
  switchLabel: string;
  hint: string;
};

/**
 * "TRACK 04½ · THE WALL" — a brick wall of nine procedural show posters.
 *
 * Scroll story (GSAP Flip + ScrollTrigger scrub): the sheets start scattered
 * and hand-pinned, and as the section pins, scrubbing tidies them into a
 * 3x3 grid (Flip.to a captured grid state, simple:true; rotation rides a
 * child wrapper so Flip only ever measures unrotated boxes). Once the wall
 * is tidy a mains switch appears: pull it and the posters light up in
 * batches of three — a stagger of brightness/saturate recovery plus a
 * screen-blended warm glow and a box-shadow halo layer (both animated via
 * opacity, never by animating box-shadow itself).
 *
 * A single SVG def block holds nine feSpecularLighting/fePointLight filters
 * (one per frame — filter coords are element-local, so they can't share
 * one light). pointermove is rAF-throttled, rects are cached and only
 * re-read after resize/scroll/scrub invalidate them, and the listener only
 * exists while the section is on screen. Safari + coarse pointers skip the
 * SVG lighting entirely and fall back to a plain box-shadow hover.
 *
 * Reduced motion: no pin, no Flip — the grid is the server-rendered
 * default, every sheet starts lit, and the switch still works (instant).
 */
export function PosterWall({ kicker, heading, switchLabel, hint }: Props) {
  const container = useRef<HTMLElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);

  const onRef = useRef(on);
  const touchedRef = useRef(false); // has the user ever pulled the switch?
  const toggleRef = useRef<() => void>(() => {});

  // Generate the nine prints once on the client. State-driven so the imgs
  // simply appear on first paint after mount; Flip measures the CSS boxes,
  // not the image content, so timing is safe.
  useEffect(() => {
    setUrls(Array.from({ length: POSTER_COUNT }, (_, i) => makePosterDataUrl(i)));
  }, []);

  useGSAP(
    (_, contextSafe) => {
      const section = container.current;
      const wrapper = wrapperRef.current;
      if (!section || !wrapper || !contextSafe) return;

      const q = gsap.utils.selector(section);
      const board = q<HTMLDivElement>(".wall-board")[0];
      const posters = q<HTMLDivElement>(".wall-poster");
      const tilts = q<HTMLDivElement>(".wall-tilt");
      const frames = q<HTMLDivElement>(".wall-frame");
      const glows = q<HTMLDivElement>(".wall-glow");
      const halos = q<HTMLDivElement>(".wall-halo");
      if (!board || posters.length !== POSTER_COUNT) return;

      const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");

      /* ---- lamp state (shared by both motion modes) ----------------- */

      let lightTl: gsap.core.Timeline | null = null;

      const applyInstant = (lit: boolean) => {
        lightTl?.kill();
        lightTl = null;
        gsap.set(posters, { filter: lit ? LIT_FILTER : DIM_FILTER });
        gsap.set([...glows, ...halos], { opacity: lit ? 1 : 0 });
      };

      const animateLights = (lit: boolean) => {
        lightTl?.kill();
        const tl = gsap.timeline();
        if (lit) {
          // Random order, three sheets per "clack" — the mains bus energizes
          // one breaker row at a time (each ≈0.12s inside a beat, beats of 3,
          // from a shuffled order — the stagger {each, from:'random'} recipe
          // laid out by hand so all three layers share one order).
          const order = gsap.utils.shuffle(
            Array.from({ length: POSTER_COUNT }, (_, i) => i)
          );
          order.forEach((idx, k) => {
            const t = Math.floor(k / 3) * 0.24 + (k % 3) * 0.04;
            tl.to(
              posters[idx],
              {
                keyframes: [
                  {
                    filter: "brightness(1.35) saturate(1.1)",
                    duration: 0.08,
                    ease: "power2.in",
                  },
                  { filter: LIT_FILTER, duration: 0.2, ease: "power2.out" },
                ],
              },
              t
            );
            tl.to(glows[idx], { opacity: 1, duration: 0.3, ease: "power2.out" }, t);
            tl.to(halos[idx], { opacity: 1, duration: 0.45, ease: "power2.out" }, t);
          });
        } else {
          // Cutting the mains is one thunk, not a show: quick ragged fade.
          tl.to(posters, {
            filter: DIM_FILTER,
            duration: 0.25,
            ease: "power1.out",
            stagger: { each: 0.03, from: "random" },
          });
          tl.to([...glows, ...halos], { opacity: 0, duration: 0.2 }, 0);
        }
        lightTl = tl;
      };

      toggleRef.current = contextSafe(() => {
        const next = !onRef.current;
        onRef.current = next;
        touchedRef.current = true;
        setOn(next);
        if (reduceMq.matches) applyInstant(next);
        else animateLights(next);
      });

      /* ---- fePointLight sheen (capable pointers only) --------------- */

      const isSafari = /^((?!chrome|android).)*safari/i.test(
        navigator.userAgent
      );
      const finePointer = window.matchMedia("(pointer: fine)").matches;
      const specOn = !isSafari && finePointer && !reduceMq.matches;
      section.dataset.spec = specOn ? "on" : "off";

      let removeSpec: (() => void) | null = null;
      if (specOn) {
        const lights = Array.from(
          section.querySelectorAll<SVGElement>("fePointLight")
        );
        const speculars = Array.from(
          section.querySelectorAll<SVGElement>("feSpecularLighting")
        );

        // lighting-color can't take var(): read --gold and set the attr,
        // re-read whenever the theme flips.
        const syncGold = () => {
          const gold = getComputedStyle(section)
            .getPropertyValue("--gold")
            .trim();
          speculars.forEach((s) => s.setAttribute("lighting-color", gold));
        };
        syncGold();
        const onTheme = () => requestAnimationFrame(syncGold);
        window.addEventListener("fhfs:theme", onTheme);

        // gsap.set so a context revert clears the filter reference too.
        frames.forEach((f, i) => gsap.set(f, { filter: `url(#wall-spec-${i})` }));

        // Rect cache: read only when invalidated (resize/scroll/scrub),
        // never per pointer frame.
        let rects: DOMRect[] | null = null;
        const invalidate = () => {
          rects = null;
        };
        window.addEventListener("resize", invalidate);
        window.addEventListener("scroll", invalidate, { passive: true });
        section.addEventListener("wall:invalidate", invalidate);

        let raf = 0;
        let px = 0;
        let py = 0;
        const applyLight = () => {
          raf = 0;
          if (!rects) rects = frames.map((f) => f.getBoundingClientRect());
          for (let i = 0; i < lights.length; i++) {
            const r = rects[i];
            lights[i].setAttribute("x", String(px - r.left));
            lights[i].setAttribute("y", String(py - r.top));
          }
        };
        const onMove = (e: PointerEvent) => {
          px = e.clientX;
          py = e.clientY;
          if (!raf) raf = requestAnimationFrame(applyLight);
        };

        // Listen only while the section is actually on screen.
        const io = new IntersectionObserver(([entry]) => {
          if (entry?.isIntersecting) {
            section.addEventListener("pointermove", onMove, { passive: true });
          } else {
            section.removeEventListener("pointermove", onMove);
            if (raf) cancelAnimationFrame(raf);
            raf = 0;
          }
        });
        io.observe(section);

        removeSpec = () => {
          io.disconnect();
          section.removeEventListener("pointermove", onMove);
          section.removeEventListener("wall:invalidate", invalidate);
          window.removeEventListener("resize", invalidate);
          window.removeEventListener("scroll", invalidate);
          window.removeEventListener("fhfs:theme", onTheme);
          if (raf) cancelAnimationFrame(raf);
        };
      }

      /* ---- the Flip act, rebuilt from scratch on width changes ------- */

      let ctx: gsap.Context | null = null;
      let armed = false;

      const arm = contextSafe(() => {
        if (armed) return;
        armed = true;
        setReady(true);
      });

      const build = () => {
        ctx = gsap.context(() => {
          if (reduceMq.matches) {
            // Reduced motion: tidy grid (server default), everything lit
            // unless the visitor already chose darkness, switch shown.
            if (!touchedRef.current) onRef.current = true;
            setOn(onRef.current);
            applyInstant(onRef.current);
            arm();
            return;
          }

          // Night wall starts dark (unless a rebuild happens mid-session
          // with the mains already pulled).
          applyInstant(onRef.current);

          // 1. Capture the tidy grid the server rendered…
          const state = Flip.getState(posters);
          // 2. …scatter the sheets (class swap: absolute + CSS-var poses)…
          board.classList.add("is-scattered");
          gsap.set(tilts, { rotation: (i: number) => SCATTER[i].r });
          // 3. …and let Flip tween back to the captured grid, driven by
          //    scroll. simple:true is safe because rotation lives on the
          //    child .wall-tilt, so Flip only measures unrotated boxes.
          const flip = Flip.to(state, {
            simple: true,
            ease: "none",
            duration: 1,
            stagger: 0.03,
          });
          const master = gsap.timeline({ paused: true });
          master.add(flip, 0);
          master.to(
            tilts,
            { rotation: 0, ease: "none", duration: 1, stagger: 0.03 },
            0
          );

          ScrollTrigger.create({
            animation: master,
            trigger: wrapper,
            start: "top top",
            end: "+=120%",
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              // Scrub moves the frames — the sheen's rect cache is stale.
              section.dispatchEvent(new Event("wall:invalidate"));
              if (self.progress > 0.95) arm();
            },
          });
        }, section);
      };
      build();

      // Rebuild (revert + re-measure) on real width changes — Flip states
      // are snapshots, invalidateOnRefresh alone can't re-measure them.
      // Height-only changes (mobile URL bar) are ignored.
      let lastW = window.innerWidth;
      let resizeT = 0;
      const onResize = () => {
        if (window.innerWidth === lastW) return;
        lastW = window.innerWidth;
        window.clearTimeout(resizeT);
        resizeT = window.setTimeout(() => {
          ctx?.revert();
          board.classList.remove("is-scattered");
          build();
        }, 200);
      };
      window.addEventListener("resize", onResize);
      // A live preference flip mid-session also warrants a rebuild.
      const onReduceChange = () => onResize();
      reduceMq.addEventListener?.("change", onReduceChange);

      return () => {
        window.removeEventListener("resize", onResize);
        reduceMq.removeEventListener?.("change", onReduceChange);
        window.clearTimeout(resizeT);
        removeSpec?.();
        lightTl?.kill();
        ctx?.revert();
        board.classList.remove("is-scattered");
      };
    },
    { scope: container }
  );

  return (
    <section ref={container} data-act="wall" aria-label={heading}>
      {/* Component-private styles — tokens only, no hard-coded theme hex. */}
      <style>{`
        .wall-stage {
          --wall-mortar: color-mix(in srgb, var(--fg) 5%, transparent);
          --wall-joint: color-mix(in srgb, var(--fg) 2%, transparent);
          background-color: color-mix(in srgb, var(--bg) 94%, var(--gold) 6%);
          /* Brick courses: strong-ish horizontal mortar lines, and two very
             faint vertical joint rhythms offset from each other so the wall
             doesn't read as graph paper. */
          background-image:
            repeating-linear-gradient(
              0deg,
              transparent 0 46px,
              var(--wall-mortar) 46px 48px
            ),
            repeating-linear-gradient(
              90deg,
              transparent 0 118px,
              var(--wall-joint) 118px 120px
            );
        }
        .wall-board {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: clamp(10px, 1.4vw, 16px);
          width: min(78vw, 50svh);
          margin-inline: auto;
        }
        .wall-poster {
          position: relative;
          aspect-ratio: 3 / 4;
          will-change: transform;
        }
        /* Scattered pose: hand-pinned sheets, absolute inside the (now
           invisible) grid box. Applied by JS only — no-JS and reduced
           motion keep the tidy grid. */
        .wall-board.is-scattered {
          display: block;
          position: relative;
          height: calc(min(78vw, 50svh) * 4 / 3);
        }
        .wall-board.is-scattered .wall-poster {
          position: absolute;
          left: var(--sl);
          top: var(--st);
          width: clamp(110px, 13vw, 190px);
          z-index: var(--sz);
        }
        .wall-tilt {
          position: absolute;
          inset: 0;
        }
        .wall-halo {
          position: absolute;
          inset: 0;
          border-radius: 6px;
          opacity: 0;
          pointer-events: none;
          box-shadow:
            0 0 18px color-mix(in srgb, var(--gold) 38%, transparent),
            0 0 46px color-mix(in srgb, var(--gold) 20%, transparent);
        }
        .wall-print {
          position: absolute;
          inset: 0;
          border-radius: 6px;
          overflow: hidden;
          background: color-mix(in srgb, var(--bg) 70%, black);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
        }
        .wall-print img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .wall-glow {
          position: absolute;
          inset: 0;
          opacity: 0;
          pointer-events: none;
          mix-blend-mode: screen;
          background: radial-gradient(
            120% 90% at 50% 12%,
            color-mix(in srgb, var(--gold) 55%, transparent),
            transparent 65%
          );
        }
        .wall-frame {
          position: absolute;
          inset: 0;
          border-radius: 6px;
          border: 2px solid color-mix(in srgb, var(--fg) 62%, transparent);
          pointer-events: none;
        }
        /* Safari / touch fallback: no SVG lighting, a plain hover sheen. */
        [data-spec="off"] .wall-poster:hover .wall-frame {
          box-shadow: 0 0 14px color-mix(in srgb, var(--gold) 45%, transparent);
        }
        .wall-sticker {
          position: absolute;
          top: -10px;
          left: -10px;
          z-index: 3;
          display: grid;
          place-items: center;
          min-width: 34px;
          padding: 4px 7px;
          border-radius: 8px;
          transform: rotate(var(--str));
          background: #f5efe2;
          color: #16182c;
          border: 2px solid #ffffff;
          filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35));
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
        }
        /* Matinee: the die-cut edge matches the daylight paper. */
        :root[data-theme="light"] .wall-sticker {
          border-color: var(--bg);
        }
        .wall-console {
          opacity: 0;
          transform: translateY(10px);
          pointer-events: none;
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .wall-console.is-ready {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }
        @media (prefers-reduced-motion: reduce) {
          .wall-console {
            transition: none;
          }
        }
        .wall-lever {
          position: relative;
          width: 26px;
          height: 52px;
          border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--gold) 55%, transparent);
          background: color-mix(in srgb, var(--surface) 80%, transparent);
        }
        .wall-knob {
          position: absolute;
          left: 50%;
          top: 6px;
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: var(--muted-fg);
          transform: translate(-50%, 24px);
          transition: transform 0.25s ease, background-color 0.25s ease,
            box-shadow 0.25s ease;
        }
        .wall-switch[aria-pressed="true"] .wall-knob {
          transform: translate(-50%, 0);
          background: var(--gold);
          box-shadow: var(--glow-gold);
        }
        @media (prefers-reduced-motion: reduce) {
          .wall-knob {
            transition: none;
          }
        }
      `}</style>

      {/* Nine per-frame specular lighting filters — filter primitive coords
          are element-local, so each frame needs its own point light. */}
      <svg aria-hidden="true" className="absolute h-0 w-0">
        <defs>
          {Array.from({ length: POSTER_COUNT }, (_, i) => (
            <filter
              key={i}
              id={`wall-spec-${i}`}
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="soft" />
              <feSpecularLighting
                in="soft"
                result="spec"
                surfaceScale="2"
                specularConstant="2.4"
                specularExponent="18"
                lightingColor="#e8b44f"
              >
                <fePointLight x="-200" y="-200" z="150" />
              </feSpecularLighting>
              <feComposite in="spec" in2="SourceAlpha" operator="in" result="lit" />
              <feComposite
                in="SourceGraphic"
                in2="lit"
                operator="arithmetic"
                k1="0"
                k2="1"
                k3="1"
                k4="0"
              />
            </filter>
          ))}
        </defs>
      </svg>

      {/* Pin wrapper — no transform of its own, so pinning stays exact. */}
      <div ref={wrapperRef}>
        <div className="wall-stage relative flex min-h-svh items-center justify-center overflow-hidden">
          {/* Act header */}
          {/* top-24: clear of the site's fixed glass header while pinned */}
          <div className="pointer-events-none absolute left-6 top-24 z-10 md:left-10">
            <span className="track-kicker">{kicker}</span>
            <h2 className="mt-3 font-deco text-[clamp(30px,4.5vw,56px)] leading-none text-gold [text-shadow:var(--glow-gold)]">
              {heading}
            </h2>
          </div>

          {/* The nine sheets — server-rendered as the tidy grid (the
              accessible / no-JS / reduced-motion truth); JS scatters them
              and lets scroll tidy them back up. */}
          <div className="wall-board mt-14">
            {SCATTER.map((pose, i) => (
              <div
                key={i}
                className="wall-poster"
                style={
                  {
                    "--sl": `${pose.l}%`,
                    "--st": `${pose.t}%`,
                    "--sz": pose.z,
                    "--str": `${STICKER_ROT[i]}deg`,
                  } as CSSProperties
                }
              >
                <div className="wall-tilt">
                  <div className="wall-halo" />
                  <div className="wall-print">
                    {urls[i] ? (
                      // eslint-disable-next-line @next/next/no-img-element -- generated dataURL, not an asset
                      <img src={urls[i]} alt="" draggable={false} />
                    ) : null}
                    <div className="wall-glow" />
                  </div>
                  <div className="wall-frame" />
                  <span className="wall-sticker" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Mains switch — appears once the wall is tidy. */}
          <div
            className={`wall-console absolute bottom-8 right-6 z-10 flex items-center gap-4 md:right-10 ${
              ready ? "is-ready" : ""
            }`}
          >
            <p className="max-w-[24ch] text-right font-mono text-[10px] leading-relaxed tracking-[0.2em] text-muted-fg">
              {hint}
            </p>
            <button
              type="button"
              className="wall-switch flex flex-col items-center gap-2"
              aria-pressed={on}
              onClick={() => toggleRef.current()}
            >
              <span className="wall-lever">
                <span className="wall-knob" />
              </span>
              <span className="font-mono text-[10px] tracking-[0.3em] text-gold">
                {switchLabel}
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
