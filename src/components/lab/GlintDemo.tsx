"use client";

import { useId, useRef } from "react";
import { gsap, useGSAP, EASE, isFinePointer } from "@/lib/gsap";
import { GlintDefs, GlintRing } from "@/components/fx/SpecularGlint";
import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  label: string;
  cardKicker: string;
  cardTitle: string;
  cardBody: string;
  touchNote: string;
};

/**
 * Glint geometry for a card rather than the island's capsule: the light sits
 * higher off the surface (z) and the hotspot is broader (a lower exponent),
 * so the whole rim answers as the pointer crosses, not one point of it.
 */
const GLINT = { z: 36, exponent: 12 } as const;

/**
 * The glint: a thin white ring round a glass card, rendered through an
 * feSpecularLighting filter whose point light follows the pointer, so only
 * the rim catches the torch. The header's island does this with the light
 * parked above the capsule and only its x following; a card is wide enough
 * for the light to follow in both axes.
 *
 * A fine-pointer effect. On touch the card is a card, and the note under it
 * says so.
 */
export function GlintDemo({ accent, label, cardKicker, cardTitle, cardBody, touchNote }: Props) {
  const filterId = useId().replace(/:/g, "") + "-glint";
  const cardRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const lightRef = useRef<SVGFEPointLightElement>(null);

  useGSAP(
    () => {
      const card = cardRef.current;
      const ring = ringRef.current;
      const light = lightRef.current;
      if (!card || !ring || !light) return;
      if (!isFinePointer()) return;

      // The light's x/y live in the ring's own filter space, which is the
      // card's box: pointer minus the card's corner.
      const onMove = (e: PointerEvent) => {
        const r = card.getBoundingClientRect();
        gsap.to(light, {
          attr: { x: e.clientX - r.left, y: e.clientY - r.top },
          duration: 0.3,
          ease: EASE.soft,
          overwrite: "auto",
        });
      };
      const onEnter = () => gsap.to(ring, { opacity: 1, duration: 0.35, overwrite: "auto" });
      const onLeave = () => gsap.to(ring, { opacity: 0, duration: 0.5, overwrite: "auto" });

      card.addEventListener("pointermove", onMove);
      card.addEventListener("pointerenter", onEnter);
      card.addEventListener("pointerleave", onLeave);
      return () => {
        card.removeEventListener("pointermove", onMove);
        card.removeEventListener("pointerenter", onEnter);
        card.removeEventListener("pointerleave", onLeave);
      };
    },
    { scope: cardRef },
  );

  return (
    <StudyPanel accent={accent} label={label} note={touchNote}>
      <style href="lab-glint" precedence="medium">
        {DEMO_CSS}
      </style>
      <GlintDefs
        id={filterId}
        exponent={GLINT.exponent}
        x={0}
        y={0}
        z={GLINT.z}
        lightRef={lightRef}
      />
      <div ref={cardRef} className="gld-card glass-thin">
        <GlintRing filterId={filterId} className="rounded-[20px]" ringRef={ringRef} />
        <p className="gld-card-kicker">{cardKicker}</p>
        <p className="gld-card-title">{cardTitle}</p>
        <p className="gld-card-body">{cardBody}</p>
      </div>
    </StudyPanel>
  );
}

/* The panel, its label and its note are StudyPanel's; this is the card. */
const DEMO_CSS = `
.gld-card {
  position: relative;
  width: min(100%, 30rem);
  padding: 2rem 2.25rem 2.25rem;
  border-radius: 20px;
}
.gld-card-kicker {
  margin: 0;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-tertiary);
}
.gld-card-title {
  margin: 0.75rem 0 0;
  font-size: 1.5rem;
  font-weight: 650;
  letter-spacing: -0.01em;
  line-height: 1.2;
}
.gld-card-body {
  margin: 0.75rem 0 0;
  max-width: 34ch;
  color: var(--fg-secondary);
  line-height: 1.6;
}
`;
