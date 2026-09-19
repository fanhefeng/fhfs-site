"use client";

import { MeltingText, MELTING_TEXT_CSS } from "@/components/lab/MeltingText";
import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  sampleOne: string;
  sampleTwo: string;
  sampleThree: string;
  labelLoad: string;
  labelInView: string;
  labelScrub: string;
};

/**
 * The three trigger modes, one screen each: play on mount, play on entering
 * the viewport, and progress tied to the scrollbar. Same component and the
 * same numbers throughout — only the trigger changes.
 */
export function MeltingTextDemo({
  accent,
  sampleOne,
  sampleTwo,
  sampleThree,
  labelLoad,
  labelInView,
  labelScrub,
}: Props) {
  return (
    <div className="mtd">
      <style href="lab-melting-text" precedence="medium">
        {MELTING_TEXT_CSS + DEMO_CSS}
      </style>

      <StudyPanel accent={accent} label={labelLoad}>
        <MeltingText
          as="p"
          mode="load"
          delay={0.15}
          blur={15}
          goo={9}
          duration={1.3}
          stagger={0.055}
          shift="0.42em"
          className="mtd-display"
        >
          {sampleOne}
        </MeltingText>
      </StudyPanel>

      <StudyPanel accent={accent} label={labelInView}>
        <MeltingText
          as="p"
          mode="inView"
          repeat
          blur={18}
          goo={13}
          gooContrast={20}
          duration={1.4}
          stagger={0.06}
          staggerFrom="center"
          className="mtd-display"
        >
          {sampleTwo}
        </MeltingText>
      </StudyPanel>

      <StudyPanel accent={accent} label={labelScrub} className="mtd-tall">
        <MeltingText
          as="p"
          mode="scrub"
          scrub={0.6}
          start="top 80%"
          end="bottom 55%"
          blur={16}
          goo={10}
          duration={1.2}
          stagger={0.05}
          className="mtd-display"
        >
          {sampleThree}
        </MeltingText>
      </StudyPanel>
    </div>
  );
}

/* The panels and their labels are StudyPanel's; three stacked share one rule
   between them rather than drawing two. */
const DEMO_CSS = `
.mtd > .spn + .spn { border-block-start: 0; }
/* The scrub panel needs room to actually play out as you scroll past it. */
.mtd-tall .spn-panel { min-height: 92svh; }

.mtd-display {
  max-width: 18ch;
  font-size: clamp(2.4rem, 9vw, 6rem);
  font-weight: 600;
  line-height: 1.06;
  letter-spacing: -0.03em;
}
`;
