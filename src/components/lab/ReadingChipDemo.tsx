"use client";

import { ReadingChip } from "@/components/fx/ProgressHud";
import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  label: string;
  body: string;
};

/**
 * The reading chip, which the layout shows only on an article, mounted here
 * on a page that is not one — fixed to the viewport's bottom-left corner the
 * way the layout mounts it, measuring this page. Shown at 1.75× (`zoom`):
 * the hairline it fills is 36px wide at the article's size, too little to
 * watch from across a panel.
 */
export function ReadingChipDemo({ accent, label, body }: Props) {
  return (
    <StudyPanel accent={accent} label={label} className="rcd">
      <style href="lab-reading-chip" precedence="medium">
        {DEMO_CSS}
      </style>
      <p className="spn-body">{body}</p>
      <p className="spn-arrow" aria-hidden="true">
        ↙
      </p>
      <ReadingChip className="rcd-chip" />
    </StudyPanel>
  );
}

/* Tall enough that there is a distance for the chip to measure — and the
   copy kept at the top of it, where the page opens, not centred below the
   fold. */
const DEMO_CSS = `
.rcd .spn-panel { min-height: 140svh; justify-content: flex-start; }
.rcd-chip { zoom: 1.75; }
`;
