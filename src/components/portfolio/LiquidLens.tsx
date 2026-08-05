"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { gsap, EASE } from "@/lib/gsap";
import {
  enableLayoutSubtree,
  getElementDrawingContext,
  supportsHtmlInCanvas,
} from "@/lib/htmlInCanvas";

type Props = {
  /** Headline inside the demo card. */
  heading: string;
  /** One line of body copy — the text the lens magnifies. */
  body: string;
  /** Caption shown when the live canvas lens is running. */
  hint: string;
  /** Caption shown when the browser has no HTML-in-Canvas. */
  fallbackNote: string;
  /** Label of the still-clickable link inside the lens area. */
  linkLabel: string;
  /** Where that link points (kept same-origin). */
  linkHref: string;
  /** Rim colour of the lens. */
  accent: string;
};

/**
 * Liquid glass lens over living DOM — the page's HTML-in-Canvas experiment.
 *
 * Supported (Chrome origin trial): the card below is a real DOM subtree
 * *inside* a `layoutsubtree` canvas. Each frame the canvas redraws it and
 * paints a magnified copy inside a circular clip that chases the cursor, so
 * the text refracts through glass while the link underneath stays clickable
 * and focusable.
 *
 * Everywhere else: the exact same markup renders as an ordinary card with a
 * CSS `backdrop-filter` puck — one layer of magic less, nothing broken. Any
 * draw error demotes the component to that path for good.
 *
 * Cost when idle is zero: the ticker only runs while the pointer is inside,
 * and the canvas keeps its last frame afterwards.
 */
export function LiquidLens({
  heading,
  body,
  hint,
  fallbackNote,
  linkLabel,
  linkHref,
  accent,
}: Props) {
  const [enhanced, setEnhanced] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const puckRef = useRef<HTMLSpanElement>(null);

  // Capability check runs after mount only — SSR and first paint are always
  // the plain DOM, so hydration can never diverge.
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    setEnhanced(supportsHtmlInCanvas());
  }, []);

  /* ---- enhanced path: live DOM drawn into the canvas ------------------- */
  useEffect(() => {
    if (!enhanced) return;
    const canvas = canvasRef.current;
    const content = contentRef.current;
    if (!canvas || !content) return;
    const ctx = getElementDrawingContext(canvas);
    if (!ctx) {
      setEnhanced(false);
      return;
    }
    enableLayoutSubtree(canvas);

    const lens = { x: 0, y: 0, a: 0 };
    let running = false;
    let dead = false;

    const draw = () => {
      if (dead) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.round(w * dpr);
      const ph = Math.round(h * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      try {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        // The live subtree, 1:1 — this is what replaces normal painting.
        ctx.drawElementImage(content, 0, 0);

        if (lens.a > 0.01) {
          const r = Math.min(78, Math.min(w, h) * 0.42);
          // Refraction: the same DOM again, magnified about the cursor and
          // clipped to the puck.
          ctx.save();
          ctx.globalAlpha = lens.a;
          ctx.beginPath();
          ctx.arc(lens.x, lens.y, r, 0, Math.PI * 2);
          ctx.clip();
          ctx.translate(lens.x, lens.y);
          ctx.scale(1.32, 1.32);
          ctx.translate(-lens.x, -lens.y);
          ctx.drawElementImage(content, 0, 0);
          ctx.restore();

          // Rim: a soft top-left highlight plus a hairline in the accent.
          ctx.save();
          ctx.globalAlpha = lens.a;
          const glare = ctx.createRadialGradient(
            lens.x - r * 0.35,
            lens.y - r * 0.4,
            r * 0.08,
            lens.x,
            lens.y,
            r
          );
          glare.addColorStop(0, "rgba(255,255,255,0.30)");
          glare.addColorStop(0.7, "rgba(255,255,255,0)");
          ctx.beginPath();
          ctx.arc(lens.x, lens.y, r, 0, Math.PI * 2);
          ctx.fillStyle = glare;
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = accent;
          ctx.globalAlpha = lens.a * 0.55;
          ctx.stroke();
          ctx.restore();
        }
      } catch {
        // The API is behind an origin trial and may change or expire —
        // demote to the CSS card instead of leaving a blank canvas.
        dead = true;
        stop();
        setEnhanced(false);
      }
    };

    const tick = () => draw();
    const start = () => {
      if (running || dead) return;
      running = true;
      gsap.ticker.add(tick);
    };
    function stop() {
      if (!running) return;
      running = false;
      gsap.ticker.remove(tick);
    }

    const xTo = gsap.quickTo(lens, "x", {
      duration: 0.3,
      ease: EASE.default,
      overwrite: "auto",
    });
    const yTo = gsap.quickTo(lens, "y", {
      duration: 0.3,
      ease: EASE.default,
      overwrite: "auto",
    });

    const onEnter = (e: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      lens.x = e.clientX - box.left;
      lens.y = e.clientY - box.top;
      start();
      gsap.to(lens, { a: 1, duration: 0.3, ease: EASE.default, overwrite: "auto" });
    };
    const onMove = (e: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      xTo(e.clientX - box.left);
      yTo(e.clientY - box.top);
    };
    const onLeave = () => {
      gsap.to(lens, {
        a: 0,
        duration: 0.25,
        ease: EASE.exit,
        overwrite: "auto",
        onComplete: () => {
          // One last frame without the puck, then the canvas idles for good.
          stop();
          draw();
        },
      });
    };

    canvas.addEventListener("pointerenter", onEnter);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    // The subtree repaints (fonts land, theme flips) → redraw once.
    const onPaint = () => {
      if (!running) draw();
    };
    canvas.addEventListener("paint", onPaint);
    const ro = new ResizeObserver(() => {
      if (!running) draw();
    });
    ro.observe(canvas);

    canvas.requestPaint?.();
    const first = requestAnimationFrame(draw);

    return () => {
      dead = true;
      cancelAnimationFrame(first);
      stop();
      gsap.killTweensOf(lens);
      ro.disconnect();
      canvas.removeEventListener("pointerenter", onEnter);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("paint", onPaint);
    };
  }, [enhanced, accent]);

  /* ---- fallback path: CSS backdrop-filter puck ------------------------- */
  useEffect(() => {
    if (enhanced) return;
    const box = boxRef.current;
    const puck = puckRef.current;
    if (!box || !puck) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const xTo = gsap.quickTo(puck, "x", {
      duration: 0.35,
      ease: EASE.default,
      overwrite: "auto",
    });
    const yTo = gsap.quickTo(puck, "y", {
      duration: 0.35,
      ease: EASE.default,
      overwrite: "auto",
    });

    let box0: DOMRect | null = null;
    const onEnter = () => {
      box0 = box.getBoundingClientRect();
      gsap.to(puck, { opacity: 1, duration: 0.3, ease: EASE.default, overwrite: "auto" });
    };
    const onMove = (e: PointerEvent) => {
      if (!box0) box0 = box.getBoundingClientRect();
      xTo(e.clientX - box0.left);
      yTo(e.clientY - box0.top);
    };
    const onLeave = () => {
      box0 = null;
      gsap.to(puck, { opacity: 0, duration: 0.25, ease: EASE.exit, overwrite: "auto" });
    };

    box.addEventListener("pointerenter", onEnter);
    box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerleave", onLeave);
    return () => {
      box.removeEventListener("pointerenter", onEnter);
      box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerleave", onLeave);
      gsap.killTweensOf(puck);
    };
  }, [enhanced]);

  const content = (
    <div ref={contentRef} className="lens-content">
      <p className="lens-heading">{heading}</p>
      <p className="lens-body">{body}</p>
      <a className="lens-link hit-ext" href={linkHref}>
        {linkLabel}
      </a>
    </div>
  );

  return (
    <figure className="lens-figure" style={{ "--lens-accent": accent } as CSSProperties}>
      <style href="liquid-lens" precedence="medium">{LENS_CSS}</style>
      {enhanced ? (
        // Children of a layoutsubtree canvas lay out and stay hit-testable;
        // the canvas is what paints them.
        <canvas ref={canvasRef} className="lens-stage">
          {content}
        </canvas>
      ) : (
        <div ref={boxRef} className="lens-stage">
          {content}
          <span ref={puckRef} className="lens-puck" aria-hidden="true" />
        </div>
      )}
      <figcaption className="lens-caption">
        {enhanced ? hint : fallbackNote}
      </figcaption>
    </figure>
  );
}

const LENS_CSS = `
.lens-figure { margin: 1rem 0 0; }

.lens-stage {
  position: relative;
  display: block;
  width: 100%;
  height: 11.5rem;
  border-radius: var(--r-card);
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--line);
}

.lens-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.4rem;
  padding: 1.25rem 1.5rem;
}
.lens-heading {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.lens-body {
  margin: 0;
  max-width: 34ch;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--fg-secondary);
}
.lens-link {
  position: relative;
  width: fit-content;
  margin-top: 0.15rem;
  /* Padding + .hit-ext keep the tap target past 44px. */
  padding: 0.4rem 0;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* CSS fallback puck: real glass, just not refracting. */
.lens-puck {
  position: absolute;
  top: 0;
  left: 0;
  width: 9rem;
  height: 9rem;
  margin: -4.5rem 0 0 -4.5rem;
  border-radius: 50%;
  pointer-events: none;
  opacity: 0;
  -webkit-backdrop-filter: blur(6px) saturate(160%) brightness(1.06);
  backdrop-filter: blur(6px) saturate(160%) brightness(1.06);
  border: 1px solid color-mix(in srgb, var(--lens-accent) 45%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5),
    0 8px 24px rgba(20, 20, 30, 0.12);
}

.lens-caption {
  margin-top: 0.5rem;
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.08em;
  color: var(--fg-tertiary);
}
`;
