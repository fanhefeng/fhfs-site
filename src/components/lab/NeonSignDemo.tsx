"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP, ScrollTrigger, EASE, isFinePointer } from "@/lib/gsap";
import { Reveal } from "@/components/fx/Reveal";
import { jukebox, stopMusic, useJukebox, wantMusic } from "@/lib/jukebox";
import {
  NeonSignArt,
  LETTER_SEGS,
  STUTTER,
  score,
  writeLightScore,
  writeOffScore,
  type SegName,
} from "@/components/neon/NeonSignArt";
import { layoutWall, WALL_CSS } from "@/components/neon/wall";
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
  /** The artist line when the stand-in recording is what plays. */
  fallbackTrackArtist: string;
  galleryKicker: string;
  galleryTitle: string;
  galleryLede: string;
  credit: string;
  stills: NeonStillItem[];
};

/**
 * Welcome to fhf's — the study.
 *
 * The neon over the door of Seb's, re-lettered by hand. Nothing here is a
 * picture but the stills: the brick is painted once by a 2D canvas, and the
 * sign is painted shapes turned into tube by an SVG filter — erode, subtract,
 * blur — four layers merged back into one (`components/neon`). Lighting up
 * is a fixed score of blinks, after which nothing is repainted. The sign is
 * the bar's switch: lights and music together — and the music is the site's
 * background music, played by the jukebox behind every page (`lib/jukebox`),
 * so there is no player under the sign, only the bill for tonight.
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

  const [powered, setPowered] = useState(false);
  const poweredRef = useRef(false);
  const { wanted, fallback } = useJukebox();
  /** Set by the choreography; the switch calls it. */
  const toggleRef = useRef<(() => void) | null>(null);
  const stutterRef = useRef<(() => void) | null>(null);

  /* ---- the wall ---- */
  useEffect(() => {
    const stage = stageRef.current;
    const wall = wallRef.current;
    const sign = switchRef.current;
    if (!stage || !wall || !sign) return;

    let frame = 0;
    const layout = () => {
      frame = 0;
      layoutWall(stage, wall, sign);
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

  // The sign follows the jukebox as much as the jukebox follows the sign: the
  // note on the island can stop the music from up there, and the sign must
  // not stay lit over a silent bar. (A reader arriving with the music already
  // on finds the sign lit, as they should.)
  //
  // Compared against the live store, not the `wanted` this render saw: the
  // scroll trigger below lights the sign from a layout effect, before this
  // effect runs, and on that first pass the rendered value is still the old
  // one — acting on it switched the sign straight back off.
  useEffect(() => {
    if (jukebox().wanted !== poweredRef.current) toggleRef.current?.();
  }, [wanted]);

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
      const seg = (name: SegName) => q(`.neon-seg[data-seg="${name}"]`);
      const letters = LETTER_SEGS.map(seg);
      const lit = q(".neon-lit");

      const main = gsap.timeline({ paused: true });
      writeLightScore(main, seg, [spill]);
      const off = gsap.timeline({ paused: true });
      writeOffScore(off, lit, [spill], EASE.exit);

      let welcomed = false;
      const powerOn = () => {
        if (poweredRef.current) return;
        poweredRef.current = true;
        setPowered(true);
        off.pause(0);
        gsap.set(lit, { opacity: 1 });
        if (!welcomed) {
          welcomed = true;
          gsap.fromTo(
            welcomeEl,
            { autoAlpha: 0, filter: "blur(6px)" },
            { autoAlpha: 1, filter: "blur(0px)", duration: 1.1, ease: EASE.default }
          );
        }
        wantMusic();
        main.restart();
      };
      const powerOff = () => {
        if (!poweredRef.current) return;
        poweredRef.current = false;
        setPowered(false);
        main.pause();
        off.restart();
        stopMusic();
      };
      toggleRef.current = contextSafe(() => (poweredRef.current ? powerOff() : powerOn()));

      // One tube loses its nerve for a moment under the pointer.
      let stutter: gsap.core.Timeline | null = null;
      stutterRef.current = contextSafe(() => {
        if (!poweredRef.current || main.isActive() || stutter?.isActive() || !isFinePointer()) return;
        const i = Math.floor(Math.random() * letters.length);
        stutter = gsap.timeline();
        score(stutter, letters[i], 0, STUTTER);
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
      };
    },
    { scope }
  );

  return (
    <section ref={scope} className="nb">
      <style href="lab-neon-sign" precedence="medium">
        {WALL_CSS + CSS}
      </style>

      <div ref={stageRef} className="nb-stage nb-study">
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
              <NeonSignArt id="nb" svgRef={svgRef} className="nb-sign" />
            </button>

            <p className="nb-hint">{toggleHint}</p>
          </div>

          <div className="nb-foot">
            <p className="nb-kicker">{tonight}</p>
            <p className="nb-track">
              <span className="nb-track-title">{trackTitle}</span>
              <span className="nb-track-artist">{fallback ? fallbackTrackArtist : trackArtist}</span>
            </p>
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

const CSS = `
.nb { color: #f3f1ea; }

/* The header's paper scrim, off while the bricks are the top of the frame. */
body[data-neon-immersed] .hd-scrim { opacity: 0; }

.nb-study { border-block: 1px solid var(--line); }

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
  /* Sized so that on a laptop the welcome, the sign and the bill share one
     screen; the room simply grows when they cannot. */
  width: min(56vh, 82vw, 560px);
  aspect-ratio: 1;
  height: auto;
  overflow: visible;
}

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
  gap: 0.5rem;
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
