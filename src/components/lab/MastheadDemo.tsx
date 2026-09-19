"use client";

import { useRef, useState } from "react";
import { gsap, useGSAP, ScrollTrigger, EASE } from "@/lib/gsap";
import { REVEAL_START } from "@/components/fx/Reveal";
import { StudyPanel } from "./StudyPanel";

// Referenced so bundlers keep the plugin; registration lives in @/lib/gsap.
void ScrollTrigger;

type Props = {
  accent: string;
  label: string;
  replay: string;
  lineOne: string;
  lineTwo: string;
};

/**
 * The masthead's line mask: each line slides up from behind its own clip,
 * implying it was always there. The home page does it in CSS, gated on the
 * overture (`Opening.tsx`); here the same numbers (112% → 0, 1.05s, 110ms
 * apart) run as a tween on entering the viewport, so it can be replayed —
 * replaying remounts the lines (`key`), which is what a route change does.
 */
export function MastheadDemo({ accent, label, replay, lineOne, lineTwo }: Props) {
  const [take, setTake] = useState(0);

  return (
    <StudyPanel accent={accent} label={label}>
      <style href="lab-masthead" precedence="medium">
        {DEMO_CSS}
      </style>
      <MastheadLines key={take} lines={[lineOne, lineTwo]} />
      <button type="button" className="spn-btn" onClick={() => setTake((n) => n + 1)}>
        {replay}
        <span aria-hidden="true">↻</span>
      </button>
    </StudyPanel>
  );
}

function MastheadLines({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      gsap.from(el.querySelectorAll(".mhd-line > i"), {
        yPercent: 112,
        duration: 1.05,
        ease: EASE.unveil,
        stagger: 0.11,
        scrollTrigger: { trigger: el, start: REVEAL_START, once: true },
      });
    },
    { scope: ref },
  );

  return (
    <p ref={ref} className="mhd">
      {lines.map((line) => (
        <span key={line} className="mhd-line">
          <i>{line}</i>
        </span>
      ))}
    </p>
  );
}

const DEMO_CSS = `
.mhd {
  margin: 0;
  font-family: var(--font-display, inherit);
  font-size: clamp(2rem, 6.4vw, 5rem);
  font-weight: 650;
  line-height: 1.1;
  letter-spacing: -0.02em;
  text-wrap: balance;
}
.mhd-line { display: block; overflow: hidden; padding-bottom: 0.06em; }
.mhd-line > i { display: block; font-style: inherit; }
`;
