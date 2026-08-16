"use client";

import { useEffect, useRef, useState } from "react";
import { parseColor, type Rgb } from "@/lib/canvasColor";
import { isFinePointer, prefersReducedMotion } from "@/lib/gsap";

/* ---- motion, calibrated against the reference capture ---- */

/**
 * Seconds for a particle's displacement envelope to decay to 1% of where it
 * started — the whole "scattered → legible" arc.
 *
 * `friction` is derived from it rather than tuned by hand. The discrete spring
 * below is `v ← f·(v + e·(target − pos)); pos ← pos + v`, whose state matrix
 * `[[1 − f·e, f], [−f·e, f]]` has determinant `f` exactly. In the underdamped
 * region the two eigenvalues are conjugates, so the envelope's per-frame decay
 * is `√f` — independent of `ease`. That makes this the only knob that changes
 * how long the effect takes, and `ease` purely a question of overshoot.
 *
 * Fitted from the capture: the letterforms resolve at ~0.8s (≈3% residual) and
 * are clean by ~1.2s (≈0.5%), a 1.50 ratio against the 1.51 an exponential
 * predicts, giving `r = 0.03^(1/48) = 0.9295` and ~1.05s to 1%. Rounded up one
 * notch — frame sampling only pins it to ±0.1s.
 */
const SETTLE_SECONDS = 1.1;
/**
 * Spring stiffness, randomised per particle so they do not arrive in lockstep.
 * Small on purpose: at 0.085 the same system overshoots its target by 41% and
 * reads as frantic, which is the opposite of this page's voice. Here it stays
 * near 10%. Must clear `(1 − √f)² / f` (~0.003) or the system leaves the
 * underdamped region and the derivation above stops holding.
 */
const EASE_MIN = 0.012;
const EASE_MAX = 0.028;

const STEP_MS = 1000 / 60;
/** Per-frame decay of the displacement envelope, and the friction it implies. */
const DECAY = Math.pow(0.01, 1 / (SETTLE_SECONDS * 60));
const FRICTION = DECAY * DECAY;

/* ---- pointer ---- */

/** Repulsion reach, in CSS px. */
const POINTER_RADIUS = 90;
const POINTER_POWER = 6.6;
/** How far outside the canvas a pointer still counts as approaching. */
const WAKE_MARGIN = POINTER_RADIUS;

/* ---- sampling ---- */

/**
 * Spacing between sampled dots, in CSS px, by viewport width — the density
 * ladder DESIGN.md §2.7 asks for. Tighter on a big screen, where the line is
 * set larger and a coarse grid would read as gappy.
 */
const GAP_LADDER: readonly [number, number][] = [
  [1024, 5],
  [1600, 4.4],
  [Infinity, 3.8],
];
/**
 * Hard ceiling from DESIGN.md §2.7. The ladder above lands well under it for
 * one line of type at any width this site uses; the loop that enforces it is
 * insurance against a long line at a big size, not the usual path.
 */
const MAX_PARTICLES = 3000;

/**
 * Below this the canvas never mounts — the effect is pointer-driven.
 *
 * Sampling only reads once there are roughly 15 dots across a glyph's body,
 * which is a constraint on what this component can be pointed at: display
 * type is fine (`--text-display` is 40–104px against a ~5px grid), body copy
 * is not, and CJK at body size is hopeless — 3px strokes fall straight
 * through the grid. The floor here is the blunt version of that check.
 */
const MIN_DOTS = 40;

/* ---- rest detection: what "finished" means, in CSS px ---- */

const REST_SPEED = 0.03;
const REST_DISTANCE = 0.08;

type Particle = {
  x: number;
  y: number;
  /** Position at the previous physics step, for render interpolation. */
  px: number;
  py: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  size: number;
  ease: number;
  alpha: number;
  /** Tinted from `--accent` instead of the ink, for a handful of dots. */
  tinted: boolean;
};

type Props = {
  /** The line to render as dots. Also stays in the DOM as real text. */
  text: string;
  /** BCP-47 tag, so the CJK type guards in globals.css apply. */
  lang: string;
  /**
   * The text is already carried by a real heading elsewhere, so hide this copy
   * from assistive tech instead of reading the same thing twice.
   */
  decorative?: boolean;
  className?: string;
};

/**
 * A line of type that assembles itself out of dots, and scatters under the
 * pointer.
 *
 * The text ships as real DOM and stays there: on a touch screen, with JS off,
 * under reduced motion, or when the line wraps to two rows, that paragraph is
 * simply what the reader gets. The canvas is an overlay that only takes over
 * once it can improve on it, and it samples the paragraph's own computed font
 * and box — so the dots land exactly where the glyphs were and nothing shifts
 * when it engages.
 *
 * Energy contract (DESIGN.md §5.3, "still on the last frame, zero ongoing
 * cost"): unlike DotDoodle this animation actually finishes, so it does not
 * idle at a reduced frame rate — it stops the loop outright once every
 * particle is home, leaving the last frame painted, and wakes only when a
 * pointer comes within reach, the box resizes, or the lamp flips.
 */
export function ParticleLine({ text, lang, decorative, className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Flips once the canvas has particles; until then the text carries itself. */
  const [dotted, setDotted] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const textEl = textRef.current;
    const canvas = canvasRef.current;
    if (!host || !textEl || !canvas) return;

    // Pointer-driven, so a touch screen gets the paragraph and nothing else.
    if (!isFinePointer()) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const still = prefersReducedMotion();

    let particles: Particle[] = [];
    let cssW = 0;
    let cssH = 0;
    /** The box the current particles were sampled for — see the observer below. */
    let sampledW = 0;
    let sampledH = 0;
    let dpr = 1;
    let ink: Rgb = [26, 26, 26];
    let accent: Rgb = [180, 83, 9];
    let inkSprite: HTMLCanvasElement | null = null;
    let accentSprite: HTMLCanvasElement | null = null;

    const readPalette = () => {
      ink = parseColor(getComputedStyle(textEl).color, [26, 26, 26]);
      accent = parseColor(
        getComputedStyle(document.documentElement).getPropertyValue("--accent"),
        [180, 83, 9]
      );
    };

    /**
     * Dots are blitted from a pre-rendered sprite rather than stroked as a
     * path each time: an `arc()` per dot re-rasterises and re-antialiases the
     * same circle thousands of times a frame, where `drawImage` is a copy.
     * Each sprite carries a soft edge so the dots read as inked, not plotted.
     */
    const makeSprite = (rgb: Rgb): HTMLCanvasElement => {
      const size = 24;
      const s = document.createElement("canvas");
      s.width = s.height = size;
      const sc = s.getContext("2d");
      if (!sc) return s;
      const r = size / 2;
      const solid = `rgb(${rgb[0] | 0}, ${rgb[1] | 0}, ${rgb[2] | 0})`;
      const g = sc.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0, solid);
      g.addColorStop(0.45, solid);
      g.addColorStop(0.62, `rgba(${rgb[0] | 0}, ${rgb[1] | 0}, ${rgb[2] | 0}, 0.4)`);
      g.addColorStop(1, `rgba(${rgb[0] | 0}, ${rgb[1] | 0}, ${rgb[2] | 0}, 0)`);
      sc.fillStyle = g;
      sc.beginPath();
      sc.arc(r, r, r, 0, Math.PI * 2);
      sc.fill();
      return s;
    };

    const buildSprites = () => {
      inkSprite = makeSprite(ink);
      accentSprite = makeSprite(accent);
    };

    /**
     * Samples the paragraph into dots.
     *
     * The font and the box both come from the live element, so the dots
     * inherit the site's type scale and respond to a locale switch or a font
     * swap without this file knowing anything about either. `seed` carries the
     * previous positions through a resize, which turns a resize into a
     * re-flow rather than a fresh explosion.
     */
    const sample = (seed: Particle[] | null): boolean => {
      const hostRect = host.getBoundingClientRect();
      const textRect = textEl.getBoundingClientRect();
      cssW = hostRect.width;
      cssH = hostRect.height;
      if (cssW <= 0 || cssH <= 0) return false;

      const cs = getComputedStyle(textEl);
      const lineHeight = Number.parseFloat(cs.lineHeight);
      // Two rows of type cannot be sampled from a single centred baseline, and
      // a wrapped line is exactly when the reader most needs the real text.
      if (Number.isFinite(lineHeight) && textRect.height > lineHeight * 1.6) {
        return false;
      }

      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const off = document.createElement("canvas");
      off.width = canvas.width;
      off.height = canvas.height;
      const oc = off.getContext("2d", { willReadFrequently: true });
      if (!oc) return false;
      oc.setTransform(dpr, 0, 0, dpr, 0, 0);
      oc.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      oc.textAlign = "center";
      oc.textBaseline = "middle";
      oc.fillStyle = "#fff";
      // Centre of the paragraph's own box, in the host's coordinates.
      const cx = textRect.left - hostRect.left + textRect.width / 2;
      const cy = textRect.top - hostRect.top + textRect.height / 2;
      oc.fillText(text, cx, cy);

      const data = oc.getImageData(0, 0, off.width, off.height).data;
      const width = off.width;

      let gap =
        GAP_LADDER.find(([limit]) => window.innerWidth < limit)?.[1] ?? 4;

      // Coarsen until the ceiling holds. One line of type never needs this;
      // it is here so an unusually long string cannot blow the budget.
      for (let attempt = 0; attempt < 6; attempt++) {
        const step = gap * dpr;
        const next: Particle[] = [];
        for (let y = 0; y < off.height; y += step) {
          const row = (y | 0) * width;
          for (let x = 0; x < width; x += step) {
            if (data[(row + (x | 0)) * 4 + 3]! < 128) continue;
            // A touch of jitter, or the grid reads as graph paper. Kept small:
            // past ~0.3 of the step the letterforms start to blur.
            const tx = (x + (Math.random() - 0.5) * step * 0.28) / dpr;
            const ty = (y + (Math.random() - 0.5) * step * 0.28) / dpr;
            const old = seed?.[next.length % seed.length];
            next.push({
              x: old ? old.x : Math.random() * cssW,
              y: old ? old.y : Math.random() * cssH,
              px: old ? old.x : 0,
              py: old ? old.y : 0,
              vx: 0,
              vy: 0,
              tx,
              ty,
              size: gap * (0.44 + Math.random() * 0.2),
              ease: EASE_MIN + Math.random() * (EASE_MAX - EASE_MIN),
              alpha: 0.72 + Math.random() * 0.28,
              // A few dots pick up the lamp's amber, the way the wordmark's do.
              tinted: Math.random() < 0.035,
            });
          }
        }
        if (next.length <= MAX_PARTICLES) {
          particles = next;
          break;
        }
        gap *= 1.18;
        particles = next;
      }

      if (particles.length < MIN_DOTS) return false;
      sampledW = cssW;
      sampledH = cssH;

      for (const p of particles) {
        p.px = p.x;
        p.py = p.y;
        if (still) {
          // Nothing to watch assemble: the line is simply already set.
          p.x = p.px = p.tx;
          p.y = p.py = p.ty;
          p.vx = p.vy = 0;
        }
      }
      return true;
    };

    /* ---- loop ---- */

    let raf = 0;
    let running = false;
    // Optimistic: the observer below corrects this on its first callback, which
    // lands a frame later. Starting as `false` would mean the line sits
    // scattered until then, and the assembly is the whole entrance.
    let visible = true;
    let ready = false;
    let acc = 0;
    let last = 0;
    const pointer = { x: 0, y: 0, active: false };

    const physics = () => {
      const r2 = POINTER_RADIUS * POINTER_RADIUS;
      let moving = false;

      for (const p of particles) {
        p.px = p.x;
        p.py = p.y;

        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < r2 && d2 > 0.0001) {
            const d = Math.sqrt(d2);
            const force = (1 - d / POINTER_RADIUS) * POINTER_POWER;
            p.vx += (dx / d) * force;
            p.vy += (dy / d) * force;
          }
        }

        p.vx = (p.vx + (p.tx - p.x) * p.ease) * FRICTION;
        p.vy = (p.vy + (p.ty - p.y) * p.ease) * FRICTION;
        p.x += p.vx;
        p.y += p.vy;

        if (!moving) {
          const speed = Math.abs(p.vx) + Math.abs(p.vy);
          const off = Math.abs(p.tx - p.x) + Math.abs(p.ty - p.y);
          if (speed > REST_SPEED || off > REST_DISTANCE) moving = true;
        }
      }

      return moving;
    };

    const render = (alpha: number) => {
      ctx.clearRect(0, 0, cssW, cssH);
      for (const p of particles) {
        const sprite = p.tinted ? accentSprite : inkSprite;
        if (!sprite) continue;
        const x = p.px + (p.x - p.px) * alpha;
        const y = p.py + (p.y - p.py) * alpha;
        // The sprite is mostly falloff, so it draws wider than the dot reads.
        const s = p.size * 3.4;
        ctx.globalAlpha = p.alpha;
        ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    };

    /** Paints the settled line without running a step — resize, theme, reduce. */
    const redraw = () => {
      for (const p of particles) {
        p.px = p.x;
        p.py = p.y;
      }
      render(1);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const frame = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);

      // A backgrounded tab must not dump a multi-second delta into the spring.
      const dt = Math.min(now - last, 100);
      last = now;
      acc += dt;

      let moving = false;
      let steps = 0;
      while (acc >= STEP_MS && steps < 5) {
        moving = physics() || moving;
        acc -= STEP_MS;
        steps++;
      }
      render(acc / STEP_MS);

      // The whole point of the contract: when it is over, it is over. The last
      // frame stays on screen and the loop costs nothing until something asks
      // for it again.
      //
      // `steps` has to be in the test. A frame that ran no step has not
      // observed anything standing still — it just arrived before the
      // accumulator filled, which is every first frame (dt≈0) and every other
      // frame at 120Hz. Without it the entrance stops itself two frames in,
      // with every particle still sitting where it was scattered.
      if (steps > 0 && !moving && !pointer.active) {
        stop();
        redraw();
      }
    };

    const start = () => {
      if (running || still || !ready || !visible || document.hidden) return;
      running = true;
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    };

    /* ---- wiring ---- */

    readPalette();
    buildSprites();
    ready = sample(null);
    if (!ready) return;
    setDotted(true);
    redraw();
    // Scattered on the first frame, then it pulls itself together.
    start();

    const onPointerMove = (e: PointerEvent) => {
      if (!ready) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const near =
        x > -WAKE_MARGIN &&
        y > -WAKE_MARGIN &&
        x < rect.width + WAKE_MARGIN &&
        y < rect.height + WAKE_MARGIN;
      if (!near) {
        // Leaving the neighbourhood: let the spring bring everything home.
        pointer.active = false;
        return;
      }
      pointer.x = x;
      pointer.y = y;
      pointer.active = true;
      start();
    };

    const onPointerGone = () => {
      pointer.active = false;
      start();
    };

    // Both directions, or a tab that starts life in the background — which is
    // what a restored session or a window opened behind another one does —
    // never gets its entrance: `start()` refuses while hidden, and nothing
    // would ask again once the page came forward.
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointercancel", onPointerGone);
    document.addEventListener("visibilitychange", onVisibility);

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false;
        if (visible) start();
        else stop();
      },
      { rootMargin: "100px" }
    );
    io.observe(canvas);

    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      // `observe()` always fires once with the box it already had. Re-sampling
      // on that would stop the loop and reset the entrance a beat after it
      // started, so only a box that actually changed counts.
      const rect = host.getBoundingClientRect();
      if (
        Math.abs(rect.width - sampledW) < 1 &&
        Math.abs(rect.height - sampledH) < 1
      ) {
        return;
      }
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        stop();
        // Carry the current positions across, so a resize re-flows the dots
        // instead of scattering them a second time.
        ready = sample(particles);
        setDotted(ready);
        if (ready) {
          redraw();
          start();
        }
      }, 180);
    });
    ro.observe(host);

    // The reader flipped the lamp: re-resolve the tokens and repaint. The
    // particles keep their positions — only the ink changes.
    const themeObserver = new MutationObserver(() => {
      readPalette();
      buildSprites();
      if (!running) redraw();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      stop();
      window.clearTimeout(resizeTimer);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointercancel", onPointerGone);
      document.removeEventListener("visibilitychange", onVisibility);
      io.disconnect();
      ro.disconnect();
      themeObserver.disconnect();
    };
  }, [text]);

  return (
    <div ref={hostRef} className={`relative ${className ?? ""}`}>
      {/* The real text, always in the DOM; once the dots are up it only holds
          the box open and keeps the font on file for sampling. `w-fit` is
          load-bearing — sampling centres the glyphs in this element's box, so
          the box has to be the glyphs, not the column they sit in. */}
      <p
        ref={textRef}
        lang={lang}
        aria-hidden={decorative || undefined}
        className={`w-fit whitespace-nowrap transition-opacity duration-500 ${
          dotted ? "opacity-0" : "opacity-100"
        }`}
      >
        {text}
      </p>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full"
      />
    </div>
  );
}
