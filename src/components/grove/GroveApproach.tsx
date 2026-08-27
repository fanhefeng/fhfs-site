"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";
import { GroveScene } from "./GroveScene";
import { PaperDissolve } from "./PaperDissolve";
import { GroveCard, GroveKnob, type GroveCardData } from "./GroveCard";
import { APPROACH_CSS } from "./approach.css";

type Props = {
  /** Small mono line above the caption — which study this is. */
  kicker: string;
  /** The study's own title, spoken from inside it. */
  title: string;
  /** Where the caption's link goes, and what it says. */
  link: { label: string; href: string };
  /** The two plates standing in the grove: the first goes behind the moss, the
   *  second in front of it. */
  cards: [GroveCardData, GroveCardData];
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Ease the walk in — decelerating, so arriving feels like stopping. */
const outQuad = (x: number) => 1 - (1 - x) * (1 - x);

/**
 * The scroll's three beats, as fractions of the section.
 *
 * `OPEN` is the walk toward the grove, `HOLD` is standing in it, and the paper
 * starts coming down at `WASH`. The caption belongs to the hold, so it fades
 * up as the window finishes and leaves before the wash reaches it.
 */
const OPEN = 0.42;
const CAP_IN = [0.33, 0.47] as const;
const CAP_OUT = [0.56, 0.66] as const;
/**
 * The cards keep their own beat, a little wider than the caption's on both
 * sides: they are things standing in the grove rather than a line spoken over
 * it, so they are already there when the caption arrives, and they are still
 * there — being covered — once the paper starts coming down at WASH.
 */
const CARD_IN = [0.24, 0.42] as const;
const CARD_OUT = [0.6, 0.72] as const;
const WASH = 0.62;
/** Where the wash finishes — short of the end, so the last of the section is
 *  paper the reader is already scrolling off, not a front still crawling. */
const WASH_END = 0.94;

const span = (a: number, b: number, x: number) => clamp01((x - a) / (b - a));

/**
 * The approach — the cover's second and third acts.
 *
 * A photograph of the grove would have been the safe version of this. Instead
 * the scene itself is live the whole way, rendered at full size behind a
 * window the scrollbar opens: the reader walks from the page's own paper into
 * the moss, stands there a beat, and then the paper of the issue below comes
 * down over it along the lab's own dissolve front. Two acts, one breath, and
 * the only pinned passage on the site.
 *
 * Why a CSS sticky rather than ScrollTrigger's pin: the pin-spacer has to be
 * measured, and it is measured against a page whose height Lenis is smoothing
 * — a sticky element needs neither. ScrollTrigger is here only to report where
 * in the section the reader is.
 */
export function GroveApproach({ kicker, title, link, cards }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  /** Read every frame by the dissolve layer; never triggers a re-render. */
  const washRef = useRef(0);
  /** Read every frame by the scene: once the paper is all the way down there
   *  is nothing of the grove left to see, and it stops drawing. */
  const coveredRef = useRef(false);
  const [ready, setReady] = useState(false);

  const onReady = useCallback(() => setReady(true), []);

  /* Pointer parallax for the cards, published as two custom properties on the
     pin. This is what separates the two plates from each other and from the
     moss between them: each declares how far it rides (--pd) and how much it
     turns (--pr), and a still page writes nothing at all.

     Three decimals is finer than a pixel of travel, and rounding lets the
     writes stop entirely once the pointer settles — no style invalidation
     while the reader is simply reading. */
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

    // Only while the pin is on screen. The reader's pointer crosses the page
    // for as long as they are on it, and every write here is a style
    // invalidation of the whole pin — for cards nobody can see.
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

  useGSAP(
    () => {
      const pin = pinRef.current;
      if (!pin) return;

      // Last written values. Writing a custom property that has not changed
      // still invalidates style for the subtree, and this runs on every
      // scroll frame of a section three viewports tall.
      let lastOpen = -1;
      let lastCap = -1;
      let lastCard = -1;
      let lastImmersed = false;

      const st = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          const p = self.progress;

          const open = Math.round(outQuad(clamp01(p / OPEN)) * 1000) / 1000;
          if (open !== lastOpen) {
            lastOpen = open;
            pin.style.setProperty("--ga-open", String(open));
          }

          const cap =
            Math.round(
              (span(CAP_IN[0], CAP_IN[1], p) * (1 - span(CAP_OUT[0], CAP_OUT[1], p))) * 100
            ) / 100;
          if (cap !== lastCap) {
            lastCap = cap;
            pin.style.setProperty("--ga-cap", String(cap));
            // Only reachable while it is actually legible.
            pin.style.setProperty("--ga-cap-hit", cap > 0.85 ? "auto" : "none");
            // And not reachable at all — by pointer OR by keyboard — while it
            // is not on screen: a transparent link still takes a tab stop, and
            // this act is three viewports of them.
            pin.style.setProperty("--ga-cap-vis", cap > 0.02 ? "visible" : "hidden");
          }

          const card =
            Math.round(
              (span(CARD_IN[0], CARD_IN[1], p) * (1 - span(CARD_OUT[0], CARD_OUT[1], p))) * 100
            ) / 100;
          if (card !== lastCard) {
            lastCard = card;
            pin.style.setProperty("--ga-card", String(card));
            // The paper passes over the cards rather than removing them, so
            // without this the knobs stay clickable under a page they are no
            // longer visible on.
            pin.style.setProperty("--ga-card-hit", card > 0.85 ? "auto" : "none");
            pin.style.setProperty("--ga-card-vis", card > 0.02 ? "visible" : "hidden");
          }

          const wash = clamp01((p - WASH) / (WASH_END - WASH));
          washRef.current = wash;
          coveredRef.current = wash >= 1;

          // The frame is full of moss between the walk and the wash; that is
          // the stretch the header's paper scrim has to stand down for.
          const immersed = open > 0.6 && wash < 0.55;
          if (immersed !== lastImmersed) {
            lastImmersed = immersed;
            if (immersed) document.body.dataset.groveImmersed = "1";
            else delete document.body.dataset.groveImmersed;
          }
        },
      });
      return () => {
        st.kill();
        delete document.body.dataset.groveImmersed;
      };
    },
    { scope: sectionRef }
  );

  return (
    <>
      <style href="grove-approach" precedence="medium">{APPROACH_CSS}</style>

      <section ref={sectionRef} className="ga" aria-labelledby="ga-cap-title">
        <div ref={pinRef} className="ga-pin">
          <div className="ga-window">
            <div ref={sceneRef} className="ga-scene" data-ready={ready || undefined}>
              {/* The stage is both the frame the scene solves the roots against
                  and the grid the cards are laid out on — one coordinate system,
                  which is the only way a card can be placed against a branch
                  rather than beside it. It must not open a stacking context, or
                  card b could not climb past the canvas. */}
              <div ref={stageRef} className="ga-stage">
                <GroveCard slot="a" {...cards[0]} />
                <GroveKnob href={cards[0].href} linkLabel={cards[0].linkLabel} />
                <GroveCard slot="b" {...cards[1]} />
              </div>
              <GroveScene heroRef={sceneRef} stageRef={stageRef} coveredRef={coveredRef} onReady={onReady} />
              {/* The floor the caption stands on. It used to be the pin's own
                  ::after, but it has to pass *under* the card in front and over
                  the one behind, which only works from inside the scene. */}
              <div className="ga-floor" aria-hidden="true" />
              <PaperDissolve progressRef={washRef} className="ga-dissolve" />
            </div>
          </div>

          <div className="ga-cap">
            <span className="ga-cap-kicker">{kicker}</span>
            <p id="ga-cap-title" className="ga-cap-title">{title}</p>
            <a className="ga-cap-link" href={link.href}>
              {link.label}
              <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
                <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" />
              </svg>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
