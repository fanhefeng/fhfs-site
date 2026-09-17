"use client";

import type { Ref } from "react";
import {
  ARC_L,
  ARC_R_BAR,
  GLYPH,
  LETTER_SEGS,
  NOTE_D,
  NOTE_T,
  RING_TUBE,
  TUBE,
  VIEW_BOX,
  WORD,
  type SegName,
} from "./geometry";

/* ------------------------------------------------------------------ */
/* The sign: the drawing lives in ./geometry (plain data, so the mark   */
/* can also be painted on the server); this file is the neon — the      */
/* filters, the art and the scores. Shared by the lab study             */
/* (/lab/neon), the front door (NeonSplash) and the note on the island  */
/* (JukeboxSwitch): one drawing, one filter. The geometry is re-exported */
/* so those keep one import.                                            */
/* ------------------------------------------------------------------ */

export * from "./geometry";

/**
 * The neon, made from a painted shape.
 *
 * Erode the shape by the tube's width and subtract: what is left is a band
 * of constant width hugging the outline — which is precisely what a neon
 * shop does with tube around lettering. The core is a thinner band eroded
 * from the same shape; the glow and the halo are that band blurred, the
 * halo dilated first so it carries. All four are merged back into one.
 */
export function NeonFilter({
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

/** The glass by daylight: the same band, unlit. */
function DarkGlassFilter({ id }: { id: string }) {
  return (
    <filter id={id} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
      <feMorphology in="SourceAlpha" operator="erode" radius={TUBE} result="inner" />
      <feComposite in="SourceAlpha" in2="inner" operator="out" result="band" />
      <feFlood floodColor="#9caadc" floodOpacity={0.16} />
      <feComposite in2="band" operator="in" />
    </filter>
  );
}

/** The one rule the art needs: every lit segment starts dark. */
const NEON_ART_CSS = `.neon-lit .neon-seg { opacity: 0; }`;

type ArtProps = {
  /** Prefix for every id inside — the same sign may hang twice on a page. */
  id: string;
  svgRef?: Ref<SVGSVGElement>;
  className?: string;
};

/**
 * The whole sign: the unlit glass always there, and over it the lit tube one
 * segment at a time (`.neon-seg[data-seg]`), each segment its own filter
 * instance so the flicker only ever touches an opacity.
 */
export function NeonSignArt({ id, svgRef, className }: ArtProps) {
  const sh = (name: string) => `${id}-sh-${name}`;
  return (
    <svg ref={svgRef} className={className} viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      <style href="neon-sign-art" precedence="medium">
        {NEON_ART_CSS}
      </style>
      <defs>
        <NeonFilter id={`${id}-lit`} x="-40%" y="-15%" width="180%" height="130%" />
        <NeonFilter id={`${id}-lit-ring`} x="-15%" y="-15%" width="130%" height="130%" />
        <NeonFilter id={`${id}-lit-bar`} x="-15%" y="-15%" width="130%" height="130%" />
        <NeonFilter id={`${id}-lit-note`} x="-40%" y="-20%" width="180%" height="140%" />
        <DarkGlassFilter id={`${id}-dark`} />

        <path id={sh("ring")} d={ARC_L} fill="none" stroke="#000" strokeWidth={RING_TUBE} strokeLinecap="round" />
        <path
          id={sh("bar")}
          d={ARC_R_BAR}
          fill="none"
          stroke="#000"
          strokeWidth={RING_TUBE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path id={sh("note")} d={NOTE_D} transform={NOTE_T} fill="#000" />
        {WORD.map((l, i) => (
          <path key={i} id={sh(`l${i}`)} d={GLYPH[l.g]} transform={`translate(${l.x} ${l.y})`} fill="#000" />
        ))}
      </defs>

      {/* Unlit, always there. */}
      <g filter={`url(#${id}-dark)`}>
        <use href={`#${sh("ring")}`} />
        <use href={`#${sh("bar")}`} />
        <use href={`#${sh("note")}`} />
        {WORD.map((_, i) => (
          <use key={i} href={`#${sh(`l${i}`)}`} />
        ))}
      </g>

      {/* Lit, one segment at a time. */}
      <g className="neon-lit">
        <g className="neon-seg" data-seg="ring" filter={`url(#${id}-lit-ring)`}>
          <use href={`#${sh("ring")}`} />
        </g>
        <g className="neon-seg" data-seg="bar" filter={`url(#${id}-lit-bar)`}>
          <use href={`#${sh("bar")}`} />
        </g>
        <g className="neon-seg" data-seg="note" filter={`url(#${id}-lit-note)`}>
          <use href={`#${sh("note")}`} />
        </g>
        {WORD.map((_, i) => (
          <g key={i} className="neon-seg" data-seg={`l${i}`} filter={`url(#${id}-lit)`}>
            <use href={`#${sh(`l${i}`)}`} />
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* The scores. Times in seconds; each segment holds a brightness for a  */
/* beat and moves to the next. A transformer warming up, roughly.       */
/* ------------------------------------------------------------------ */

/** A flicker score: hold for `hold` seconds at brightness `v`, then the next step. */
export type Step = [hold: number, v: number];

/** Writes a flicker score onto the timeline from `at`; returns when it ends. */
export function score(tl: gsap.core.Timeline, targets: Element[], at: number, steps: Step[]): number {
  let t = at;
  for (const [hold, v] of steps) {
    tl.set(targets, { opacity: v }, t);
    t += hold;
  }
  return t;
}

/** Picks a segment's elements out of a sign. */
export type SegPicker = (name: SegName) => Element[];

/**
 * Lighting up: the ring stutters first, the bar follows, the letters one at
 * a time with their own hesitations, the note last; two late second thoughts,
 * then it holds. The spill on the bricks catches what the ring gives — the
 * same blinks, dimmer — then brightens as the letters come on.
 */
export function writeLightScore(main: gsap.core.Timeline, seg: SegPicker, spill: Element[]): void {
  const ring = seg("ring");
  const bar = seg("bar");
  const note = seg("note");
  const letters = LETTER_SEGS.map(seg);
  for (const s of [ring, bar, note, ...letters, spill]) main.set(s, { opacity: 0 }, 0);

  const RING_SCORE: Step[] = [
    [0.05, 1], [0.09, 0], [0.04, 1], [0.12, 0], [0.03, 0.55], [0.05, 0], [0.28, 1], [0.04, 0], [0.05, 1],
  ];
  score(main, ring, 0.55, RING_SCORE);
  score(main, spill, 0.55, RING_SCORE.map(([hold, v]) => [hold, v * 0.5] as Step));
  main.to(spill, { opacity: 1, duration: 1.4, ease: "none" }, 1.3);

  score(main, bar, 0.95, [[0.04, 1], [0.06, 0], [0.3, 1], [0.03, 0], [0.05, 1]]);

  const LETTER_SCORES: Step[][] = [
    [[0.05, 1], [0.07, 0], [0.04, 1], [0.05, 0], [1, 1]],
    [[0.06, 0.4], [0.04, 0], [0.05, 1], [0.09, 0], [1, 1]],
    [[0.04, 1], [0.03, 0], [1, 1]],
    [[0.04, 1], [0.08, 0], [0.05, 0.5], [0.04, 1]],
  ];
  letters.forEach((l, i) => score(main, l, 1.1 + i * 0.2, LETTER_SCORES[i]!));
  score(main, note, 1.95, [[0.05, 1], [0.06, 0], [0.05, 1]]);
  score(main, letters[2]!, 2.3, [[0.03, 0], [0.04, 1]]);
  score(main, letters[1]!, 2.62, [[0.03, 0], [0.05, 1]]);
}

/** Switching off: one dim beat, then dark; the spill fades after it. */
export function writeOffScore(off: gsap.core.Timeline, lit: Element[], spill: Element[], exitEase: string): void {
  off.set(lit, { opacity: 0.55 }, 0);
  off.set(lit, { opacity: 0 }, 0.06);
  off.to(spill, { opacity: 0, duration: 0.3, ease: exitEase }, 0);
}

/** One tube loses its nerve for a moment. */
export const STUTTER: Step[] = [[0.04, 0], [0.05, 1], [0.03, 0], [0.04, 0.6], [0.03, 1]];
