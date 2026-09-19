"use client";

import type { CSSProperties, ReactNode } from "react";

type Props = {
  accent: string;
  /** The mono kicker with the accent dot, naming what is on the panel. */
  label: string;
  /** What to do on this panel and what to watch for, said plainly. */
  lede?: string;
  children?: ReactNode;
  /** A line under the demo, in the same mono voice as the label. */
  hint?: string;
  /** A plain sentence under that — the touch note, usually. */
  note?: string;
  className?: string;
};

/**
 * One panel, one effect — the frame the single-effect studies share: a
 * screen's worth of height, the accent-dotted label above, the hint and
 * note below. Each study puts exactly one thing between them; a study that
 * needs a second panel is two studies.
 */
export function StudyPanel({ accent, label, lede, hint, note, children, className }: Props) {
  return (
    <div
      className={`spn${className ? ` ${className}` : ""}`}
      style={{ "--spn-accent": accent } as CSSProperties}
    >
      <style href="lab-panel" precedence="medium">
        {PANEL_CSS}
      </style>
      <section className="spn-panel">
        <p className="spn-label">{label}</p>
        {lede && <p className="spn-body spn-lede">{lede}</p>}
        {children}
        {hint && <p className="spn-hint">{hint}</p>}
        {note && <p className="spn-note">{note}</p>}
      </section>
    </div>
  );
}

const PANEL_CSS = `
.spn { border-block-start: 1px solid var(--line); }

.spn-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2rem;
  min-height: 62svh;
  padding: 4rem clamp(1.5rem, 6vw, 4rem);
  border-block-end: 1px solid var(--line);
}

.spn-label,
.spn-hint {
  margin: 0;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-tertiary);
}
.spn-label::before {
  content: "";
  display: inline-block;
  width: 0.4rem;
  height: 0.4rem;
  margin-inline-end: 0.55rem;
  border-radius: 50%;
  background: var(--spn-accent);
  vertical-align: middle;
}

.spn-note {
  margin: 0;
  max-width: 56ch;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--fg-tertiary);
}
.spn-hint + .spn-note { margin-block-start: -1.25rem; }

/* A sentence about the effect, for the studies whose effect lives off the
   panel (fixed to the viewport, or on the next page). */
.spn-body {
  margin: 0;
  max-width: 56ch;
  font-size: 1.0625rem;
  line-height: 1.65;
  color: var(--fg-secondary);
}

.spn-label + .spn-lede { margin-block-start: -0.75rem; }

/* A knob with its name printed over it, so nobody has to guess what it turns. */
.spn-fields { display: flex; flex-wrap: wrap; gap: 1.25rem 2rem; max-width: 100%; }
.spn-field { display: flex; flex-direction: column; align-items: flex-start; gap: 0.6rem; min-width: 0; max-width: 100%; }
.spn-field-name {
  margin: 0;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-tertiary);
}

/* What the panel is showing right now, in one plain sentence. */
.spn-readout {
  margin: 0;
  max-width: 60ch;
  padding-inline-start: 1rem;
  border-inline-start: 2px solid var(--spn-accent);
  font-size: 1rem;
  line-height: 1.65;
  color: var(--fg);
}

/* A site component mounted as it is, kept to the panel's left edge instead
   of stretching across it. */
.spn-control { display: flex; justify-content: flex-start; }

/* The one control a study may need: a replay, a way back to the door. */
.spn-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  width: fit-content;
  min-height: 2.75rem;
  padding: 0 1rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: transparent;
  color: var(--fg);
  font: inherit;
  font-size: 0.8125rem;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color 0.2s ease-out, color 0.2s ease-out;
}
.spn-btn:hover { border-color: var(--spn-accent); color: var(--spn-accent); }

/* The arrow that points off the panel to where the effect is. */
.spn-arrow {
  margin: 0;
  font-family: var(--font-stack-mono);
  font-size: 1.5rem;
  color: var(--fg-tertiary);
}
`;
