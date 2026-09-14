import { ARC_L, ARC_R, NEON, NOTE_D } from "@/components/neon/geometry";

/**
 * The site's mark for the Open Graph cards: the ring off the neon sign with
 * the note in its gap, lit, on a near-black plate — the favicon at card size.
 *
 * Satori renders no filters, so the tube's glow is layered strokes, the same
 * four layers the favicon uses (halo, glow, tube, core). It also ignores a
 * nested `<svg>`'s viewBox (the drawing came out at full size across the
 * card), so the drawing is fitted with one group transform instead: the
 * mark's 740-unit box (`MARK_VIEW_BOX`, x 31 y 198) scaled into a 416px
 * square inset 48px on the 512 plate. Strokes scale with the group, as they
 * should.
 */
export function OgSignMark({ size }: { size: number }) {
  const ring = `${ARC_L} ${ARC_R}`;
  const stroke = { fill: "none", strokeLinecap: "round" as const };
  const note = { strokeLinejoin: "round" as const };
  const fit = `translate(48 48) scale(${416 / 740}) translate(-31 -198)`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      style={{ display: "flex" }}
      aria-hidden="true"
    >
      <rect width="512" height="512" rx="112" fill={NEON.wall} />
      <g transform={fit}>
        <path d={ring} {...stroke} stroke={NEON.halo} strokeWidth={120} opacity={0.28} />
        <path d={ring} {...stroke} stroke={NEON.glow} strokeWidth={64} opacity={0.7} />
        <path d={ring} {...stroke} stroke={NEON.tube} strokeWidth={36} />
        <path d={ring} {...stroke} stroke={NEON.core} strokeWidth={12} />
        <g transform="translate(8 -60)">
          <path d={NOTE_D} {...note} fill={NEON.halo} stroke={NEON.halo} strokeWidth={90} opacity={0.28} />
          <path d={NOTE_D} {...note} fill={NEON.glow} stroke={NEON.glow} strokeWidth={40} opacity={0.7} />
          <path d={NOTE_D} {...note} fill={NEON.tube} stroke={NEON.tube} strokeWidth={14} />
          <path d={NOTE_D} fill={NEON.core} />
        </g>
      </g>
    </svg>
  );
}
