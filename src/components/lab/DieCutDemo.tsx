"use client";

import { Sticker } from "@/components/ui/Sticker";
import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  label: string;
  sample: string;
};

/** The die-cut edge at three thicknesses. */
const EDGES = [2, 3, 6] as const;

/**
 * The site's content material: any content's alpha, grown outward by an
 * feMorphology dilate and filled white, is a die-cut sticker with zero
 * JavaScript — three thicknesses of the same filter, on the same word.
 */
export function DieCutDemo({ accent, label, sample }: Props) {
  return (
    <StudyPanel accent={accent} label={label}>
      <style href="lab-die-cut" precedence="medium">
        {DEMO_CSS}
      </style>
      <div className="dcd-row">
        {EDGES.map((border, i) => (
          <span key={border} className="dcd-edge">
            <Sticker seed={i + 7} border={border}>
              <span className="dcd-chip">{sample}</span>
            </Sticker>
            <span className="dcd-edge-meta">dilate {border}px</span>
          </span>
        ))}
      </div>
    </StudyPanel>
  );
}

const DEMO_CSS = `
.dcd-row { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 2.5rem 3rem; }
.dcd-edge { display: inline-flex; flex-direction: column; align-items: center; gap: 0.9rem; }
.dcd-edge-meta {
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.1em;
  color: var(--fg-tertiary);
}
.dcd-chip {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  padding: 0 1.1rem;
  border-radius: 999px;
  background: var(--spn-accent);
  color: #fff;
  font-size: 1rem;
  font-weight: 500;
}
`;
