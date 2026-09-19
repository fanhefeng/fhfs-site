"use client";

import type { CSSProperties } from "react";
import { useLocale } from "next-intl";
import { SidewaysBand } from "@/components/fx/SidewaysBand";

type Props = {
  accent: string;
  hint: string;
  lead: string;
  lineOne: string;
  lineTwo: string;
  lineThree: string;
  tail: string;
};

/**
 * The sideways passage on its own: a short paragraph to scroll away from, the
 * pinned band with three lines of three sizes riding across it, and a line
 * to arrive at. Same component /about uses, with the lab's own copy — the
 * point of the study is that the mechanism is separable from the manifesto.
 */
export function SidewaysDemo({ accent, hint, lead, lineOne, lineTwo, lineThree, tail }: Props) {
  const locale = useLocale();
  return (
    <div className="swd" style={{ "--swd-accent": accent } as CSSProperties}>
      <style href="lab-sideways" precedence="medium">
        {DEMO_CSS}
      </style>

      <section className="swd-panel">
        <p className="swd-lead">{lead}</p>
        <p className="swd-hint">{hint}</p>
      </section>

      <SidewaysBand
        className="swd-band"
        lines={[
          {
            text: lineOne,
            className:
              "text-display-sm md:text-[clamp(3rem,8vw,7rem)] md:leading-[1.08] md:font-[650] md:tracking-[-0.03em]",
          },
          {
            text: lineTwo,
            // The echo is in the other language, as on /about — tagged so the
            // CJK tracking and the no-oblique rule follow the words, not the page.
            lang: locale === "zh" ? "en" : "zh-CN",
            className:
              "no-cjk-oblique mt-4 font-serif text-title italic text-fg-secondary md:text-[clamp(1.5rem,3vw,2.75rem)]",
          },
          {
            text: lineThree,
            className: "mt-4 font-mono text-meta uppercase tracking-meta text-fg-tertiary",
          },
        ]}
      />

      <section className="swd-panel swd-panel--tail">
        <p className="swd-lead">{tail}</p>
      </section>
    </div>
  );
}

const DEMO_CSS = `
.swd { border-block-start: 1px solid var(--line); }

.swd-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1.25rem;
  min-height: 48svh;
  padding: 4rem clamp(1.5rem, 6vw, 4rem);
  border-block-end: 1px solid var(--line);
}
.swd-panel--tail { min-height: 40svh; border-block-end: 0; }

.swd-lead {
  margin: 0;
  max-width: 34ch;
  font-size: 1.125rem;
  line-height: 1.6;
  color: var(--fg-secondary);
}

.swd-hint {
  margin: 0;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-tertiary);
}
.swd-hint::before {
  content: "";
  display: inline-block;
  width: 0.4rem;
  height: 0.4rem;
  margin-inline-end: 0.55rem;
  border-radius: 50%;
  background: var(--swd-accent);
  vertical-align: middle;
}

.swd-band { border-block-end: 1px solid var(--line); }
`;
