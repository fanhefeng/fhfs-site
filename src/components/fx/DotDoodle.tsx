"use client";

import { useEffect, useMemo, useRef } from "react";
import { GLYPH_GRID, glyphFor } from "@/lib/dotGlyphs";
// Not a WebGL scene, but the reduce-motion question is the same one, and the
// answer should not drift from the two scenes that already ask it.
import { prefersReducedMotion } from "@/lib/three/guards";

/** Gap between two glyph squares, in grid cells. */
const LETTER_GAP = 1.35;

/* ---- resting state: every dot drifts, the name hides inside the noise ---- */

/** Glyph dots at rest. Wide and low on purpose — a glyph dot that stayed lit
 *  would spell the name out permanently and leave the hover nothing to do. */
const GLYPH_ALPHA: readonly [number, number] = [0.62, 0.97];
/** Noise dots at rest. The ceiling deliberately reaches into GLYPH_ALPHA:
 *  dots that occasionally match a stroke are what blur the letterform. */
const NOISE_ALPHA: readonly [number, number] = [0.12, 0.82];
/** >1 skews the drift dark, so the field keeps depth instead of reading as
 *  one flat grey. */
const NOISE_GAMMA = 1.3;
const GLYPH_RADIUS = 0.375;
const NOISE_RADIUS: readonly [number, number] = [0.24, 0.36];
/** Corner dots shrink and dim toward the square's edge — the whole reason the
 *  resting field reads as organic rather than as a printed sheet. */
const FALLOFF = 0.45;
/** Mean number of accent-tinted dots per glyph square. */
const ACCENT_PER_BLOCK = 1.4;

/* ---- hover: the noise collapses and the name surfaces ---- */

const HOVER_QUIET_ALPHA = 0.17;
const HOVER_QUIET_RADIUS = 0.33;
const HOVER_GLYPH_ALPHA = 0.86;
/** Measured off the original: entering is not a monotone ease — the field
 *  collapses within the first sixth, rebounds past the target, then settles. */
const HOVER_ENTER_MS = 1000;
const HOVER_LEAVE_MS = 700;

/**
 * Frames per second once the hover transition has settled — which, on a page
 * nobody is pointing at, is the state this field spends its whole life in.
 *
 * The resting drift is two detuned sines per dot at 0.35–2.0 Hz, and the
 * surfaced state only keeps a ±5% breath on the glyph radius (±0.2px at this
 * size). Sampling either of those at the display's refresh rate buys the same
 * picture four times: measured on a 120 Hz panel, the untouched wordmark was
 * drawing 147 dots 120 times a second, forever, having never been pointed at.
 *
 * That is exactly the bill globals.css documents against the aurora — the
 * compositor never reaches a still frame, and the cost is per *frame*, not per
 * pixel — with a full main-thread canvas repaint stacked on top of it. The
 * settling transition is left at full rate for the same reason Workstation
 * does not throttle a drag: it is the part a visitor is actually watching.
 *
 * Everything time-based reads absolute `elapsed`, so the motion keeps its
 * real-world speed at either cadence; only the sampling gets coarser.
 */
const IDLE_FPS = 30;
const IDLE_FRAME_MS = 1000 / IDLE_FPS;

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (t: number) => t * t * (3 - 2 * t);
/** The rebound above. May briefly exceed 1 — callers clamp what they use it for. */
const dampedSettle = (t: number) =>
  t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.exp(-5.5 * t) * Math.cos(5.2 * t);

type Rgb = [number, number, number];

/**
 * Reads `#rgb`, `#rrggbb` and `rgb()/rgba()` — the two shapes the theme tokens
 * actually take (hex in the stylesheet, `rgb()` once resolved through
 * `getComputedStyle`). Alpha is dropped: every dot carries its own.
 */
function parseColor(input: string, fallback: Rgb): Rgb {
  const value = input.trim();
  if (!value) return fallback;

  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      const n = Number.parseInt(hex, 16);
      if (Number.isNaN(n)) return fallback;
      const r = (n >> 8) & 0xf;
      const g = (n >> 4) & 0xf;
      const b = n & 0xf;
      return [r * 17, g * 17, b * 17];
    }
    if (hex.length >= 6) {
      const n = Number.parseInt(hex.slice(0, 6), 16);
      if (Number.isNaN(n)) return fallback;
      return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
    }
    return fallback;
  }

  const nums = value.match(/-?\d*\.?\d+/g);
  if (!nums || nums.length < 3) return fallback;
  return [Number(nums[0]), Number(nums[1]), Number(nums[2])];
}

type Palette = { ink: Rgb; accents: Rgb[] };

/**
 * The live theme, read off CSS rather than hard-coded: `ink` is the canvas's
 * own `color` (set to `--fg` by the class below), the accents are derived from
 * the warm tokens. Re-read whenever `data-theme` flips.
 *
 * Accents stay inside the site's amber family — the original's random rainbow
 * dots would fight an editorial palette this warm. Each token is also mixed
 * partway back toward the ink so the tinted dots read as *tinted*, not as
 * stickers dropped onto the grid.
 */
function readPalette(canvas: HTMLCanvasElement): Palette {
  const ink = parseColor(getComputedStyle(canvas).color, [255, 255, 255]);
  const root = getComputedStyle(document.documentElement);
  const accent = parseColor(root.getPropertyValue("--accent"), [180, 83, 9]);
  const warm = parseColor(root.getPropertyValue("--glow-warm"), [255, 184, 107]);

  const toward = (c: Rgb, k: number): Rgb => [
    lerp(c[0], ink[0], k),
    lerp(c[1], ink[1], k),
    lerp(c[2], ink[2], k),
  ];

  return {
    ink,
    accents: [accent, warm, toward(accent, 0.35), toward(warm, 0.45), toward(accent, 0.6)],
  };
}

type Accent = { rgb: Rgb; born: number; life: number };

type Cell = {
  block: number;
  row: number;
  col: number;
  /** Part of the letterform. */
  on: boolean;
  /** Radial falloff for this cell, 1 at the square's centre. */
  falloff: number;
  /** Two detuned sines per cell — cheap noise that never visibly loops. */
  p1: number;
  p2: number;
  f1: number;
  f2: number;
  introDelay: number;
  accent: Accent | null;
};

function buildCells(text: string): { cells: Cell[]; blocks: number } {
  const chars = [...text];
  const cells: Cell[] = [];
  const mid = (GLYPH_GRID - 1) / 2;

  chars.forEach((char, block) => {
    const glyph = glyphFor(char);
    for (let row = 0; row < GLYPH_GRID; row++) {
      for (let col = 0; col < GLYPH_GRID; col++) {
        const dx = (col - mid) / mid;
        const dy = (row - mid) / mid;
        const dist = Math.min(1, Math.hypot(dx, dy) / Math.SQRT2);
        cells.push({
          block,
          row,
          col,
          on: glyph[row]?.[col] === "#",
          falloff: 1 - FALLOFF * Math.pow(dist, 1.5),
          p1: Math.random() * Math.PI * 2,
          p2: Math.random() * Math.PI * 2,
          f1: 0.35 + Math.random() * 0.55,
          f2: 0.9 + Math.random() * 1.1,
          introDelay: dist * 0.35 + Math.random() * 0.45,
          accent: null,
        });
      }
    }
  });

  return { cells, blocks: chars.length };
}

type Props = {
  /** Rendered as dots. Unmapped characters come out blank — see `dotGlyphs`. */
  text: string;
  className?: string;
};

/**
 * The wordmark, set in a dot matrix that hides it.
 *
 * At rest every dot — the letterform's included — drifts through its own slow
 * brightness walk, so the name is only ever half-legible, with a few dots
 * tinted from the site's amber tokens and swapping places every few seconds.
 * Point at it and the drift collapses: the noise flattens to one quiet grid,
 * the tints retire, the radial falloff lets go, and the name surfaces. Take
 * the pointer away and the field breathes back out.
 *
 * Purely decorative — `aria-hidden`, so the caller has to carry the text for
 * assistive tech (on /about the `<h1>` keeps it in an `sr-only` span).
 *
 * Brightness is alpha, never a grey value: the dots are all one colour (the
 * canvas's own `--fg`) at varying opacity, which is what lets the same code
 * sit on paper and on ink without a second palette.
 *
 * Reduced motion gets the surfaced state, held still — the name plainly
 * readable, which is the accessible outcome anyway.
 *
 * It is a canvas that never stops, so it owes the same energy contract as the
 * two WebGL scenes: off screen or backgrounded it stops outright, and at rest
 * it samples at `IDLE_FPS` rather than at the display's refresh rate.
 */
export function DotDoodle({ text, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Drives the CSS box, so it has to agree with the layout the loop computes.
  const aspect = useMemo(() => {
    const n = Math.max([...text].length, 1);
    return (n * GLYPH_GRID + (n - 1) * LETTER_GAP) / GLYPH_GRID;
  }, [text]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    const { cells, blocks } = buildCells(text);
    const noise = cells.filter((c) => !c.on);
    // Grouped so the tinted dots spread across the whole word instead of
    // clustering in whichever square won the draw.
    const noiseByBlock: Cell[][] = Array.from({ length: blocks }, () => []);
    for (const c of noise) noiseByBlock[c.block]?.push(c);

    let palette = readPalette(canvas);

    /* ---- tinted dots: born staggered, retired and replaced on a timer ---- */
    const spawnAccent = (born: number, block: number) => {
      const pool = noiseByBlock[block]?.filter((c) => !c.accent);
      if (!pool || pool.length === 0) return;
      const cell = pool[Math.floor(Math.random() * pool.length)];
      if (!cell) return;
      cell.accent = {
        rgb: palette.accents[
          Math.floor(Math.random() * palette.accents.length)
        ] ?? [180, 83, 9],
        born,
        life: 7 + Math.random() * 9,
      };
    };
    const total = Math.round(ACCENT_PER_BLOCK * blocks);
    for (let i = 0; i < total; i++) spawnAccent(Math.random() * -10, i % blocks);

    /* ---- layout, recomputed on resize only ---- */
    let cssW = 0;
    let cssH = 0;
    let cell = 0;
    let originX = 0;
    let originY = 0;

    const layout = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      cssW = rect.width;
      cssH = rect.height;
      if (cssW <= 0 || cssH <= 0) return false;

      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cols = blocks * GLYPH_GRID + (blocks - 1) * LETTER_GAP;
      cell = Math.min(cssW / cols, cssH / GLYPH_GRID);
      originX = (cssW - cols * cell) / 2;
      originY = (cssH - GLYPH_GRID * cell) / 2;
      return true;
    };

    /* ---- state the loop reads ---- */
    let hovered = reduced; // reduced motion opens already surfaced
    let hoverT = reduced ? 1 : 0;
    let elapsed = 0;
    let startedAt = 0;
    let lastFrameAt = 0;
    let raf = 0;
    let running = false;
    let visible = false;

    const draw = (t: number) => {
      if (cell <= 0) return;

      // Reduced motion holds one frame; pick a phase where the drift happens
      // to look settled rather than mid-flicker.
      const time = reduced ? 3.7 : t;
      const h = hovered ? dampedSettle(hoverT) : smoothstep(hoverT);
      const step = (GLYPH_GRID + LETTER_GAP) * cell;
      const { ink } = palette;

      ctx.clearRect(0, 0, cssW, cssH);

      for (const c of cells) {
        // Retire a tint that has served its time and light another.
        if (c.accent && t - c.accent.born >= c.accent.life) {
          c.accent = null;
          spawnAccent(t, c.block);
        }

        let intro = 1;
        if (!reduced) {
          intro = clamp((t - c.introDelay) / 0.7, 0, 1);
          intro = 1 - Math.pow(1 - intro, 3);
          if (intro <= 0) continue;
        }

        const n =
          0.5 +
          0.5 *
            (0.62 * Math.sin(time * c.f1 + c.p1) +
              0.38 * Math.sin(time * c.f2 + c.p2));

        // Hovering also retires the falloff: the square flattens into an even
        // matrix, which is what makes the surfaced name read as deliberate.
        const fall = lerp(c.falloff, 1, h);

        let alpha: number;
        let radius: number;
        if (c.on) {
          alpha = lerp(
            lerp(GLYPH_ALPHA[0], GLYPH_ALPHA[1], n),
            HOVER_GLYPH_ALPHA,
            h
          );
          alpha *= 0.85 + 0.15 * fall;
          radius = GLYPH_RADIUS * cell * (0.95 + 0.05 * n) * (0.82 + 0.18 * fall);
        } else {
          const nd = Math.pow(n, NOISE_GAMMA);
          alpha =
            lerp(
              lerp(NOISE_ALPHA[0], NOISE_ALPHA[1], nd),
              HOVER_QUIET_ALPHA,
              h
            ) * fall;
          radius =
            lerp(lerp(NOISE_RADIUS[0], NOISE_RADIUS[1], nd), HOVER_QUIET_RADIUS, h) *
            cell *
            (0.78 + 0.22 * fall);
        }

        let rgb = ink;
        if (c.accent) {
          const age = t - c.accent.born;
          // Fade in and out, and step aside entirely while surfaced.
          const fade =
            clamp(Math.min(age / 1.2, (c.accent.life - age) / 1.2), 0, 1) *
            (1 - h);
          if (fade > 0) {
            const a = c.accent.rgb;
            rgb = [
              lerp(ink[0], a[0], fade),
              lerp(ink[1], a[1], fade),
              lerp(ink[2], a[2], fade),
            ];
            alpha = lerp(alpha, 0.55 + 0.3 * n, fade);
            radius *= 1 + 0.1 * fade;
          }
        }

        const x = originX + c.block * step + (c.col + 0.5) * cell;
        const y = originY + (c.row + 0.5) * cell;

        ctx.fillStyle = `rgba(${rgb[0] | 0}, ${rgb[1] | 0}, ${rgb[2] | 0}, ${clamp(alpha * intro, 0, 1)})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0, radius) * intro, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const frame = () => {
      if (!running) return;
      // Scheduled first, so the early return below skips a *frame* rather than
      // the loop: at rest this is the branch that runs almost every time.
      raf = requestAnimationFrame(frame);

      const now = performance.now();
      // Full rate only while the hover transition is still moving (see
      // IDLE_FPS). Returning early leaves `lastFrameAt` untouched, so the
      // skipped time lands in the next `dt` and the transition keeps its real
      // duration whichever cadence it started on.
      const settling = hovered ? hoverT < 1 : hoverT > 0;
      if (!settling && now - lastFrameAt < IDLE_FRAME_MS) return;

      // A tab switch must not dump a multi-second delta into the transition.
      const dt = Math.min(now - lastFrameAt, 100);
      lastFrameAt = now;
      hoverT = clamp(
        hoverT + (hovered ? dt / HOVER_ENTER_MS : -dt / HOVER_LEAVE_MS),
        0,
        1
      );
      elapsed = now / 1000 - startedAt;
      draw(elapsed);
    };

    const start = () => {
      if (running || reduced) return;
      running = true;
      const now = performance.now();
      startedAt = now / 1000 - elapsed;
      lastFrameAt = now;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    /** Runs only while on screen, in a foreground tab — same contract as the
     *  heavier scenes on this site. */
    const sync = () => {
      if (visible && !document.hidden) start();
      else stop();
    };

    if (!layout()) {
      // No box yet (a route transition still covering the outgoing tree).
      // The ResizeObserver below fires as soon as there is one.
    } else if (reduced) {
      draw(0);
    }

    const onEnter = () => {
      hovered = true;
      // The transition still has to run under reduced motion's held frame —
      // except there is nothing to run: it opens surfaced and stays there.
      if (!reduced) start();
    };
    const onLeave = () => {
      hovered = false;
      if (!reduced) start();
    };
    canvas.addEventListener("pointerenter", onEnter);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointercancel", onLeave);

    const ro = new ResizeObserver(() => {
      if (layout() && (reduced || !running)) draw(elapsed);
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false;
        sync();
      },
      { rootMargin: "100px" }
    );
    io.observe(canvas);

    document.addEventListener("visibilitychange", sync);

    // The reader flipped the lamp: re-read the tokens and re-tint the dots
    // that are currently lit, so nothing keeps a colour from the old theme.
    const themeObserver = new MutationObserver(() => {
      palette = readPalette(canvas);
      for (const c of cells) {
        if (!c.accent) continue;
        c.accent.rgb =
          palette.accents[Math.floor(Math.random() * palette.accents.length)] ??
          c.accent.rgb;
      }
      if (reduced || !running) draw(elapsed);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", sync);
      canvas.removeEventListener("pointerenter", onEnter);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointercancel", onLeave);
    };
  }, [text]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`block text-fg ${className ?? ""}`}
      style={{ aspectRatio: String(aspect) }}
    />
  );
}
