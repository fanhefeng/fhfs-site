"use client";

import { useRef } from "react";
import type { CSSProperties, JSX } from "react";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";

// Referenced so bundlers keep the plugin; registration lives in @/lib/gsap.
void ScrollTrigger;

export type ClubWindowProps = {
  kicker: string;
  titleLines: string[];
  lede: string;
  insideTitle: string;
  insideBody: string;
  readoutLabel: string;
};

/* Window geometry — one source of truth for the hole, the frame and the
 * glare, since all three must scale as a single piece of glass. */
/* Sized off the short edge so the window keeps its portrait proportions, but
 * with a vw floor: on a phone 34vmin is barely wider than the headline, and
 * the copy ends up covering the whole window instead of sitting on the wall. */
const WINDOW_W = "min(max(34vmin, 58vw), 340px)";
const WINDOW_H = "min(max(46vmin, 78vw), 460px)";
const WINDOW_BOX: CSSProperties = {
  width: WINDOW_W,
  height: WINDOW_H,
  borderRadius: "3vmin",
};

/** WINDOW_W/H as px for the current viewport — same math as the CSS. */
const windowPx = () => {
  const vw = window.innerWidth;
  const vmin = Math.min(vw, window.innerHeight) / 100;
  return {
    w: Math.min(Math.max(34 * vmin, 0.58 * vw), 340),
    h: Math.min(Math.max(46 * vmin, 0.78 * vw), 460),
    r: 3 * vmin,
  };
};

/* All scene colours live in CSS variables scoped to .cw-scene (see the
 * <style> block in the JSX). Dark is the original night street; light
 * re-lights the same set as a closed club on a bright afternoon. */

/* Layer 1 — the club interior, seen from the street. Pure CSS, no images:
 * a warm spot on the stage, neon spill above it, a lit floor below. In
 * light mode the spot becomes a shaft of daylight slanting in through
 * the window (--cw-beam is fully transparent at night). */
const FAR_BACKGROUND = [
  "linear-gradient(114deg, transparent 34%, var(--cw-beam) 48%, transparent 66%)",
  "radial-gradient(46% 34% at 50% 44%, var(--cw-spot), transparent 72%)",
  "radial-gradient(70% 9% at 30% 20%, var(--cw-neon-pink), transparent 72%)",
  "radial-gradient(58% 8% at 72% 29%, var(--cw-neon-blue), transparent 74%)",
  "radial-gradient(50% 6% at 46% 12%, var(--cw-neon-pink-soft), transparent 70%)",
  "radial-gradient(130% 26% at 50% 101%, var(--cw-floor-glow), transparent 64%)",
  "linear-gradient(180deg, var(--cw-room-0) 0%, var(--cw-room-1) 32%, var(--cw-room-2) 60%, var(--cw-room-3) 86%, var(--cw-room-4) 100%)",
].join(", ");

/* Bokeh dust floating in the spotlight — a handful of dots, masked to the
 * middle band so they read as haze rather than as stars. By day the same
 * dots become dust motes drifting in the sunbeam. */
const BOKEH_BACKGROUND = [
  "radial-gradient(3px 3px at 34% 52%, var(--cw-dust-1), transparent)",
  "radial-gradient(2px 2px at 58% 44%, var(--cw-dust-2), transparent)",
  "radial-gradient(2px 2px at 46% 61%, var(--cw-dust-3), transparent)",
  "radial-gradient(3px 3px at 68% 57%, var(--cw-dust-4), transparent)",
  "radial-gradient(2px 2px at 24% 39%, var(--cw-dust-5), transparent)",
].join(", ");

/* Layer 2 — patrons at the bar. Head + shoulders, nothing more; at this
 * distance a silhouette is all the eye needs. */
const PATRONS = [
  { left: "14%", bottom: "19%", scale: 1 },
  { left: "31%", bottom: "21%", scale: 0.86 },
  { left: "62%", bottom: "18%", scale: 1.08 },
];

/**
 * "TRACK 01½ · WALK IN" — the camera push between the neon sign and the
 * notes deck. The viewer stands on the street looking through the club's
 * window; scrolling walks them through it.
 *
 * The trick is the window itself: the interior lives inside a view layer
 * clipped by an animated `inset()` that starts at the window rect, so
 * widening the clip is literally the camera passing through the glass —
 * the interior never moves into the window, the window opens onto it.
 * (The previous 60vmax-box-shadow "wall" flickered under reverse scrub:
 * Chrome dropped the giant shadow raster for a frame. Static wall paint +
 * compositor-friendly clip-path killed that for good.)
 *
 * Depth comes from three different speeds over the same scroll: the
 * interior creeps forward, the bar drifts aside, the window rushes out.
 */
export function ClubWindow({
  kicker,
  titleLines,
  lede,
  insideTitle,
  insideBody,
  readoutLabel,
}: ClubWindowProps): JSX.Element {
  const container = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(container);
      const stage = stageRef.current;
      const far = q<HTMLDivElement>(".cw-far")[0];
      const mid = q<HTMLDivElement>(".cw-mid")[0];
      const view = q<HTMLDivElement>(".cw-view")[0];
      const frame = q<HTMLDivElement>(".cw-frame")[0];
      const glare = q<HTMLDivElement>(".cw-glare")[0];
      const copyOut = q<HTMLDivElement>(".cw-copy-out")[0];
      const copyIn = q<HTMLDivElement>(".cw-copy-in")[0];
      const readout = q<HTMLDivElement>(".cw-readout")[0];
      const zoomEl = q<HTMLElement>(".cw-zoom")[0];
      const barEl = q<HTMLElement>(".cw-bar")[0];
      if (!stage || !far || !mid || !view || !frame || !glare) return;

      /* Camera state: s=1 is standing on the street, s=26 is inside. The
       * view's clip rect derives from s — pure math mirroring the CSS
       * formulas, re-measured on ScrollTrigger refresh, never per frame. */
      const cam = { s: 1 };
      let geo = { w: 0, h: 0, r: 0, sw: 0, sh: 0, ox: 0, oy: 0 };
      const measure = () => {
        const win = windowPx();
        const sw = stage.clientWidth;
        const sh = stage.clientHeight;
        geo = {
          w: win.w,
          h: win.h,
          r: win.r,
          sw,
          sh,
          ox: sw / 2,
          // The old hole scaled about 50% 46% — keep the camera drifting
          // toward the same point so the shot feels identical.
          oy: (sh - win.h) / 2 + win.h * 0.46,
        };
      };
      const applyClip = () => {
        const s = cam.s;
        const top = Math.max(0, geo.oy - geo.h * 0.46 * s);
        const bottom = Math.max(0, geo.sh - (geo.oy + geo.h * 0.54 * s));
        const left = Math.max(0, geo.ox - (geo.w / 2) * s);
        const right = Math.max(0, geo.sw - (geo.ox + (geo.w / 2) * s));
        view.style.clipPath = `inset(${top.toFixed(1)}px ${right.toFixed(1)}px ${bottom.toFixed(1)}px ${left.toFixed(1)}px round ${(geo.r * s).toFixed(1)}px)`;
      };
      if (!copyOut || !copyIn || !readout || !zoomEl || !barEl) return;

      const mm = gsap.matchMedia();

      // Reduced motion: no ScrollTrigger, no pin — jump straight to the end
      // state. The camera is already inside, so the window is blown past
      // (scale 26), the street-side copy is gone and the interior copy is
      // fully readable. Nothing but the choreography is lost.
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(frame, { scale: 26 });
        view.style.clipPath = "inset(0px round 0px)"; // camera already inside
        gsap.set([copyOut, glare], { opacity: 0 });
        gsap.set(copyIn, { opacity: 1, scale: 1, filter: "none" });
        // The readout only means anything while the camera is moving.
        gsap.set(readout, { autoAlpha: 0 });
        return () => {
          view.style.clipPath = ""; // back to the CSS street-view clip
        };
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Hidden via JS only, so a no-JS visitor still gets both blocks of
        // copy in the document rather than an empty screen.
        gsap.set(copyIn, { opacity: 0 });

        // Street-side copy rises out of its slice masks as the act arrives —
        // fires well before the pin engages at "top top".
        gsap.from(q(".cw-copy-out .split-inner"), {
          yPercent: 110,
          duration: 1,
          ease: "expo.out",
          stagger: 0.1,
          scrollTrigger: { trigger: stage, start: "top 72%", once: true },
        });

        // Writing scaleX through a quickSetter keeps the per-frame readout
        // off the property-parsing path. No layout reads in here.
        const setBar = gsap.quickSetter(barEl, "scaleX");

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: stage,
            start: "top top",
            end: "+=320%",
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            // Window geometry is pure math over the viewport size — refresh
            // it whenever ScrollTrigger re-measures the world, then re-apply
            // the clip at the current camera position.
            onRefresh: () => {
              measure();
              applyClip();
            },
            onUpdate: (self) => {
              const p = self.progress;
              // Exponential, so the readout matches the feel of the scale
              // curve instead of the linear scroll position.
              zoomEl.textContent = `${(1 + p * p * 25).toFixed(2)}×`;
              setBar(p);
            },
          },
        });

        measure();
        applyClip();

        tl
          // Copy leaves first — otherwise it fights the growing window
          // frame. It fades to 0.02, not 0: at exactly zero Chrome drops
          // the layer's raster (big glyphs + a 40px text-shadow), and
          // rebuilding it when reverse scrolling re-crosses this boundary
          // cost a visible one-frame flash.
          .to(copyOut, { yPercent: -16, opacity: 0.02, duration: 0.22 }, 0)
          // Three speeds over one scroll = depth.
          .to(far, { scale: 1.42, yPercent: -5, duration: 1 }, 0)
          .to(mid, { yPercent: -16, xPercent: -8, opacity: 0.35, duration: 1 }, 0)
          // power2.in so the camera accelerates through the glass rather
          // than swelling at a constant rate. The frame is a real element
          // scaling up; the room reveal is the clip widening in lockstep.
          .to(frame, { scale: 26, ease: "power2.in", duration: 0.78 }, 0.04)
          .to(
            cam,
            { s: 26, ease: "power2.in", duration: 0.78, onUpdate: applyClip },
            0.04
          )
          .to(glare, { scale: 26, opacity: 0, ease: "power2.in", duration: 0.6 }, 0.04)
          // Now inside: the second block pushes in from depth of field.
          .fromTo(
            copyIn,
            { opacity: 0, scale: 0.86, filter: "blur(7px)" },
            {
              opacity: 1,
              scale: 1,
              filter: "blur(0px)",
              duration: 0.26,
              ease: "power2.out",
            },
            0.72
          );

        return () => {
          view.style.clipPath = ""; // hand back to the CSS street-view clip
        };
      });
    },
    { scope: container }
  );

  return (
    <section ref={container} data-act="door" className="cw-scene relative">
      {/* Scene palette. Dark = the original night street; light = walking
          past the club on a bright afternoon — the room inside is closed,
          one shade darker than the sunlit wall, all warm paper-and-wood.
          Scoped here on purpose: globals.css stays untouched. */}
      <style>{`
        .cw-scene {
          --cw-wall: #07080e;
          --cw-room-0: #07080e;
          --cw-room-1: #0f0f23;
          --cw-room-2: #14142b;
          --cw-room-3: #1a1a2e;
          --cw-room-4: #23233a;
          --cw-spot: rgba(232, 180, 79, 0.28);
          --cw-beam: rgba(255, 244, 214, 0);
          --cw-neon-pink: rgba(255, 77, 109, 0.18);
          --cw-neon-blue: rgba(76, 201, 240, 0.16);
          --cw-neon-pink-soft: rgba(255, 77, 109, 0.12);
          --cw-floor-glow: rgba(232, 180, 79, 0.26);
          --cw-dust-1: rgba(232, 180, 79, 0.5);
          --cw-dust-2: rgba(245, 240, 232, 0.35);
          --cw-dust-3: rgba(232, 180, 79, 0.4);
          --cw-dust-4: rgba(255, 77, 109, 0.3);
          --cw-dust-5: rgba(76, 201, 240, 0.3);
          --cw-bar-top: #1a1a2e;
          --cw-bar-bottom: #0c0e18;
          --cw-figure: #0c0e18;
          --cw-figure-glow: 0 0 26px rgba(232, 180, 79, 0.1);
          --cw-cord: #1a1a2e;
          --cw-lamp: rgba(232, 180, 79, 0.8);
          --cw-lamp-glow: 0 0 18px 5px rgba(232, 180, 79, 0.35);
          --cw-frame-ring: rgba(232, 180, 79, 0.18);
          --cw-frame-shade: rgba(0, 0, 0, 0.4);
          --cw-frame-lowlight: rgba(232, 180, 79, 0.1);
          --cw-glare-hi: rgba(255, 255, 255, 0.16);
          --cw-glare-lo: rgba(255, 255, 255, 0.05);
          --cw-copy-shadow: 0 4px 40px rgba(0, 0, 0, 0.65);
        }
        [data-theme="light"] .cw-scene {
          --cw-wall: #e3dbc8;
          --cw-room-0: #d9cdb2;
          --cw-room-1: #d3c5a8;
          --cw-room-2: #c7b797;
          --cw-room-3: #baa886;
          --cw-room-4: #ac9975;
          --cw-spot: rgba(255, 244, 214, 0.22);
          --cw-beam: rgba(255, 244, 214, 0.4);
          --cw-neon-pink: rgba(255, 77, 109, 0.07);
          --cw-neon-blue: rgba(76, 201, 240, 0.06);
          --cw-neon-pink-soft: rgba(255, 77, 109, 0.05);
          --cw-floor-glow: rgba(255, 244, 214, 0.24);
          --cw-dust-1: rgba(255, 250, 235, 0.55);
          --cw-dust-2: rgba(255, 255, 255, 0.5);
          --cw-dust-3: rgba(255, 248, 226, 0.45);
          --cw-dust-4: rgba(255, 77, 109, 0.08);
          --cw-dust-5: rgba(76, 201, 240, 0.08);
          --cw-bar-top: #82725c;
          --cw-bar-bottom: #6d5f4e;
          --cw-figure: #6d5f4e;
          --cw-figure-glow: none;
          --cw-cord: #7c6d59;
          --cw-lamp: rgba(166, 132, 78, 0.25);
          --cw-lamp-glow: none;
          --cw-frame-ring: rgba(140, 110, 58, 0.38);
          --cw-frame-shade: rgba(76, 62, 44, 0.16);
          --cw-frame-lowlight: rgba(255, 244, 214, 0.42);
          --cw-glare-hi: rgba(255, 255, 255, 0.34);
          --cw-glare-lo: rgba(255, 255, 255, 0.1);
          --cw-copy-shadow: none;
        }
      `}</style>
      <div
        ref={stageRef}
        className="relative h-svh overflow-hidden [perspective:1200px]"
        style={{
          perspectiveOrigin: "50% 46%",
          // The stage itself IS the bulkhead. The interior below is clipped
          // to the window, so everything outside it shows this wall colour.
          background: "var(--cw-wall)",
        }}
      >
        {/* ---- The camera's view into the room ----
            The old trick — a hole element painting the wall with a 60vmax
            box-shadow — flickered under reverse scrubbing: Chrome would
            drop the giant shadow raster for a frame and the wall vanished.
            Clipping the interior with an animated inset() instead keeps the
            wall as cheap static paint and puts the "camera through the
            window" on a compositor-friendly property. The initial clip is
            expressed in CSS so no-JS visitors still get the street view. */}
        {/* No will-change here: promoting the view forced a layer whose
            raster kept dropping a frame under reverse scrub (the whole room
            blacked out). Unpromoted, the animated clip-path is applied at
            paint time — cheaper in practice because the children (far/mid)
            already sit on their own composited layers. */}
        <div
          aria-hidden="true"
          className="cw-view absolute inset-0 z-[2]"
          style={{
            clipPath: `inset(calc(50% - (${WINDOW_H}) / 2) calc(50% - (${WINDOW_W}) / 2) calc(50% - (${WINDOW_H}) / 2) calc(50% - (${WINDOW_W}) / 2) round 3vmin)`,
          }}
        >
        {/* ---- Layer 1: the club interior, far away ---- */}
        <div
          aria-hidden="true"
          className="cw-far absolute -inset-[8%] will-change-transform"
          style={{ background: FAR_BACKGROUND }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: BOKEH_BACKGROUND,
              maskImage:
                "linear-gradient(transparent 22%, #000 44%, #000 66%, transparent 84%)",
            }}
          />
        </div>

        {/* ---- Layer 2: the bar, the patrons, the pendant lamp ---- */}
        <div
          aria-hidden="true"
          className="cw-mid absolute inset-0 [will-change:transform,opacity]"
        >
          {/* Bar counter — one slanted slab reading as a receding surface */}
          <div
            className="absolute inset-x-0 bottom-[4%] h-[28%]"
            style={{
              background:
                "linear-gradient(180deg, var(--cw-bar-top), var(--cw-bar-bottom) 62%)",
              clipPath: "polygon(0 36%, 100% 17%, 100% 100%, 0 100%)",
            }}
          />
          {/* Brass lip catching the stage light */}
          <div
            className="absolute inset-x-0 bottom-[27.5%] h-px -rotate-[2.1deg] bg-gold/25"
          />

          {PATRONS.map((p) => (
            <div
              key={p.left}
              className="absolute"
              style={{
                left: p.left,
                bottom: p.bottom,
                transform: `scale(${p.scale})`,
                transformOrigin: "50% 100%",
              }}
            >
              <span
                className="mx-auto block h-[3.2vmin] w-[3.2vmin] rounded-full"
                style={{ background: "var(--cw-figure)" }}
              />
              <span
                className="mt-[0.5vmin] block h-[9vmin] w-[8vmin]"
                style={{
                  background: "var(--cw-figure)",
                  borderRadius: "46% 46% 10% 10% / 62% 62% 8% 8%",
                  boxShadow: "var(--cw-figure-glow)",
                }}
              />
            </div>
          ))}

          {/* Pendant lamp over the far end of the bar — lit at night,
              switched off (dull brass) after closing time */}
          <div
            className="absolute left-[78%] top-0 h-[30%] w-px"
            style={{ background: "var(--cw-cord)" }}
          />
          <div
            className="absolute left-[78%] top-[30%] h-[1.4vmin] w-[1.4vmin] -translate-x-1/2 rounded-full"
            style={{
              background: "var(--cw-lamp)",
              boxShadow: "var(--cw-lamp-glow)",
            }}
          />
        </div>
        </div>

        {/* ---- Layer 3: the window frame riding the camera ---- */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[3] grid place-items-center"
        >
          <div className="relative" style={WINDOW_BOX}>
            {/* Matte gold inner rim of the window frame */}
            <div
              className="cw-frame absolute inset-0 z-[1] will-change-transform"
              style={{
                borderRadius: WINDOW_BOX.borderRadius,
                boxShadow:
                  "inset 0 0 0 1.5px var(--cw-frame-ring), inset 0 16px 32px var(--cw-frame-shade), inset 0 -12px 28px var(--cw-frame-lowlight)",
                transformOrigin: "50% 46%",
              }}
            />
            {/* Diagonal reflection on the glass, wiped away on the way through */}
            <div
              className="cw-glare absolute inset-0 z-[2] overflow-hidden will-change-transform"
              style={{
                borderRadius: WINDOW_BOX.borderRadius,
                transformOrigin: "50% 46%",
              }}
            >
              <div
                className="absolute -inset-[30%]"
                style={{
                  background:
                    "linear-gradient(112deg, transparent 34%, var(--cw-glare-hi) 46%, var(--cw-glare-lo) 53%, transparent 62%)",
                }}
              />
            </div>
          </div>
        </div>

        {/* ---- Layer 4a: street-side copy, printed on the bulkhead ---- */}
        <div className="cw-copy-out pointer-events-none absolute left-1/2 top-1/2 z-[6] w-[min(88vw,780px)] -translate-x-1/2 -translate-y-1/2 text-center [will-change:transform,opacity]">
          <p className="split-line">
            <span className="split-inner track-kicker">{kicker}</span>
          </p>
          <h2 className="mt-5 font-deco text-[clamp(2rem,7vw,5rem)] leading-[1.02] tracking-[-0.01em] text-fg [text-shadow:var(--cw-copy-shadow)]">
            {titleLines.map((line, i) => (
              <span key={i} className="split-line">
                <span className="split-inner">{line}</span>
              </span>
            ))}
          </h2>
          <p className="mt-6 text-sm leading-loose text-muted-fg">{lede}</p>
        </div>

        {/* ---- Layer 4b: inside the club, once the glass is behind us ---- */}
        <div className="cw-copy-in pointer-events-none absolute left-1/2 top-1/2 z-[6] w-[min(90vw,900px)] -translate-x-1/2 -translate-y-1/2 text-center [will-change:transform,opacity,filter]">
          <h3 className="font-deco text-[clamp(1.5rem,5.2vw,3.6rem)] leading-[1.15] text-gold [text-shadow:var(--glow-gold)]">
            {insideTitle}
          </h3>
          <p className="mx-auto mt-6 max-w-[56ch] text-[15px] leading-[1.9] text-muted-fg">
            {insideBody}
          </p>
        </div>

        {/* ---- Camera readout ---- */}
        <div
          aria-hidden="true"
          className="cw-readout pointer-events-none absolute bottom-6 right-6 z-20 text-right font-mono text-[11px] leading-[1.9] tabular-nums text-muted-fg"
        >
          {readoutLabel} <b className="cw-zoom font-normal text-gold">1.00×</b>
          <span className="mt-1.5 block h-[3px] w-[120px] overflow-hidden bg-line">
            <i className="cw-bar block h-full w-full origin-left scale-x-0 bg-gold" />
          </span>
        </div>
      </div>
    </section>
  );
}
