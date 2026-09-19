"use client";

import { DotDoodle } from "@/components/fx/DotDoodle";
import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  label: string;
  hint: string;
  /** A–Z only — the dot glyph table has no other characters. */
  text: string;
  touchNote: string;
};

/**
 * The name on /about: a dot-matrix field per letter, padded with noise and
 * carved by a superellipse rim, every dot drifting in brightness so the name
 * hides inside the noise until the pointer collapses it and the letters
 * surface. On touch it is a still field.
 */
export function DotNameDemo({ accent, label, hint, text, touchNote }: Props) {
  return (
    <StudyPanel accent={accent} label={label} hint={hint} note={touchNote}>
      <style href="lab-dot-name" precedence="medium">
        {DEMO_CSS}
      </style>
      <DotDoodle text={text} className="dnd-field" />
    </StudyPanel>
  );
}

const DEMO_CSS = `
/* Its own width, from the aspect ratio DotDoodle sets: stretched across the
   panel's flex column, the canvas — and so the hover — reached far past the
   letters, and every hover cleared the whole strip. */
.dnd-field { height: clamp(3.5rem, 14vw, 7rem); align-self: flex-start; max-width: 100%; }
`;
