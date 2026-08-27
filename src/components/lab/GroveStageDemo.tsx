"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { gsap } from "@/lib/gsap";
import { hasWebGL, prefersSaveData } from "@/lib/three/guards";
import { GroveScene } from "@/components/grove/GroveScene";
import { GroveCard, GroveKnob, type GroveCardData } from "@/components/grove/GroveCard";
import { APPROACH_CSS } from "@/components/grove/approach.css";

type Props = {
  accent: string;
  /** The mono line at the foot of the frame. */
  hint: string;
  fallbackNote: string;
  /** The two plates: the first goes behind the moss, the second in front. */
  cards: [GroveCardData, GroveCardData];
};

/**
 * The composition, as the reference laid it out.
 *
 * The fourth study grows the root; this one stands two sheets of paper in it
 * and does nothing else, because the only thing worth showing here is which
 * side of the moss each sheet is on — and that is the one thing a photograph
 * of the grove could not do. The stage is the home page's (approach.css.ts,
 * same DOM, same rules): card a under the canvas, card b over it, the pair at
 * the reference's own coordinates on its 1600 × 880 grid, the stage hung
 * centred the way the reference hung it. What the approach drives from the
 * scrollbar — the cards' rise, the twelve-step plate resolve — is played once
 * here, on a clock, when the scene is up.
 */
export function GroveStageDemo({ accent, hint, fallbackNote, cards }: Props) {
  const pinRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [degraded, setDegraded] = useState(false);

  const onReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    setDegraded(prefersSaveData() || !hasWebGL());
  }, []);

  // Never leave the cards unrevealed if the scene stalls.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 4000);
    return () => clearTimeout(t);
  }, []);

  /* The entrance. `--ga-card` is what the approach writes from scroll
     position; here it is tweened 0 → 1 once, linearly, so the plate's stepped
     clip lands on its twelve stops at an even beat — the low-bandwidth
     receiver this composition first arrived on. The delay is the reference's:
     the moss is drawn in first, the paper arrives on it. */
  useEffect(() => {
    const pin = pinRef.current;
    if (!pin || !ready) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state = { v: 0 };
    pin.style.setProperty("--ga-card-vis", "visible");
    const tween = gsap.to(state, {
      v: 1,
      duration: calm ? 0 : 1.45,
      delay: calm ? 0 : 0.9,
      ease: "none",
      onUpdate: () => pin.style.setProperty("--ga-card", state.v.toFixed(3)),
      onComplete: () => pin.style.setProperty("--ga-card-hit", "auto"),
    });
    return () => {
      tween.kill();
    };
  }, [ready]);

  /* Pointer parallax — the approach's, verbatim: two custom properties on the
     pin, each card declaring how far it rides them (--pd) and how much it
     turns (--pr). The difference between the two cards' values is the depth
     between them, and this is the study where that difference is the point. */
  useEffect(() => {
    const pin = pinRef.current;
    if (!pin) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const pointer = { x: 0, y: 0 };
    const smooth = { x: 0, y: 0 };
    let lastX: string | null = null;
    let lastY: string | null = null;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let onScreen = false;
    const io = new IntersectionObserver((entries) => { onScreen = entries.some((en) => en.isIntersecting); });
    io.observe(pin);

    const tick = () => {
      if (!onScreen) return;
      smooth.x += (pointer.x - smooth.x) * 0.055;
      smooth.y += (pointer.y - smooth.y) * 0.055;
      const nx = (Math.round(smooth.x * 1000) / 1000).toString();
      const ny = (Math.round(smooth.y * 1000) / 1000).toString();
      if (nx === lastX && ny === lastY) return;
      lastX = nx;
      lastY = ny;
      pin.style.setProperty("--px", nx);
      pin.style.setProperty("--py", ny);
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div className="gs" style={{ "--gs-accent": accent } as CSSProperties}>
      {/* The approach's sheet first, this one's after it: same precedence,
          later in the document, so the overrides below win on a tie. */}
      <style href="grove-approach" precedence="medium">{APPROACH_CSS}</style>
      <style href="lab-grove-stage" precedence="medium">{CSS}</style>

      <div
        ref={pinRef}
        className="ga-pin"
        style={{ "--ga-open": 1, "--ga-card": 0 } as CSSProperties}
      >
        <div className="ga-window">
          <div ref={sceneRef} className="ga-scene" data-ready={ready || undefined}>
            {/* One coordinate system for the roots and the cards — see the
                same note in GroveApproach. No stacking context here, or card
                b could not climb past the canvas. */}
            <div ref={stageRef} className="ga-stage">
              <GroveCard slot="a" {...cards[0]} />
              <GroveKnob href={cards[0].href} linkLabel={cards[0].linkLabel} />
              <GroveCard slot="b" {...cards[1]} />
            </div>
            <GroveScene heroRef={sceneRef} stageRef={stageRef} onReady={onReady} />
          </div>
        </div>

        <p className="gs-hint" aria-hidden="true">{hint}</p>
        {degraded && <p className="gs-note">{fallbackNote}</p>}
      </div>
    </div>
  );
}

const CSS = `
.gs { position: relative; }
/* A block in the page's flow rather than the approach's sticky frame. */
.gs .ga-pin {
  position: relative;
  border-block: 1px solid var(--line);
}

/* The reference centred its stage — 880 units of it in the middle of the
   frame — and its card coordinates were traced against that hang. The home
   page hangs the same stage higher to put the arch mid-window and lets it
   give way on flat frames; here the frame is the reference's, so the number
   is the reference's. */
.gs .ga-stage { margin-top: calc(-440 * (100vw / 1600)); }

.gs-hint,
.gs-note {
  position: absolute;
  bottom: clamp(1rem, 4vw, 2.5rem);
  z-index: 5;
  margin: 0;
  pointer-events: none;
}
.gs-hint {
  right: clamp(1rem, 4vw, 2.5rem);
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(242, 239, 228, 0.42);
}
.gs-note {
  left: clamp(1rem, 4vw, 2.5rem);
  max-width: 40ch;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: rgba(242, 239, 228, 0.66);
}

/* ── narrow ──────────────────────────────────────────────────────────
   The approach keeps one card on a phone; a study about the pair keeps
   both. This is the reference's own single column at the reference's own
   numbers on its 760-unit stage — the near arch's foot crosses card a's top
   edge, card b stands below it in front — less the copy that used to stand
   above the moss: the whole stage is lifted by that much, cards included,
   so the relation between paper and root is untouched. The frame grows to
   fit rather than clipping. */
@media (max-width: 900px) {
  .gs .ga-pin { height: max(100svh, calc(1240 * var(--ga-u))); }
  .gs .ga-stage {
    top: calc(-400 * var(--ga-u));
    margin-top: 0;
  }
  .gs .ga-card--a,
  .gs .ga-knob-float { display: block; }

  .gs .ga-card--a {
    left: calc(34 / 760 * 100%);
    width: calc(692 / 760 * 100%);
    top: calc(1050 * var(--ga-u));
    height: calc(250 * var(--ga-u));
  }
  .gs .ga-card--a .ga-card-label { top: calc(96 * var(--ga-u)); }
  .gs .ga-card--a .ga-card-title {
    top: calc(124 * var(--ga-u));
    width: calc(330 * var(--ga-u));
    font-size: calc(32 * var(--ga-u));
    line-height: calc(36 * var(--ga-u));
  }
  .gs .ga-card--a .ga-plate {
    left: auto;
    right: calc(16 * var(--ga-u));
    top: calc(16 * var(--ga-u));
    width: calc(224 * var(--ga-u));
    height: calc(218 * var(--ga-u));
  }
  /* The knob keeps its corner: the card's lower right, 20u in. */
  .gs .ga-knob-float {
    left: calc(644 / 760 * 100%);
    top: calc(1218 * var(--ga-u));
    width: calc(58 * var(--ga-u));
    height: calc(58 * var(--ga-u));
  }
  .gs .ga-knob-float .ga-knob {
    width: calc(58 * var(--ga-u));
    height: calc(58 * var(--ga-u));
  }

  .gs .ga-card--b {
    left: calc(34 / 760 * 100%);
    width: calc(692 / 760 * 100%);
    top: calc(1324 * var(--ga-u));
    height: calc(268 * var(--ga-u));
  }
  .gs .ga-card--b .ga-card-title {
    width: calc(340 * var(--ga-u));
    font-size: calc(32 * var(--ga-u));
    line-height: calc(36 * var(--ga-u));
  }
  .gs .ga-card--b .ga-plate {
    left: auto;
    right: calc(16 * var(--ga-u));
    bottom: calc(16 * var(--ga-u));
    width: calc(300 * var(--ga-u));
    height: calc(150 * var(--ga-u));
  }
  .gs .ga-card--b .ga-knob {
    width: calc(58 * var(--ga-u));
    height: calc(58 * var(--ga-u));
    right: calc(20 * var(--ga-u));
    bottom: calc(20 * var(--ga-u));
  }
  .gs .ga-knob svg { width: calc(19 * var(--ga-u)); height: calc(19 * var(--ga-u)); }
}
`;
