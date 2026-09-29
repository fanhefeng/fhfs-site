"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useGSAP, ScrollTrigger } from "@/lib/client/gsap";
import { Reveal } from "@/components/fx/Reveal";
import { jukebox, useJukebox } from "@/lib/client/jukebox";
import { NeonSignArt } from "@/components/neon/NeonSignArt";
import { useBrickWall, wireNeonSign } from "@/components/neon/sign";
import { WALL_CSS } from "@/components/neon/wall";
import type { StillSpan } from "@/lib/films";

/** A print on the wall — the La La Land room's still, with its caption translated. */
export type NeonStillItem = {
  src: string;
  width: number;
  height: number;
  span: StillSpan;
  /** `object-position` for a print cropped away from its frame. */
  focus?: string;
  alt: string;
  title: string;
  meta: string;
};

type Props = {
  welcome: string;
  /** The switch's one name. It is a toggle: `aria-pressed` says whether the
   *  sign is lit, so a label that flipped too was read as "switch the sign
   *  off, pressed". */
  signOn: string;
  galleryKicker: string;
  galleryTitle: string;
  galleryLede: string;
  /** The stills' rights line — the film room's, so the two never disagree. */
  stillsCredit: string;
  /** The sign's own: whose tracing the lettering follows. */
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
 * background music, played by the jukebox behind every page (`lib/client/jukebox`),
 * so there is no player under the sign, and nothing written under it either:
 * the sign is the whole first screen.
 */
export function NeonSignDemo({
  welcome,
  signOn,
  galleryKicker,
  galleryTitle,
  galleryLede,
  stillsCredit,
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
  const { wanted } = useJukebox();
  /** Set by the choreography; the switch calls it. */
  const toggleRef = useRef<(() => void) | null>(null);
  const followRef = useRef<((on: boolean) => void) | null>(null);
  const stutterRef = useRef<(() => void) | null>(null);

  /* ---- the wall ---- */
  useBrickWall(stageRef, wallRef, switchRef);

  // The sign follows the jukebox as much as the jukebox follows the sign: the
  // note on the island can stop the music from up there, and the sign must
  // not stay lit over a silent bar. (A reader arriving with the music already
  // on finds the sign lit, as they should.)
  //
  // Compared against the live store, not the `wanted` this render saw: the
  // scroll trigger below lights the sign from a layout effect, before this
  // effect runs, and on that first pass the rendered value is still the old
  // one — acting on it switched the sign straight back off.
  //
  // Only the light follows: the music already changed, and the switch's own
  // path would write back — turning a record that failed to load into the
  // reader's "no".
  useEffect(() => {
    const now = jukebox().wanted;
    if (now !== poweredRef.current) followRef.current?.(now);
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

      const neon = wireNeonSign({
        svg,
        spill,
        sign,
        stage,
        welcome: [welcomeEl],
        poweredRef,
        setPowered,
        // The wall is a section of the page, its first screen the door.
        pointer: (e) => {
          const r = stage.getBoundingClientRect();
          return {
            nx: (e.clientX - r.left) / r.width - 0.5,
            ny: (e.clientY - r.top) / Math.min(r.height, window.innerHeight) - 0.5,
          };
        },
      });
      toggleRef.current = contextSafe(neon.toggle);
      followRef.current = contextSafe(neon.follow);
      stutterRef.current = contextSafe(neon.stutter);

      // Lights come on as the reader arrives, once — unless the reader has
      // switched the music off: the sign is the music's switch, and walking up
      // to it is not a change of mind (`silenced`, lib/client/jukebox). It
      // stays dark, one press from lit.
      const trigger = ScrollTrigger.create({
        trigger: stage,
        start: "top 70%",
        once: true,
        onEnter: () => {
          if (!jukebox().silenced) neon.powerOn();
        },
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

      return () => {
        trigger.kill();
        immersed.kill();
        delete document.body.dataset.neonImmersed;
        neon.kill();
        toggleRef.current = null;
        followRef.current = null;
        stutterRef.current = null;
        // The lights belong to this run: a re-run (dev's double mount, a
        // remount) starts dark again, or its trigger would find the switch
        // already thrown and never light the sign.
        poweredRef.current = false;
        setPowered(false);
      };
    },
    { scope },
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
              aria-label={signOn}
              onClick={() => toggleRef.current?.()}
              onPointerEnter={() => stutterRef.current?.()}
            >
              <NeonSignArt id="nb" svgRef={svgRef} className="nb-sign" />
            </button>
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
                      sizes={PRINT_SIZES[still.span]}
                      className="nb-print-img"
                      style={still.focus ? { objectPosition: still.focus } : undefined}
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
          <p className="nb-credit">{stillsCredit}</p>
          <p className="nb-credit">{credit}</p>
        </section>
      </div>
    </section>
  );
}

/**
 * What each print is drawn at, by the grid below: six columns from 900px in a
 * wall that stops at 1180px (less its padding), two from 560px, one under
 * that. `tall` stands in two columns like `one` — the height is the crop's,
 * not the column's — and `full` takes the row.
 */
const PRINT_SIZES: Record<StillSpan, string> = {
  one: "(min-width: 1180px) 360px, (min-width: 900px) 31vw, (min-width: 560px) 46vw, 92vw",
  tall: "(min-width: 1180px) 360px, (min-width: 900px) 31vw, (min-width: 560px) 46vw, 92vw",
  wide: "(min-width: 1180px) 740px, (min-width: 900px) 63vw, 92vw",
  full: "(min-width: 1180px) 1120px, 94vw",
};

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
}

.nb-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(0.5rem, 1.6vh, 1rem);
  padding: clamp(3.5rem, 8vh, 5rem) 1.5rem clamp(2rem, 6vh, 4rem);
}

/* The channel letters over the sign: warm, lit from inside, a little haze.
   Dark until the sign comes on — the server's copy used to paint lit, then
   blink out when the trigger fired on load and fade back in. */
.nb-welcome {
  margin: 0;
  opacity: 0;
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
  /* Sized so that on a laptop the welcome and the sign share one screen;
     the room simply grows when they cannot. */
  width: min(56vh, 82vw, 560px);
  aspect-ratio: 1;
  height: auto;
  overflow: visible;
}

.nb-kicker {
  margin: 0;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(243, 241, 234, 0.55);
}

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
