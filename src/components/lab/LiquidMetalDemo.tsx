"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { gsap, useGSAP, ScrollTrigger, EASE } from "@/lib/client/gsap";
import { prefersSaveData } from "@/lib/client/three/guards";
import { COMPOSITE } from "@/lib/grove/liquidMetal";
import { mountLiquidMetal, type LiquidMetal, type LiquidMix } from "@/lib/grove/liquidMetalMount";

type Props = {
  accent: string;
  hint: string;
  headline: string;
  body: string;
  tail: string;
  fallbackNote: string;
  /** The button's own label — it is the subject of the study. */
  label: string;
  stageField: string;
  stageMolten: string;
  stageBloom: string;
};

/**
 * A button with no gradient, no texture and no image behind it — the home
 * page's control, taken apart. The metal is the same pipeline the pill mounts
 * (`lib/grove/liquidMetalMount`); what the study adds is the scrollbar
 * scrubbing its mix.
 *
 * The scrollbar walks the pipeline. Act one is the bare dispersion field,
 * razor-etched; act two pours the softening blur over it and lights the
 * travelling rim; act three adds the bloom and the contrast curve that turn it
 * back into metal. The button stays live the whole way down — hover it, hold
 * it, tab to it — because a study of a control that cannot be operated is a
 * picture of one.
 *
 * The clock only turns while the button is engaged or still settling, so a
 * study nobody is touching parks on its last frame (DESIGN.md §5.3). The page
 * this came from runs its rim travelling for ever; two of them over a live
 * hero measured at half the frame rate of the page without them.
 */
export function LiquidMetalDemo({
  accent,
  hint,
  headline,
  body,
  tail,
  fallbackNote,
  label,
  stageField,
  stageMolten,
  stageBloom,
}: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLParagraphElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  /** 0 → 1 across the whole study. Read by the render loop. */
  const phase = useRef({ value: 0 });
  const applyRef = useRef<((p: number) => void) | null>(null);
  const metalRef = useRef<LiquidMetal | null>(null);

  /** Scrubbed by the scrollbar: which passes are in play, and how far.
   *  `base` is the metal's floor brightness with nobody touching it. High, and
   *  deliberately so: on the home page the control draws its metal only under
   *  the pointer, because there it is one element on a page. Here it is the
   *  subject of the study, so it has to be lit at rest — and lit HARD, because
   *  the composite's contrast curve is a power, and a power below 1 crushes
   *  rather than lifts. At the full gain the highlights run past 1 into the
   *  half-float buffer and punch does what it says; at half that they all sit
   *  under 1 and act three comes out darker than act one. */
  const mix = useRef<LiquidMix>({ rim: 0, soften: 0, glow: 0, punch: 1, base: 0.82 });

  const [live, setLive] = useState(false);
  const [degraded, setDegraded] = useState(false);
  /** Bumped when a lost context comes back, so the effect rebuilds on it. */
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const pad = padRef.current;
    const btn = buttonRef.current;
    if (!canvas || !pad || !btn) return;

    if (prefersSaveData()) {
      setDegraded(true);
      return;
    }

    /* ---- the scroll scrubs the pipeline itself ---- */
    const smoothstep = (x: number, a: number, b: number) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    const apply = (p: number) => {
      const c = Math.min(Math.max(p, 0), 1);
      const m = mix.current;
      // Act one is the bare field: no rim, no blur, no bloom, so the etched
      // dispersion is on show before anything softens it. Act two pours the
      // blur over it and lights the outline. Act three adds the bloom and the
      // contrast curve that put the metal back.
      m.rim = smoothstep(c, 0.3, 0.52);
      m.soften = COMPOSITE.soften * smoothstep(c, 0.34, 0.62);
      m.glow = COMPOSITE.glow * smoothstep(c, 0.6, 0.9);
      m.punch = 1 + (COMPOSITE.punch - 1) * smoothstep(c, 0.6, 0.9);
      if (copyRef.current) {
        copyRef.current.style.opacity = (1 - smoothstep(c, 0.68, 0.88)).toFixed(3);
      }
    };
    applyRef.current = apply;
    apply(phase.current.value);

    let available = true;
    const metal = mountLiquidMetal({
      canvas,
      pad,
      button: btn,
      mix: () => mix.current,
      onContextRestored: () => setEpoch((n) => n + 1),
      onUnavailable: () => {
        available = false;
        setDegraded(true);
      },
    });
    metalRef.current = metal;
    if (available) {
      setLive(true);
      ScrollTrigger.refresh();
    }

    return () => {
      metal.dispose();
      metalRef.current = null;
      applyRef.current = null;
    };
  }, [epoch]);

  useGSAP(
    () => {
      const stage = stageRef.current;
      const sticky = stickyRef.current;
      if (!live || !stage || !sticky) return;

      const labels = [stageField, stageMolten, stageBloom];
      let shown = -1;

      const tween = gsap.to(phase.current, {
        value: 1,
        ease: EASE.linear,
        onUpdate: () => {
          applyRef.current?.(phase.current.value);
          metalRef.current?.invalidate();
          const act = phase.current.value < 0.34 ? 0 : phase.current.value < 0.66 ? 1 : 2;
          if (act !== shown && labelRef.current) {
            shown = act;
            labelRef.current.textContent = labels[act]!;
          }
        },
        scrollTrigger: {
          trigger: stage,
          start: "top top",
          end: "bottom bottom",
          pin: sticky,
          pinSpacing: false,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          scrub: 0.8,
        },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
    { scope, dependencies: [live], revertOnUpdate: true },
  );

  return (
    <div ref={scope} style={{ "--lm-accent": accent } as CSSProperties}>
      <style href="lab-liquid-metal" precedence="medium">
        {CSS}
      </style>

      <div ref={stageRef} className="lm-stage" data-degraded={degraded || undefined}>
        <div ref={stickyRef} className="lm-sticky">
          <div ref={padRef} className="lm-pad">
            <div className="lm-plate" aria-hidden="true" />
            <canvas
              ref={canvasRef}
              className="lm-canvas"
              data-degraded={degraded || undefined}
              aria-hidden="true"
            />
            <button ref={buttonRef} className="lm-btn" type="button">
              <svg className="lm-ico" viewBox="0 0 115 115" aria-hidden="true">
                <g stroke="currentColor" strokeWidth="11" strokeLinecap="round">
                  <path d="M14 34.5 H101" />
                  <path d="M14 57.5 H101" />
                  <path d="M14 80.5 H68" />
                </g>
              </svg>
              <span className="lm-lbl">{label}</span>
            </button>
          </div>

          <div ref={copyRef} className="lm-copy">
            <h2 className="lm-headline">{headline}</h2>
            <p className="lm-body">{body}</p>
            <p className="lm-tail">{tail}</p>
            {degraded && <p className="lm-note">{fallbackNote}</p>}
          </div>

          <p ref={labelRef} className="lm-act" aria-hidden="true">
            {stageField}
          </p>
          <p className="lm-hint" aria-hidden="true">
            {hint}
          </p>
        </div>
      </div>
    </div>
  );
}

const CSS = `
/* Three acts, one per pass added. */
.lm-stage { position: relative; height: 400vh; }
.lm-stage[data-degraded] { height: 100svh; }
.lm-sticky {
  position: relative;
  height: 100svh;
  overflow: hidden;
  border-block: 1px solid var(--line);
  /* A near-black ground, because the metal is additive light: on a pale field
     the dark half of every ribbon has nothing to be dark against. */
  background:
    radial-gradient(58% 46% at 50% 42%, rgba(150, 168, 196, 0.09) 0%, rgba(150, 168, 196, 0) 70%),
    #0b0d10;
}

/* Everything is expressed off one ergonomic knob: the button's height.
   Bounded by the viewport's WIDTH as well as its height: the pill shrink-wraps
   its label, so on a phone a height-only rule makes a pill wider than the
   screen. */
.lm-pad {
  --lm-h: clamp(40px, min(13vh, 15vw), 150px);
  --lm-u: calc(var(--lm-h) / 516);
  /* The canvas IS the pad, so this has to clear the bloom's full reach —
     about four sigma — or the halo is cut off against a visible rectangle. */
  padding: calc(900 * var(--lm-u));
  /* Centred by transform rather than by the grid it used to sit in: the bloom
     pad is far wider than the pill, and a grid centres an item that overflows
     its track by aligning it to the start — which put the button off the right
     of the screen on a phone. */
  position: absolute;
  left: 50%;
  top: 34%;
  transform: translate(-50%, -50%);
  width: max-content;
  height: max-content;
  display: grid;
  place-items: center;
  touch-action: manipulation;
}

.lm-plate {
  position: absolute;
  inset: calc(900 * var(--lm-u));
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.085), rgba(255, 255, 255, 0.014) 44%, rgba(255, 255, 255, 0) 64%),
    rgba(10, 12, 10, 0.42);
  box-shadow:
    0 calc(var(--lm-h) * 0.08) calc(var(--lm-h) * 0.18) rgba(0, 0, 0, 0.38),
    0 calc(var(--lm-h) * 0.24) calc(var(--lm-h) * 0.5) rgba(0, 0, 0, 0.28),
    0 calc(var(--lm-h) * 0.48) calc(var(--lm-h) * 0.96) rgba(0, 0, 0, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.13);
  transition: box-shadow 0.38s var(--ease-out, cubic-bezier(0.22, 0.61, 0.36, 1)),
              background 0.38s var(--ease-out, cubic-bezier(0.22, 0.61, 0.36, 1));
}
/* Deepen it while the metal is lit, so the bright face keeps its edge. */
.lm-pad[data-hot] .lm-plate {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.105), rgba(255, 255, 255, 0.02) 44%, rgba(255, 255, 255, 0) 64%),
    rgba(8, 10, 8, 0.5);
  box-shadow:
    0 calc(var(--lm-h) * 0.1) calc(var(--lm-h) * 0.22) rgba(0, 0, 0, 0.44),
    0 calc(var(--lm-h) * 0.32) calc(var(--lm-h) * 0.66) rgba(0, 0, 0, 0.34),
    0 calc(var(--lm-h) * 0.66) calc(var(--lm-h) * 1.32) rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.17);
}
/* Pressed: the button settles onto the surface, so the shadow tightens. */
.lm-pad[data-press] .lm-plate {
  box-shadow:
    0 calc(var(--lm-h) * 0.04) calc(var(--lm-h) * 0.11) rgba(0, 0, 0, 0.46),
    0 calc(var(--lm-h) * 0.13) calc(var(--lm-h) * 0.32) rgba(0, 0, 0, 0.36),
    0 calc(var(--lm-h) * 0.27) calc(var(--lm-h) * 0.62) rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transition-duration: 0.1s;
}

.lm-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.lm-canvas[data-degraded] { visibility: hidden; }

.lm-btn {
  position: relative;
  height: var(--lm-h);
  border: 0;
  background: none;
  padding: 0 calc(224 * var(--lm-u)) 0 calc(95 * var(--lm-u));
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(112 * var(--lm-u));
  color: #fff;
  font-family: inherit;
  font-weight: 500;
  font-size: calc(140 * var(--lm-u));
  line-height: 1;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  outline: none;
}
.lm-btn:focus-visible {
  outline: calc(4 * var(--lm-u)) solid rgba(255, 255, 255, 0.55);
  outline-offset: calc(10 * var(--lm-u));
}
.lm-ico { width: calc(150 * var(--lm-u)); height: calc(150 * var(--lm-u)); display: block; flex: none; }
/* Descenders pull the flex box up — nudge back so the cap box, not the em box,
   is what sits centred on the pill. */
.lm-lbl { display: block; transform: translateY(calc(2 * var(--lm-u))); }

.lm-copy {
  position: absolute;
  inset: auto 0 9vh;
  margin-inline: auto;
  max-width: min(34ch, 82vw);
  text-align: center;
  color: #e9ecf2;
  text-shadow: 0 2px 28px rgba(0, 0, 0, 0.65);
  pointer-events: none;
}
.lm-headline { margin: 0; font-size: clamp(1.7rem, 5vw, 3rem); font-weight: 600; letter-spacing: -0.02em; }
.lm-body { margin: 0.9rem 0 0; font-size: 0.9375rem; line-height: 1.7; opacity: 0.82; }
.lm-tail {
  margin: 1.1rem 0 0;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lm-accent);
  text-shadow: none;
}
.lm-note { margin: 1rem 0 0; font-size: 0.8125rem; line-height: 1.6; opacity: 0.66; }

.lm-act,
.lm-hint {
  position: absolute;
  bottom: clamp(1rem, 4vw, 2.5rem);
  margin: 0;
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  pointer-events: none;
}
.lm-act { left: clamp(1rem, 4vw, 2.5rem); color: var(--lm-accent); }
.lm-hint { right: clamp(1rem, 4vw, 2.5rem); color: rgba(233, 236, 242, 0.42); }
`;
