"use client";

import { PeelSticker } from "@/components/ui/PeelSticker";
import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  label: string;
  hint: string;
  ariaLabel: string;
  secret: string;
};

/**
 * The footer's tear-off note — a pure CSS fold on one boolean — hiding a
 * line here instead of the address. At 1.6× (`zoom`): the footer's size is
 * right beside a copyright line and lost on a panel of its own.
 */
export function PeelDemo({ accent, label, hint, ariaLabel, secret }: Props) {
  return (
    <StudyPanel accent={accent} label={label}>
      <style href="lab-peel" precedence="medium">
        {DEMO_CSS}
      </style>
      <PeelSticker
        email=""
        hint={hint}
        ariaLabel={ariaLabel}
        fallback={secret}
        className="pld-note"
      />
    </StudyPanel>
  );
}

const DEMO_CSS = `
.pld-note { zoom: 1.6; width: fit-content; }
`;
