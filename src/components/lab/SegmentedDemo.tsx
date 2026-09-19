"use client";

import { useMemo, useState } from "react";
import { SegmentedFilter, type Segment } from "@/components/software/SegmentedFilter";
import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  label: string;
  ariaLabel: string;
  all: string;
  writing: string;
  software: string;
  lab: string;
  selected: string;
  keyNote: string;
};

/**
 * The segmented control on its own. The selected pill is one element that
 * Flips from the slot it was in to the slot it is going to, so the control
 * reads as one physical part sliding rather than a highlight appearing in a
 * new place. The readout under it only names the value — the study is the
 * slide, and the grid that reshuffles on the software page is its own.
 */
export function SegmentedDemo({
  accent,
  label,
  ariaLabel,
  all,
  writing,
  software,
  lab,
  selected,
  keyNote,
}: Props) {
  const [value, setValue] = useState("all");
  const options = useMemo<Segment[]>(
    () => [
      { value: "all", label: all },
      { value: "writing", label: writing },
      { value: "software", label: software },
      { value: "lab", label: lab },
    ],
    [all, writing, software, lab],
  );
  const current = options.find((o) => o.value === value)?.label ?? all;

  return (
    <StudyPanel accent={accent} label={label} note={keyNote}>
      <style href="lab-segmented" precedence="medium">
        {DEMO_CSS}
      </style>
      <div className="spn-control">
        <SegmentedFilter
          options={options}
          value={value}
          onChange={setValue}
          ariaLabel={ariaLabel}
        />
      </div>
      <p className="sgd-readout" aria-live="polite">
        <span className="sgd-readout-label">{selected}</span>
        <span className="sgd-readout-value">{current}</span>
      </p>
    </StudyPanel>
  );
}

const DEMO_CSS = `
.sgd-readout { margin: 0; display: flex; align-items: baseline; gap: 0.75rem; }
.sgd-readout-label {
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-tertiary);
}
.sgd-readout-value {
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--fg);
}
`;
