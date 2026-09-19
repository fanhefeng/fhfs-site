"use client";

import { useState } from "react";
import { MeltingText, MELTING_TEXT_CSS } from "@/components/lab/MeltingText";
import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  label: string;
  replay: string;
  sample: string;
};

/**
 * One melt: the line congeals and resolves once as it scrolls into view, and
 * the button plays it again in place. Replaying remounts the text (`key`),
 * and a trigger created on a line already in view fires straight away. The
 * component can also be bound to mount or to the scrollbar; showing all
 * three side by side was a comparison nobody asked for, so the study shows
 * the one the effect reads best in.
 */
export function MeltingTextDemo({ accent, label, replay, sample }: Props) {
  const [take, setTake] = useState(0);

  return (
    <StudyPanel accent={accent} label={label}>
      <style href="lab-melting-text" precedence="medium">
        {MELTING_TEXT_CSS + DEMO_CSS}
      </style>
      <MeltingText
        key={take}
        as="p"
        mode="inView"
        blur={18}
        goo={13}
        gooContrast={20}
        duration={1.4}
        stagger={0.06}
        staggerFrom="center"
        className="mtd-display"
      >
        {sample}
      </MeltingText>
      <button type="button" className="spn-btn" onClick={() => setTake((n) => n + 1)}>
        {replay}
        <span aria-hidden="true">↻</span>
      </button>
    </StudyPanel>
  );
}

const DEMO_CSS = `
.mtd-display {
  margin: 0;
  max-width: 18ch;
  font-size: clamp(2.4rem, 9vw, 6rem);
  font-weight: 600;
  line-height: 1.06;
  letter-spacing: -0.03em;
}
`;
