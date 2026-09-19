"use client";

import { LightSwitch } from "@/components/ui/LightSwitch";
import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  label: string;
  body: string;
};

/**
 * The light switch, the footer's own, mounted where it can be watched: it
 * flips the three-part theme contract inside startViewTransition, which
 * globals.css stretches into the 1.2s cross-fade, with the synthesised click
 * and the 10ms buzz on the same frame. Blown up to two and a half times —
 * at the footer's size it is a dot on an empty panel — with `zoom`, so the
 * CSS transitions inside it scale with it.
 */
export function LightsDemo({ accent, label, body }: Props) {
  return (
    <StudyPanel accent={accent} label={label}>
      <style href="lab-lights" precedence="medium">
        {DEMO_CSS}
      </style>
      <p className="spn-body">{body}</p>
      <div className="spn-control ltd-switch">
        <LightSwitch />
      </div>
    </StudyPanel>
  );
}

const DEMO_CSS = `
.ltd-switch { zoom: 2.5; }
`;
