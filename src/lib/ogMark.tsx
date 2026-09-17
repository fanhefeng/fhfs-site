import { ARC_L, ARC_R, MARK_VIEW_BOX, NEON, NOTE_D, NOTE_T } from "@/components/neon/geometry";

/**
 * The site's mark for the Open Graph cards: the ring off the neon sign with
 * the note in its gap, lit, on a near-black plate — the favicon at card size.
 *
 * Satori renders no filters, so the tube's glow is layered strokes, the same
 * four layers the favicon uses (halo, glow, tube, core). It also ignores a
 * nested `<svg>`'s viewBox (the drawing came out at full size across the
 * card), so the drawing is fitted with one group transform instead:
 * `MARK_VIEW_BOX` — the same box the favicon is cut from — scaled into a
 * 416px square inset 48px on the 512 plate. Read from geometry rather than
 * typed out here, or a re-cut mark would go on quietly mis-fitting the card.
 * Strokes scale with the group, as they should.
 */
const [MARK_X, MARK_Y, MARK_SIZE] = MARK_VIEW_BOX.split(" ").map(Number);
const INSET = 48;
const PLATE = 512;

export function OgSignMark({ size }: { size: number }) {
  const ring = `${ARC_L} ${ARC_R}`;
  const stroke = { fill: "none", strokeLinecap: "round" as const };
  const note = { strokeLinejoin: "round" as const };
  const fit = `translate(${INSET} ${INSET}) scale(${(PLATE - INSET * 2) / MARK_SIZE}) translate(${-MARK_X} ${-MARK_Y})`;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${PLATE} ${PLATE}`}
      style={{ display: "flex" }}
      aria-hidden="true"
    >
      <rect width={PLATE} height={PLATE} rx="112" fill={NEON.wall} />
      <g transform={fit}>
        <path d={ring} {...stroke} stroke={NEON.halo} strokeWidth={120} opacity={0.28} />
        <path d={ring} {...stroke} stroke={NEON.glow} strokeWidth={64} opacity={0.7} />
        <path d={ring} {...stroke} stroke={NEON.tube} strokeWidth={36} />
        <path d={ring} {...stroke} stroke={NEON.core} strokeWidth={12} />
        <g transform={NOTE_T}>
          <path d={NOTE_D} {...note} fill={NEON.halo} stroke={NEON.halo} strokeWidth={90} opacity={0.28} />
          <path d={NOTE_D} {...note} fill={NEON.glow} stroke={NEON.glow} strokeWidth={40} opacity={0.7} />
          <path d={NOTE_D} {...note} fill={NEON.tube} stroke={NEON.tube} strokeWidth={14} />
          <path d={NOTE_D} fill={NEON.core} />
        </g>
      </g>
    </svg>
  );
}
