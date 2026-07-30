/**
 * The club's neon sign, after the "Seb's" marquee in La La Land:
 * a broken tube ring, FHF in double-line neon, an eighth note for the
 * apostrophe, a small S escaping the ring, an underline slash, and a
 * steam flourish on the left.
 *
 * Tubes are drawn once into <defs> and stamped three times: a blurred
 * halo, a saturated middle, and a near-white core — the same way a real
 * neon photograph reads.
 */
export function NeonLogo({
  className = "",
  title,
  compact = false,
}: {
  className?: string;
  /** Accessible name; omit to render the mark as decorative. */
  title?: string;
  /** Drops the companion tubes, which smear together below ~64px. */
  compact?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <filter id="fhfGlow" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <g id="fhfArt">
          {/* Ring, broken where the S and the slash cross the tube */}
          <path d="M450.9,211 A200,200 0 0 1 448.2,311.1" />
          <path d="M427.4,359 A200,200 0 0 1 124.8,407" />
          <path d="M90.2,367.8 A200,200 0 0 1 384.6,102.8" />
          {/* F */}
          <path d="M124,332 L124,194 Q124,180 138,180 L186,180" />
          <path d="M124,258 L172,258" />
          {/* H */}
          <path d="M224,180 L224,332" />
          <path d="M288,180 L288,332" />
          <path d="M224,258 L288,258" />
          {/* F */}
          <path d="M326,332 L326,194 Q326,180 340,180 L388,180" />
          <path d="M326,258 L374,258" />
          {/* Eighth-note apostrophe */}
          <circle cx="390" cy="156" r="9" />
          <path d="M399,154 L399,94 Q414,102 416,122" />
          {/* Small S escaping the ring, top right — two tangent bowls, so the
              companion tube below is an exact parallel offset */}
          <path d="M483.1,95.8 A26,26 0 0 0 438.8,79.7 A26,26 0 0 0 455,124 A26,26 0 0 1 471.2,168.3 A26,26 0 0 1 426.9,152.2" />
          {/* Underline slash */}
          <path d="M70,395 L470,330" />
        </g>
        <g id="fhfArtThin">
          {/* Companion inner lines — the double-tube look of a marquee font */}
          <path d="M136,318 L136,204 Q136,192 148,192 L182,192" />
          <path d="M136,270 L166,270" />
          <path d="M236,192 L236,320" />
          <path d="M276,192 L276,320" />
          <path d="M236,270 L276,270" />
          <path d="M338,318 L338,204 Q338,192 350,192 L384,192" />
          <path d="M338,270 L368,270" />
          {/* ...and an 11px inset nested inside each bowl of the S */}
          <path d="M469.2,89.1 A15,15 0 0 0 444.5,90.2 A15,15 0 0 0 454.4,112.8" />
          <path d="M455.6,135.2 A15,15 0 0 1 465.5,157.8 A15,15 0 0 1 440.8,158.9" />
        </g>
      </defs>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <use
          href="#fhfArt"
          stroke="#4cc9f0"
          strokeWidth={compact ? 26 : 20}
          filter="url(#fhfGlow)"
          opacity=".85"
        />
        <use href="#fhfArt" stroke="#4cc9f0" strokeWidth={compact ? 18 : 14} />
        <use href="#fhfArt" stroke="#eaf9ff" strokeWidth={compact ? 13 : 10} />
        {!compact && (
          <>
            <use href="#fhfArtThin" stroke="#4cc9f0" strokeWidth="12" filter="url(#fhfGlow)" opacity=".8" />
            <use href="#fhfArtThin" stroke="#4cc9f0" strokeWidth="8" />
            <use href="#fhfArtThin" stroke="#eaf9ff" strokeWidth="4.5" />
          </>
        )}
      </g>
    </svg>
  );
}
