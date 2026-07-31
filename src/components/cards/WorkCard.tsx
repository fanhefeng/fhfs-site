"use client";

import { useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { gsap, useGSAP, EASE } from "@/lib/gsap";
import type { Locale } from "@/i18n/routing";
import type { Work } from "content-collections";

/* -------------------------------------------------------------------------
 * Specular edge — the card material's one flourish.
 *
 * After jh3y's "basic svg lighting" (codepen azORaYx): a hairline ring drawn
 * with a mask-composite frame is fed through feSpecularLighting, so the
 * cursor reads as a small lamp sweeping the glass edge. The light colour is
 * the item's own accent, which is why the filter lives *inside* each card
 * with a unique id instead of being shared.
 *
 * Fine pointer + motion allowed: the highlight follows the cursor and the
 * ring fades in on hover. Touch or reduced motion: a static, dimmer rim —
 * the edge is lit, it simply never moves.
 * ---------------------------------------------------------------------- */

type SpecularEdgeProps = {
  /** Light colour — any CSS colour, `var(--…)` included. */
  color: string;
  /** Rim thickness in px. */
  width?: number;
};

export function SpecularEdge({ color, width = 1 }: SpecularEdgeProps) {
  const ringRef = useRef<HTMLSpanElement>(null);
  const lightRef = useRef<SVGFEPointLightElement>(null);
  // useId is SSR-stable; strip the colons React puts in so the value is a
  // legal id for url(#…) references in every engine.
  const filterId = `spec-${useId().replace(/:/g, "")}`;

  useGSAP(() => {
    const ring = ringRef.current;
    const light = lightRef.current;
    // The host is whatever card wraps this rim — it owns the hover.
    const host = ring?.parentElement;
    if (!ring || !light || !host) return;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!fine || still) {
      // Static rim: park the lamp above the top-left corner and leave it on.
      gsap.set(light, { attr: { x: host.offsetWidth * 0.28, y: 0, z: 56 } });
      gsap.set(ring, { opacity: 0.5 });
      return;
    }

    const setLight = gsap.quickSetter(light, "attr") as (v: object) => void;
    // Geometry is read on enter only — an event-driven read, never per frame.
    let box: DOMRect | null = null;

    const onEnter = () => {
      box = host.getBoundingClientRect();
      gsap.to(ring, {
        opacity: 1,
        duration: 0.28,
        ease: EASE.default,
        overwrite: "auto",
      });
    };

    const onMove = (e: PointerEvent) => {
      if (!box) box = host.getBoundingClientRect();
      setLight({ x: e.clientX - box.left, y: e.clientY - box.top, z: 46 });
    };

    const onLeave = () => {
      box = null;
      gsap.to(ring, {
        opacity: 0,
        duration: 0.2,
        ease: EASE.exit,
        overwrite: "auto",
      });
    };

    host.addEventListener("pointerenter", onEnter);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    return () => {
      host.removeEventListener("pointerenter", onEnter);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      gsap.killTweensOf(ring);
    };
  }, { scope: ringRef });

  return (
    <>
      <svg
        aria-hidden="true"
        focusable="false"
        width="0"
        height="0"
        style={{ position: "absolute" }}
      >
        <filter
          id={filterId}
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
          colorInterpolationFilters="sRGB"
        >
          {/* Blur the rim's alpha into a bevel, light that bevel, then clip
              the highlight back to the rim so nothing spills onto the card. */}
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="bevel" />
          <feSpecularLighting
            in="bevel"
            surfaceScale="5"
            specularConstant="1.1"
            specularExponent="22"
            style={{ lightingColor: color }}
            result="lit"
          >
            <fePointLight ref={lightRef} x={0} y={0} z={46} />
          </feSpecularLighting>
          <feComposite in="lit" in2="SourceAlpha" operator="in" result="rim" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="rim" />
          </feMerge>
        </filter>
      </svg>
      <span
        ref={ringRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          padding: width,
          pointerEvents: "none",
          opacity: 0,
          background: color,
          // Frame-only fill: outer box minus the padding box.
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          filter: `url(#${filterId})`,
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------------- */

type Props = {
  work: Work;
  locale: Locale;
  /** Accent used as the specular light colour; defaults to the site amber. */
  accent?: string;
};

/**
 * One piece in the gallery: a glass plate with mono year, title, note and
 * tags. Hover lights the edge in the project's own colour.
 */
export function WorkCard({ work, locale, accent = "var(--accent)" }: Props) {
  const t = useTranslations("portfolio");

  return (
    <article className="group relative isolate flex flex-col rounded-card glass-thin p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-heading vibrancy">{work.title[locale]}</h3>
        <span className="shrink-0 font-mono text-meta tracking-meta text-fg-tertiary">
          {work.year}
        </span>
      </div>
      <p className="mt-3 flex-1 text-caption leading-relaxed text-fg-secondary">
        {work.description[locale]}
      </p>
      {work.tags.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {work.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-chip border border-line px-2.5 py-1 font-mono text-meta tracking-meta text-fg-tertiary"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}
      {work.url && (
        <a
          href={work.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hit-ext mt-5 inline-flex w-fit items-center gap-1.5 text-caption text-fg-secondary underline decoration-accent/50 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
        >
          {t("visit")}
          <span aria-hidden="true">↗</span>
        </a>
      )}
      <SpecularEdge color={accent} />
    </article>
  );
}
