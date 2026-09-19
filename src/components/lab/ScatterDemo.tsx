"use client";

import { ParticleLine } from "@/components/notfound/ParticleLine";
import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  label: string;
  hint: string;
  /** Latin only — the particle line samples display type, and CJK strokes
   *  fall through its grid (see `ParticleLine.tsx`, MIN_DOTS). */
  text: string;
  touchNote: string;
};

/**
 * The 404's line: a paragraph of real type, sampled into particles that
 * scatter and spring home along a discrete spring whose one tunable is how
 * long it takes to settle. The pointer pushes them apart and they find their
 * way back, and once every dot is home the loop stops outright. On touch it
 * is a paragraph.
 */
export function ScatterDemo({ accent, label, hint, text, touchNote }: Props) {
  return (
    <StudyPanel accent={accent} label={label} hint={hint} note={touchNote}>
      <style href="lab-scatter" precedence="medium">
        {DEMO_CSS}
      </style>
      <ParticleLine text={text} lang="en" className="scd-line" />
    </StudyPanel>
  );
}

const DEMO_CSS = `
.scd-line {
  font-size: clamp(3.5rem, 14vw, 11rem);
  font-weight: 650;
  line-height: 1;
  letter-spacing: -0.03em;
}
`;
