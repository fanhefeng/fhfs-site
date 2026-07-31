import type { CSSProperties, ReactNode } from "react";

type Props = {
  children: ReactNode;
  /**
   * Seed for the deterministic micro-random tilt (-3°…3°). Pass the item's
   * index so a wall of stickers leans every which way, yet SSR and client
   * always agree.
   */
  seed?: number;
  /** Explicit tilt in degrees — overrides the seed. */
  rotate?: number;
  /** Die-cut white edge thickness in px (the feMorphology dilate radius). */
  border?: number;
  /** Optional fixed width in px, for image stickers. Text chips size naturally. */
  size?: number;
  className?: string;
};

/** Tiny LCG → stable pseudo-random in [0,1) from an integer seed. */
const rand = (seed: number) => (((seed + 1) * 9301 + 49297) % 233280) / 233280;

/**
 * Sticker material — the "content" material of the site (glass is the
 * container). Wraps any content (image, emoji, text chip) in an SVG
 * feMorphology dilate filter that grows the alpha into a white die-cut
 * border, plus a warm contact shadow. Zero JS and SSR-safe: the filter is
 * declared inline with a deterministic id, so duplicate declarations across
 * instances are identical and url(#…) always resolves to a matching one.
 *
 * The tilt uses the standalone CSS `rotate` property on purpose: GSAP's
 * Draggable writes `transform`, so a dragged sticker keeps its lean.
 */
export function Sticker({
  children,
  seed = 0,
  rotate,
  border = 3,
  size,
  className,
}: Props) {
  const tilt = rotate ?? Math.round((rand(seed) * 6 - 3) * 10) / 10;
  const filterId = `sticker-edge-${border}`;

  const style: CSSProperties = {
    filter: `url(#${filterId}) drop-shadow(0 2px 8px var(--sticker-shadow-color))`,
    rotate: `${tilt}deg`,
    display: "inline-block",
    ...(size != null ? { width: size } : null),
  };

  return (
    <span className={`inline-block ${className ?? ""}`}>
      <svg
        aria-hidden="true"
        focusable="false"
        width="0"
        height="0"
        style={{ position: "absolute" }}
      >
        <filter
          id={filterId}
          x="-25%"
          y="-25%"
          width="150%"
          height="150%"
          colorInterpolationFilters="sRGB"
        >
          {/* Grow the silhouette, fill it white, tuck the artwork on top. */}
          <feMorphology
            in="SourceAlpha"
            operator="dilate"
            radius={border}
            result="edge"
          />
          <feFlood floodColor="#ffffff" result="fill" />
          <feComposite in="fill" in2="edge" operator="in" result="border" />
          <feMerge>
            <feMergeNode in="border" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </svg>
      <span style={style}>{children}</span>
    </span>
  );
}
