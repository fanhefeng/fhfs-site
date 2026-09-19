"use client";

import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  label: string;
  body: string;
};

/**
 * The island needs no mounting — it is overhead on this page as on every
 * other. The panel is tall so there is scroll to fold it with: on a wide
 * screen 48px of downward travel folds it, 48px back up unfolds it.
 */
export function IslandDemo({ accent, label, body }: Props) {
  return (
    <StudyPanel accent={accent} label={label} className="isd">
      <style href="lab-island" precedence="medium">
        {DEMO_CSS}
      </style>
      <p className="spn-arrow" aria-hidden="true">
        ↑
      </p>
      <p className="spn-body">{body}</p>
    </StudyPanel>
  );
}

/* Tall enough to scroll, with the copy at the top where the page opens. */
const DEMO_CSS = `
.isd .spn-panel { min-height: 120svh; justify-content: flex-start; }
`;
