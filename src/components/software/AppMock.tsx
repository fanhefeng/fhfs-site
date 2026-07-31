import { mockAccent, type SoftwareApp } from "./appMeta";

type Tone = "light" | "dark";

type Props = {
  app: SoftwareApp;
  /** `window` draws a title bar with traffic lights; `bare` is for phones. */
  chrome?: "window" | "bare";
  /** Accessible description ("Schematic of the … interface"). */
  label: string;
  className?: string;
};

/**
 * Per-tone ink for the schematic. Deliberately *not* the site tokens: this
 * stands in for a screenshot, so it keeps its own flat product-UI palette in
 * both themes instead of dissolving into the page around it.
 */
const TONE: Record<Tone, Record<string, string>> = {
  light: {
    bg: "#ffffff",
    chrome: "#f1efe9",
    line: "rgba(26,26,26,0.10)",
    bar: "rgba(26,26,26,0.13)",
    barStrong: "rgba(26,26,26,0.30)",
    tint: "rgba(26,26,26,0.045)",
  },
  dark: {
    bg: "#17171b",
    chrome: "#212128",
    line: "rgba(255,255,255,0.09)",
    bar: "rgba(255,255,255,0.14)",
    barStrong: "rgba(255,255,255,0.34)",
    tint: "rgba(255,255,255,0.05)",
  },
};

/** A rounded bar standing in for a line of UI text. */
function Bar({ w, color, h = 4 }: { w: string; color: string; h?: number }) {
  return (
    <span
      className="block shrink-0 rounded-full"
      style={{ width: w, height: h, background: color }}
    />
  );
}

/* Black keys sit over the seams between white keys — precomputed so the
 * keyboard reads right at any width (9 keys, 1.5% gaps, 5% wide sharps). */
const SHARPS = [8, 19.3, 41.9, 53.1, 64.4];

function Body({ app, tone }: { app: SoftwareApp; tone: Tone }) {
  const c = TONE[tone];
  const accent = mockAccent(app.hue, tone);

  if (app.category === "game") {
    // Keyboard Piano: an equalizer of struck notes over a lit octave.
    return (
      <div className="flex h-full flex-col justify-between p-[6%]">
        <div className="flex h-[32%] items-end gap-[3%]">
          {[40, 72, 52, 90, 62, 34].map((h, i) => (
            <span
              key={i}
              className="block flex-1 rounded-full"
              style={{
                height: `${h}%`,
                minHeight: 3,
                background: i % 2 === 0 ? accent : c.bar,
              }}
            />
          ))}
        </div>
        <div className="relative flex h-[48%] gap-[1.5%]">
          {Array.from({ length: 9 }, (_, i) => (
            <span
              key={i}
              className="block flex-1 rounded-b-[3px]"
              style={{
                background: i === 2 || i === 6 ? accent : c.bar,
                opacity: i === 2 || i === 6 ? 0.9 : 0.7,
              }}
            />
          ))}
          {SHARPS.map((left) => (
            <span
              key={left}
              className="absolute top-0 h-[62%] w-[5%] rounded-b-[2px]"
              style={{ left: `${left}%`, background: c.barStrong }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (app.category === "website") {
    // A links directory: a header rule over a grid of tiles.
    return (
      <div className="flex h-full flex-col gap-2 p-[6%]">
        <div className="flex shrink-0 items-center justify-between">
          <Bar w="26%" color={c.barStrong} h={5} />
          <Bar w="14%" color={accent} h={5} />
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-1.5">
          {Array.from({ length: 6 }, (_, i) => {
            const lit = i === 1 || i === 4;
            return (
              <span
                key={i}
                className="flex flex-col justify-end rounded-[4px] p-[10%]"
                style={{
                  background: lit ? accent : c.tint,
                  border: `1px solid ${lit ? "transparent" : c.line}`,
                  opacity: lit ? 0.9 : 1,
                }}
              >
                <Bar w="70%" color={lit ? "rgba(255,255,255,0.85)" : c.bar} h={3} />
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  if (app.category === "tool") {
    // A CLI log: prompt line in accent, output lines, a job bar at the foot.
    return (
      <div className="flex h-full flex-col gap-2 p-[6%]">
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="block size-2 shrink-0 rounded-[2px]"
            style={{ background: accent }}
          />
          <Bar w="38%" color={c.barStrong} h={4} />
        </div>
        {["72%", "54%", "63%", "40%", "58%"].map((w, i) => (
          <Bar key={w + i} w={w} color={c.bar} />
        ))}
        <span
          className="mt-auto block h-1.5 w-full shrink-0 overflow-hidden rounded-full"
          style={{ background: c.tint }}
        >
          <span
            className="block h-full rounded-full"
            style={{ width: "62%", background: accent }}
          />
        </span>
      </div>
    );
  }

  // desktop — sidebar + content pane, the shape of every Mac utility.
  return (
    <div className="flex h-full">
      <div
        className="flex w-[26%] shrink-0 flex-col gap-2 p-[7%]"
        style={{ background: c.chrome, borderRight: `1px solid ${c.line}` }}
      >
        <Bar w="70%" color={accent} h={4} />
        {["82%", "60%", "74%", "52%"].map((w, i) => (
          <Bar key={w + i} w={w} color={c.bar} h={3} />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-[5%]">
        <div className="flex shrink-0 items-center justify-between">
          <Bar w="34%" color={c.barStrong} h={5} />
          <span
            className="block h-2 w-[18%] rounded-full"
            style={{ background: accent, opacity: 0.9 }}
          />
        </div>
        <span
          className="block min-h-0 flex-1 rounded-[5px]"
          style={{
            background: `linear-gradient(150deg, ${accent}, transparent 78%), ${c.tint}`,
            border: `1px solid ${c.line}`,
          }}
        />
        <div className="flex shrink-0 gap-2">
          {["30%", "22%", "26%"].map((w, i) => (
            <Bar key={w + i} w={w} color={c.bar} h={4} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Face({
  app,
  tone,
  chrome,
}: {
  app: SoftwareApp;
  tone: Tone;
  chrome: "window" | "bare";
}) {
  const c = TONE[tone];
  return (
    <div
      aria-hidden
      className="absolute inset-0 flex flex-col"
      style={{ background: c.bg }}
    >
      {chrome === "window" && (
        <div
          className="flex h-[8%] max-h-6 min-h-[14px] shrink-0 items-center gap-1 px-2"
          style={{ background: c.chrome, borderBottom: `1px solid ${c.line}` }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block size-1.5 rounded-full"
              style={{ background: c.bar }}
            />
          ))}
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        <Body app={app} tone={tone} />
      </div>
    </div>
  );
}

/**
 * State-aware "screenshot" (after jh3y's state-aware product cards): two
 * complete UI schematics — one drawn for daylight, one for after hours —
 * stacked, with the dark one crossing over the light one across 1.2s whenever
 * the gallery lights change.
 *
 * There are no screenshot assets in this repo, so both faces are drawn in CSS
 * from the app's accent hue. That also means there is nothing to preload and
 * no JS at all: the swap rides the `dark:` variant (which resolves to
 * `[data-theme="dark"]`), so it follows the LightSwitch's `fhfs:theme` update
 * exactly, plays inside its `startViewTransition`, and costs zero runtime
 * bytes. Reduced motion lands on the end state instantly.
 */
export function AppMock({ app, chrome = "window", label, className }: Props) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`relative overflow-hidden ${className ?? ""}`}
    >
      <Face app={app} tone="light" chrome={chrome} />
      {/* Only the top face's opacity moves, so the two never show through
       * each other half-way. */}
      <div className="absolute inset-0 opacity-0 transition-opacity duration-[1200ms] ease-[cubic-bezier(0.42,0,0.58,1)] motion-reduce:transition-none dark:opacity-100">
        <Face app={app} tone="dark" chrome={chrome} />
      </div>
    </div>
  );
}
