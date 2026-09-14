import type { ReactNode } from "react";
import { ARC_L, ARC_R, NEON, RING_VIEW_BOX } from "./geometry";

/** Stroke widths in drawing units — the ring is 700 units across, so at the
 *  island's 36px one unit is about a twentieth of a pixel. */
const TUBE_W = 30;
const CORE_W = 12;

type Props = {
  /** Prefix for the ids inside — the ring can stand twice on a page. */
  id: string;
  /** Lit while the music is wanted, dark glass while it is not. */
  lit?: boolean;
  /** Sizes the badge (`size-9`, `size-8`); the ring fills it. */
  className?: string;
  /** What stands inside the ring — the wordmark. */
  children?: ReactNode;
};

/**
 * The ring off the sign, as a badge: the site's mark wherever the whole sign
 * would be too much — around the wordmark on the island and in the footer.
 * Two arcs, the gap at the top right where the note's stem leaves the real
 * ring (the note itself is the switch beside it on the island). By day it is
 * dark glass in the text's own colour; lit, it is the same tube as the sign,
 * drawn with strokes rather than the sign's morphology filter, which at this
 * size would erode a thirtieth of a pixel and blur about as much.
 */
export function SignRing({ id, lit = false, className = "", children }: Props) {
  const ringId = `${id}-sr`;
  return (
    <span className={`relative inline-grid place-items-center ${className}`}>
      <svg
        viewBox={RING_VIEW_BOX}
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <path id={ringId} d={`${ARC_L} ${ARC_R}`} fill="none" strokeLinecap="round" />
        </defs>
        {/* The glass, unlit: always there. */}
        <use href={`#${ringId}`} stroke="currentColor" strokeWidth={TUBE_W} opacity={0.5} />
        {/* The tube, lit: glow under, tube, core. */}
        <g
          className="transition-opacity duration-150"
          style={{
            opacity: lit ? 1 : 0,
            filter: `drop-shadow(0 0 1.5px ${NEON.glow}) drop-shadow(0 0 4px ${NEON.halo}90)`,
          }}
        >
          <use href={`#${ringId}`} stroke={NEON.tube} strokeWidth={TUBE_W} />
          <use href={`#${ringId}`} stroke={NEON.core} strokeWidth={CORE_W} />
        </g>
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}
