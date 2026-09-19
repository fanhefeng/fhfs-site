"use client";

import { RadialFab } from "@/components/fx/RadialFab";
import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  label: string;
  body: string;
  shareTitle: string;
};

/**
 * The phone's radial fan, fixed to the viewport the way the layout mounts it
 * on an article: four buttons burst along a 90° arc on elastic, and closing
 * reverses the same timeline at 2.2×. On the site it exists only on phones —
 * on a wide screen the island covers the same ground — but a study that
 * shows nothing on a desk is no study, so here it is mounted at every width.
 */
export function RadialFanDemo({ accent, label, body, shareTitle }: Props) {
  return (
    <StudyPanel accent={accent} label={label}>
      <p className="spn-body">{body}</p>
      <p className="spn-arrow" aria-hidden="true">
        ↘
      </p>
      <RadialFab shareTitle={shareTitle} always />
    </StudyPanel>
  );
}
