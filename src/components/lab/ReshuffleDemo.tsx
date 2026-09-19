"use client";

import { useCallback, useRef, useState, type CSSProperties } from "react";
import { useGSAP } from "@/lib/gsap";
import { captureGrid, playGrid, type GridState } from "@/lib/flipGrid";
import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  label: string;
  lede: string;
  filterName: string;
  ariaLabel: string;
  all: string;
  round: string;
  square: string;
  line: string;
  motionName: string;
  motionAria: string;
  motionSite: string;
  motionSlow: string;
  motionNone: string;
  /** Before the first filter: nothing has moved yet. */
  readoutIdle: string;
  /** After one, with `{stay}`, `{enter}` and `{leave}` for the three counts. */
  readout: string;
  /** The same, for a change made with the animation switched off. */
  readoutNone: string;
  note: string;
};

type Kind = "round" | "square" | "line";
type Filter = "all" | Kind;
/** As on the site, four times slower so a tile can be followed, or not at all. */
type Motion = "site" | "slow" | "none";
type Tally = { stay: number; enter: number; leave: number; motion: Motion };

/** Nine tiles, three of each kind, dealt so no kind sits in a row. */
const TILES: { id: number; kind: Kind; hue: number }[] = [
  { id: 1, kind: "round", hue: 24 },
  { id: 2, kind: "square", hue: 200 },
  { id: 3, kind: "line", hue: 150 },
  { id: 4, kind: "square", hue: 280 },
  { id: 5, kind: "line", hue: 40 },
  { id: 6, kind: "round", hue: 330 },
  { id: 7, kind: "line", hue: 210 },
  { id: 8, kind: "round", hue: 90 },
  { id: 9, kind: "square", hue: 10 },
];

const SLOW = 4;

const shows = (filter: Filter, kind: Kind) => filter === "all" || filter === kind;

/**
 * The grid's reshuffle, the way /software filters its apps. Every tile stays
 * in the DOM and the filter only toggles display; the layout is captured
 * *before* React re-renders and Flip replays the difference afterwards, so
 * the tiles that survive slide from where they were instead of teleporting
 * into a fresh layout — the point is that you can follow a tile with your
 * eye. The filter buttons are plain on purpose: the pill that slides in the
 * segmented control is its own study.
 *
 * The second row of buttons is not a second effect but this one's slow
 * motion and its absence: with the animation off the same filter teleports
 * the tiles, which is the problem the effect exists to solve. The line over
 * the grid counts what the last change did — how many slid, entered, left.
 */
export function ReshuffleDemo({
  accent,
  label,
  lede,
  filterName,
  ariaLabel,
  all,
  round,
  square,
  line,
  motionName,
  motionAria,
  motionSite,
  motionSlow,
  motionNone,
  readoutIdle,
  readout,
  readoutNone,
  note,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [motion, setMotion] = useState<Motion>("site");
  const [tally, setTally] = useState<Tally | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  /** Layout captured in the click handler, consumed by the layout effect. */
  const pending = useRef<{ state: GridState; slow: number } | null>(null);

  const options: { value: Filter; label: string }[] = [
    { value: "all", label: all },
    { value: "round", label: round },
    { value: "square", label: square },
    { value: "line", label: line },
  ];
  const motions: { value: Motion; label: string }[] = [
    { value: "site", label: motionSite },
    { value: "slow", label: motionSlow },
    { value: "none", label: motionNone },
  ];

  const change = useCallback(
    (next: Filter) => {
      if (next === filter) return;
      const grid = gridRef.current;
      // Captured even with the animation off: the capture is also what
      // finishes and clears a reshuffle that is still in flight.
      const state = grid ? captureGrid(grid.querySelectorAll("[data-tile]")) : null;
      pending.current =
        state && motion !== "none" ? { state, slow: motion === "slow" ? SLOW : 1 } : null;
      const count = (was: boolean, is: boolean) =>
        TILES.filter((t) => shows(filter, t.kind) === was && shows(next, t.kind) === is).length;
      setTally({
        stay: count(true, true),
        enter: count(false, true),
        leave: count(true, false),
        motion,
      });
      setFilter(next);
    },
    [filter, motion],
  );

  // Layout phase, after the filter's render: the new places never paint
  // before Flip pins the tiles back to the old ones. No `revertOnUpdate` —
  // `captureGrid` says why.
  useGSAP(
    () => {
      const flip = pending.current;
      if (!flip) return;
      pending.current = null;
      playGrid(flip.state, { slow: flip.slow });
    },
    { dependencies: [filter], scope: gridRef },
  );

  const said = tally
    ? (tally.motion === "none" ? readoutNone : readout)
        .replace("{stay}", String(tally.stay))
        .replace("{enter}", String(tally.enter))
        .replace("{leave}", String(tally.leave))
    : readoutIdle;

  return (
    <StudyPanel accent={accent} label={label} lede={lede} note={note}>
      <style href="lab-reshuffle" precedence="medium">
        {DEMO_CSS}
      </style>

      <div className="spn-fields">
        <div className="spn-field">
          <p className="spn-field-name">{filterName}</p>
          <div role="group" aria-label={ariaLabel} className="rsd-filter">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={filter === o.value}
                className="rsd-chip"
                onClick={() => change(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="spn-field">
          <p className="spn-field-name">{motionName}</p>
          <div role="group" aria-label={motionAria} className="rsd-filter">
            {motions.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={motion === o.value}
                className="rsd-chip"
                onClick={() => setMotion(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="spn-readout" aria-live="polite">
        {said}
      </p>

      <div className="rsd-board">
        {/* The nine places, drawn under the tiles: an emptied one stays on
            the page, so where a tile came from can still be seen. */}
        <div className="rsd-grid rsd-slots" aria-hidden="true">
          {TILES.map((tile) => (
            <span key={tile.id} className="rsd-slot" />
          ))}
        </div>
        <div ref={gridRef} className="rsd-grid">
          {TILES.map((tile) => (
            <div
              key={tile.id}
              data-tile
              className={`rsd-tile rsd-tile--${tile.kind}`}
              style={
                {
                  "--tile-hue": tile.hue,
                  display: shows(filter, tile.kind) ? undefined : "none",
                } as CSSProperties
              }
            >
              <span className="rsd-shape" aria-hidden="true" />
              <span className="rsd-id">{String(tile.id).padStart(2, "0")}</span>
            </div>
          ))}
        </div>
      </div>
    </StudyPanel>
  );
}

const DEMO_CSS = `
/* Plain toggles — no indicator, nothing that slides but the tiles. */
.rsd-filter { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.rsd-chip {
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
.rsd-chip:hover { color: var(--fg); }
.rsd-chip[aria-pressed="true"] { border-color: var(--spn-accent); color: var(--spn-accent); }

/* Three rows whatever the filter leaves: what is under the grid stays put
   instead of jumping two rows up while the tiles are still sliding. */
.rsd-board { position: relative; width: min(100%, 36rem); }
.rsd-grid.rsd-slots { position: absolute; inset: 0; }
.rsd-slot { aspect-ratio: 1; border: 1px dashed var(--line); border-radius: 18px; }
.rsd-grid {
  /* Flip's absolute pass positions the tiles against this. */
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-content: start;
  gap: 1rem;
  width: 100%;
  aspect-ratio: 1;
}
@media (min-width: 640px) { .rsd-grid { gap: 1.25rem; } }

.rsd-tile {
  position: relative;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--surface);
  will-change: transform;
}
.rsd-shape {
  display: block;
  width: 42%;
  aspect-ratio: 1;
  background: oklch(0.72 0.12 var(--tile-hue));
}
.rsd-tile--round .rsd-shape { border-radius: 50%; }
.rsd-tile--square .rsd-shape { border-radius: 14%; }
.rsd-tile--line .rsd-shape { height: 10%; aspect-ratio: auto; width: 56%; border-radius: 999px; }
.rsd-id {
  position: absolute;
  left: 0.9rem;
  top: 0.75rem;
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.1em;
  color: var(--fg-tertiary);
}
`;
