"use client";

import type { CSSProperties } from "react";
import { MeltingText, MELTING_TEXT_CSS } from "@/components/lab/MeltingText";

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
    <div className="mtd" style={{ "--mtd-accent": accent } as CSSProperties}>
      <style href="lab-melting-text" precedence="medium">
        {MELTING_TEXT_CSS + DEMO_CSS}
      </style>

      <section className="mtd-panel">
        <p className="mtd-label">{labelLoad}</p>
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
      </section>

      <section className="mtd-panel">
        <p className="mtd-label">{labelInView}</p>
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
      </section>

      <section className="mtd-panel mtd-panel--tall">
        <p className="mtd-label">{labelScrub}</p>
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
      </section>
    </div>
  );
}

const DEMO_CSS = `
.mtd { border-block-start: 1px solid var(--line); }

.mtd-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1.5rem;
  min-height: 62svh;
  padding: 4rem clamp(1.5rem, 6vw, 4rem);
  border-block-end: 1px solid var(--line);
}
/* The scrub panel needs room to actually play out as you scroll past it. */
.mtd-panel--tall { min-height: 92svh; }

.mtd-label {
  margin: 0;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-tertiary);
}
.mtd-label::before {
  content: "";
  display: inline-block;
  width: 0.4rem;
  height: 0.4rem;
  margin-inline-end: 0.55rem;
  border-radius: 50%;
  background: var(--mtd-accent);
  vertical-align: middle;
}

.mtd-display {
  max-width: 18ch;
  font-size: clamp(2.4rem, 9vw, 6rem);
  font-weight: 600;
  line-height: 1.06;
  letter-spacing: -0.03em;
}
`;
