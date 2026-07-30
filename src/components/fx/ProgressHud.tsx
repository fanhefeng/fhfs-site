"use client";

import { useEffect, useRef } from "react";

/**
 * The "record side" HUD: a thin gold progress line on top and, in the
 * corner, a miniature turntable next to the tabular readout. Scroll is
 * the playhead of the site — the tonearm angle is scrubbed by scroll
 * progress (0 = outer edge, 1 = run-out groove) while the platter spins
 * on its own so the club never feels paused. Single scroll data source,
 * rAF-throttled; the canvas is 56px and repainted per frame at DPR<=2.
 */

const SIZE = 56;
const TAU = Math.PI * 2;

// Disc geometry (CSS px inside the 56x56 canvas).
const CX = 24;
const CY = 32;
const DISC_R = 19;
const LABEL_R = 6.5;
const GROOVES: ReadonlyArray<readonly [number, number]> = [
  [17.5, 0.4],
  [15.5, 0.32],
  [13.5, 0.25],
  [11.5, 0.18],
  [9.5, 0.12],
];

// Tonearm: pivot in the top-right corner, two segments plus a stylus dot.
const PIVOT_X = 46;
const PIVOT_Y = 10;
const ARM_L1 = 18;
const ARM_L2 = 8.5;
const ARM_BEND = 0.45;
// Arm angle at the pivot: outer edge of the record -> run-out groove.
const ARM_OUTER = 1.62;
const ARM_INNER = 2.05;

// ~33 1/3 RPM feel for a thumbnail platter.
const SPIN_SPEED = 0.6; // rad/s
const ARM_LERP = 0.1;

interface HudColors {
  gold: string;
  disc: string;
  groove: string;
  arm: string;
  dot: string;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function ProgressHud() {
  const barRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    /* Theme colors are cached at init and refreshed on the "fhfs:theme"
     * event — never queried per frame. Derived shades (disc base, arm in
     * light mode) are resolved from tokens via color-mix so no hex is
     * hardcoded; in light theme the record turns ink-on-paper. */
    const resolveColor = (spec: string) => {
      canvas.style.color = spec;
      return getComputedStyle(canvas).color;
    };
    let colors: HudColors;
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const light = document.documentElement.dataset.theme === "light";
      colors = {
        gold: cs.getPropertyValue("--gold").trim(),
        disc: resolveColor(
          light
            ? "color-mix(in srgb, var(--fg) 88%, var(--bg))"
            : "color-mix(in srgb, var(--fg) 10%, var(--bg))"
        ),
        groove: resolveColor(light ? "var(--bg)" : "var(--muted-fg)"),
        arm: resolveColor(
          light ? "color-mix(in srgb, var(--bg) 58%, var(--fg))" : "var(--fg)"
        ),
        dot: resolveColor("var(--bg)"),
      };
    };
    readColors();

    let spin = -0.5; // static pose under reduced motion
    let armAngle = ARM_OUTER;

    const drawFrame = () => {
      const c = colors;
      ctx.clearRect(0, 0, SIZE, SIZE);

      // Platter with fading grooves.
      ctx.beginPath();
      ctx.arc(CX, CY, DISC_R, 0, TAU);
      ctx.fillStyle = c.disc;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = c.groove;
      for (const [r, a] of GROOVES) {
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(CX, CY, r, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Gold label, spindle hole and the spin reference dot.
      ctx.beginPath();
      ctx.arc(CX, CY, LABEL_R, 0, TAU);
      ctx.fillStyle = c.gold;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(CX, CY, 1.2, 0, TAU);
      ctx.fillStyle = c.disc;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(CX + Math.cos(spin) * 4.2, CY + Math.sin(spin) * 4.2, 1.1, 0, TAU);
      ctx.fillStyle = c.dot;
      ctx.fill();

      // Tonearm: counterweight, two segments, stylus head.
      const ux = Math.cos(armAngle);
      const uy = Math.sin(armAngle);
      const ex = PIVOT_X + ux * ARM_L1;
      const ey = PIVOT_Y + uy * ARM_L1;
      const hx = ex + Math.cos(armAngle + ARM_BEND) * ARM_L2;
      const hy = ey + Math.sin(armAngle + ARM_BEND) * ARM_L2;
      ctx.strokeStyle = c.arm;
      ctx.lineCap = "round";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(PIVOT_X - ux * 4, PIVOT_Y - uy * 4);
      ctx.lineTo(PIVOT_X, PIVOT_Y);
      ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(PIVOT_X, PIVOT_Y);
      ctx.lineTo(ex, ey);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(PIVOT_X, PIVOT_Y, 2.2, 0, TAU);
      ctx.fillStyle = c.arm;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hx, hy, 1.6, 0, TAU);
      ctx.fill();
    };

    /* Persistent render loop (skipped entirely under reduced motion):
     * the platter always spins while the tab is visible, the arm eases
     * toward the scroll target. Paused on visibilitychange. */
    let loopRaf = 0;
    let lastT = 0;
    const tick = (t: number) => {
      loopRaf = requestAnimationFrame(tick);
      const dt = lastT ? Math.min((t - lastT) / 1000, 0.1) : 0;
      lastT = t;
      spin = (spin + dt * SPIN_SPEED) % TAU;
      const target = lerp(ARM_OUTER, ARM_INNER, progressRef.current);
      armAngle += (target - armAngle) * ARM_LERP;
      drawFrame();
    };
    const startLoop = () => {
      if (!loopRaf && !reduced.matches && !document.hidden) {
        lastT = 0;
        loopRaf = requestAnimationFrame(tick);
      }
    };
    const stopLoop = () => {
      if (loopRaf) cancelAnimationFrame(loopRaf);
      loopRaf = 0;
    };

    // Reduced motion: no idle loop, no easing — a single frame per
    // scroll update with the arm parked exactly on the progress angle.
    const drawStatic = () => {
      armAngle = lerp(ARM_OUTER, ARM_INNER, progressRef.current);
      drawFrame();
    };

    let scrollRaf = 0;
    const update = () => {
      scrollRaf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      progressRef.current = p;
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${p})`;
      }
      if (pctRef.current) {
        pctRef.current.textContent = String(Math.round(p * 100)).padStart(
          3,
          "0"
        );
      }
      if (reduced.matches) drawStatic();
    };
    const onScroll = () => {
      if (!scrollRaf) scrollRaf = requestAnimationFrame(update);
    };

    const onVisibility = () => {
      if (document.hidden) stopLoop();
      else startLoop();
    };
    const onTheme = () => {
      readColors();
      if (reduced.matches) drawStatic();
    };
    const onMotionPref = () => {
      stopLoop();
      if (reduced.matches) drawStatic();
      else startLoop();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    window.addEventListener("fhfs:theme", onTheme);
    document.addEventListener("visibilitychange", onVisibility);
    reduced.addEventListener("change", onMotionPref);

    update();
    if (reduced.matches) drawStatic();
    else startLoop();

    return () => {
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      stopLoop();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("fhfs:theme", onTheme);
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", onMotionPref);
    };
  }, []);

  return (
    <>
      <div
        ref={barRef}
        aria-hidden
        className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left scale-x-0 bg-gold [box-shadow:0_0_8px_rgba(232,180,79,0.6)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-5 left-5 z-40 hidden select-none items-center gap-2 sm:flex"
      >
        <canvas ref={canvasRef} className="h-14 w-14" width={SIZE} height={SIZE} />
        <div className="font-mono text-[10px] tracking-[0.18em] text-muted-fg/70 [font-variant-numeric:tabular-nums]">
          SIDE A · <span ref={pctRef}>000</span>%
        </div>
      </div>
    </>
  );
}
