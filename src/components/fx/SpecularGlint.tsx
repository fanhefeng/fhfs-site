"use client";

import type { Ref } from "react";

/**
 * The A1 edge glint, shared by the header island and the home hero's
 * colophon card: an feSpecularLighting + fePointLight filter composited into
 * a thin white ring's own alpha, so only the border catches the light.
 *
 * The two halves are separate components because the callers place them
 * apart (the defs can sit anywhere; the ring must sit inside the surface it
 * rims). The caller owns both refs and drives the animation itself — the
 * light's x/y live in the ring's own filter coordinate space, so whoever
 * measures the pointer must also own the element being measured.
 */
export function GlintDefs({
  id,
  exponent,
  x,
  y,
  z,
  lightRef,
}: {
  id: string;
  /** Highlight tightness — higher = smaller hotspot. */
  exponent: number;
  /** Resting light position, in the ring's filter units. */
  x: number;
  y: number;
  z: number;
  lightRef: Ref<SVGFEPointLightElement>;
}) {
  return (
    <svg aria-hidden="true" focusable="false" className="absolute h-0 w-0">
      <defs>
        <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
          <feSpecularLighting
            in="SourceAlpha"
            surfaceScale={1.4}
            specularConstant={1.1}
            specularExponent={exponent}
            lightingColor="#ffe9cf"
            result="spec"
          >
            <fePointLight ref={lightRef} x={x} y={y} z={z} />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}

/** The ring the light plays on: invisible at rest, faded in by the caller.
 *  Pass the surface's radius class (rounded-full / rounded-panel). */
export function GlintRing({
  filterId,
  className,
  ringRef,
}: {
  filterId: string;
  className: string;
  ringRef: Ref<HTMLSpanElement>;
}) {
  return (
    <span
      ref={ringRef}
      aria-hidden="true"
      className={`pointer-events-none absolute -inset-px opacity-0 ${className}`}
      style={{
        border: "1.5px solid rgba(255,255,255,0.9)",
        filter: `url(#${filterId})`,
      }}
    />
  );
}
