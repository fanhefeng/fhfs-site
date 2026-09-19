"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KobeStatueStage } from "@/components/idols/KobeStatueStage";
import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  label: string;
  lede: string;
  viewName: string;
  viewAria: string;
  viewBronze: string;
  viewWire: string;
  frameLabel: string;
  stateDrawing: string;
  stateIdle: string;
  note: string;
  /** The stage's own strings and stand-in photograph, as on /idols/kobe. */
  dragHint: string;
  loading: string;
  fallbackNote: string;
  fallback: { src: string; width: number; height: number; alt: string };
  turnLeft: string;
  turnRight: string;
};

type View = "bronze" | "wire";

/** How long after the last frame the meter says the scene has stopped. */
const IDLE_MS = 220;

/**
 * The statue from /idols/kobe, with the two things that make it a study put
 * where they can be seen — on the idols page neither shows. That it is built
 * of capsules: the wireframe view strips the bronze off. That it renders on
 * demand: a meter counts the frames actually drawn, which climbs while the
 * figure turns and stops dead when it does.
 *
 * The count is written straight into the DOM. A frame is the one thing here
 * that must not cost a React render — sixty `setState`s a second to report
 * that nothing else is happening would be its own small joke.
 */
export function StatueDemo({
  accent,
  label,
  lede,
  viewName,
  viewAria,
  viewBronze,
  viewWire,
  frameLabel,
  stateDrawing,
  stateIdle,
  note,
  dragHint,
  loading,
  fallbackNote,
  fallback,
  turnLeft,
  turnRight,
}: Props) {
  const [view, setView] = useState<View>("bronze");
  const views = useMemo<{ value: View; label: string }[]>(
    () => [
      { value: "bronze", label: viewBronze },
      { value: "wire", label: viewWire },
    ],
    [viewBronze, viewWire],
  );

  const frames = useRef(0);
  const meter = useRef<HTMLParagraphElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  const idle = useRef<number | undefined>(undefined);

  const onFrame = useCallback(() => {
    frames.current += 1;
    if (count.current) count.current.textContent = String(frames.current);
    if (meter.current) meter.current.dataset.live = "true";
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => {
      if (meter.current) meter.current.dataset.live = "false";
    }, IDLE_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(idle.current), []);

  return (
    <StudyPanel accent={accent} label={label} lede={lede} note={note}>
      <style href="lab-statue" precedence="medium">
        {DEMO_CSS}
      </style>

      <div className="spn-fields">
        <div className="spn-field">
          <p className="spn-field-name">{viewName}</p>
          {/* Plain toggles, as in the reshuffle study: a pill that slides
              between them is study 22's effect, not this one's. */}
          <div role="group" aria-label={viewAria} className="std-views">
            {views.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={view === o.value}
                className="std-view"
                onClick={() => setView(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="std-stage">
        <KobeStatueStage
          hint={dragHint}
          loading={loading}
          fallbackNote={fallbackNote}
          fallback={fallback}
          turnLeft={turnLeft}
          turnRight={turnRight}
          wire={view === "wire"}
          onFrame={onFrame}
        />
      </div>

      {/* Not a live region: it changes sixty times a second while it changes. */}
      <p ref={meter} className="std-meter" data-live="false">
        <span className="std-meter-name">{frameLabel}</span>
        <span ref={count} className="std-meter-count">
          0
        </span>
        <span className="std-meter-state std-meter-state--live">{stateDrawing}</span>
        <span className="std-meter-state std-meter-state--idle">{stateIdle}</span>
      </p>
    </StudyPanel>
  );
}

const DEMO_CSS = `
.std-views { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.std-view {
  min-height: 2.75rem;
  padding: 0 1rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: transparent;
  color: var(--fg-secondary);
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color 0.2s ease-out, color 0.2s ease-out;
}
.std-view:hover { color: var(--fg); }
.std-view[aria-pressed="true"] { border-color: var(--spn-accent); color: var(--spn-accent); }

.std-stage { width: min(100%, 1040px); }

.std-meter {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem 1rem;
  padding-inline-start: 1rem;
  border-inline-start: 2px solid var(--spn-accent);
}
.std-meter-name,
.std-meter-state {
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-tertiary);
}
.std-meter-count {
  min-width: 4ch;
  font-family: var(--font-stack-mono);
  font-size: 2rem;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--fg);
}
.std-meter-state::before {
  content: "";
  display: inline-block;
  width: 0.4rem;
  height: 0.4rem;
  margin-inline-end: 0.5rem;
  border-radius: 50%;
  background: currentColor;
  vertical-align: middle;
}
.std-meter-state--live { display: none; color: var(--spn-accent); }
.std-meter[data-live="true"] .std-meter-state--live { display: inline; }
.std-meter[data-live="true"] .std-meter-state--idle { display: none; }
`;
