"use client";

import { useState } from "react";
import { Reveal } from "@/components/fx/Reveal";
import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  label: string;
  replay: string;
  items: string[];
};

/**
 * The site's one scroll entrance, `Reveal`: y:24 / opacity:0 → 0.6s
 * power2.out, once, at "top 85%", with the children staggered 60ms apart.
 * Replaying remounts the list (`key`), which is what a route change does.
 */
export function RevealDemo({ accent, label, replay, items }: Props) {
  const [take, setTake] = useState(0);

  return (
    <StudyPanel accent={accent} label={label}>
      <style href="lab-reveal" precedence="medium">
        {DEMO_CSS}
      </style>
      <Reveal key={take} as="ul" role="list" stagger={0.06} className="rvd-list">
        {items.map((item, i) => (
          <li key={item} className="rvd-row">
            <span className="rvd-ordinal" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </Reveal>
      <button type="button" className="spn-btn" onClick={() => setTake((n) => n + 1)}>
        {replay}
        <span aria-hidden="true">↻</span>
      </button>
    </StudyPanel>
  );
}

const DEMO_CSS = `
.rvd-list { margin: 0; padding: 0; list-style: none; max-width: 40rem; border-top: 1px solid var(--line); }
.rvd-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1rem;
  padding: 1.1rem 0;
  border-bottom: 1px solid var(--line);
  font-size: 1.0625rem;
}
.rvd-ordinal {
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  color: var(--fg-tertiary);
  padding-top: 0.35rem;
}
`;
