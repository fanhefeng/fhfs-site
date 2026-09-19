"use client";

import type { CSSProperties } from "react";
import { Magnetic, MAGNET_REACH } from "@/components/fx/Magnetic";
import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  label: string;
  weak: string;
  medium: string;
  strong: string;
  reachNote: string;
  touchNote: string;
};

/** Three strengths of the same wrapper, from barely-there to glued. */
const STRENGTHS = [0.2, 0.4, 0.75] as const;

/**
 * The magnet: the plate leans toward the cursor while it is within reach,
 * the label inside leads by an extra 0.6x, and on leave both spring home
 * with an elastic wobble. Three buttons, three strengths, so the one number
 * the component takes can be felt — and a dotted ring round each showing
 * where the pull starts and stops, since that reach is the whole fix.
 *
 * A fine-pointer effect. On touch the buttons are buttons, and the note
 * under them says so.
 */
export function MagneticDemo({ accent, label, weak, medium, strong, reachNote, touchNote }: Props) {
  const labels = [weak, medium, strong];

  return (
    <StudyPanel accent={accent} label={label}>
      <style href="lab-magnetic" precedence="medium">
        {DEMO_CSS}
      </style>
      <div className="mgd-row" style={{ "--mgd-reach": `${MAGNET_REACH}px` } as CSSProperties}>
        {STRENGTHS.map((strength, i) => (
          <span key={strength} className="mgd-reach">
            <Magnetic strength={strength}>
              <button type="button" className="mgd-btn">
                <span>{labels[i]}</span>
                <span className="mgd-btn-meta">×{strength}</span>
              </button>
            </Magnetic>
          </span>
        ))}
      </div>
      <div className="mgd-notes">
        <p className="spn-note">{reachNote}</p>
        <p className="spn-note">{touchNote}</p>
      </div>
    </StudyPanel>
  );
}

/* The panel, its label and its notes are StudyPanel's; this is the demo. */
const DEMO_CSS = `
/* Room for the reach rings: they extend past the buttons on every side. */
.mgd-row { display: flex; flex-wrap: wrap; gap: 3rem 3.5rem; padding: var(--mgd-reach); }

/* The reach, drawn: the box the pull is measured against, plus its ring.
   Dotted so it reads as a boundary, not a second button. Square-cornered,
   because the reach is: Magnetic tests each axis against the resting box, so
   a pill drawn here left four corners where the cursor sat outside the line
   and was still pulled. */
.mgd-reach { position: relative; display: inline-block; }
.mgd-reach::before {
  content: "";
  position: absolute;
  inset: calc(-1 * var(--mgd-reach));
  border: 1px dotted color-mix(in oklab, var(--spn-accent) 55%, transparent);
  border-radius: 4px;
  pointer-events: none;
}

.mgd-btn {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  min-height: 3.5rem;
  padding: 0.85rem 1.75rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface-raised, var(--surface));
  color: var(--fg);
  font: inherit;
  font-size: 1rem;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  transition: border-color 0.2s ease-out;
}
.mgd-btn:hover { border-color: var(--spn-accent); }
.mgd-btn-meta {
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.1em;
  color: var(--fg-tertiary);
}

.mgd-notes { display: grid; gap: 0.5rem; }
`;
