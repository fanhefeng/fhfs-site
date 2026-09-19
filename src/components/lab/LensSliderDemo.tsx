"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { gsap, useGSAP, ScrollTrigger, EASE, prefersReducedMotion } from "@/lib/gsap";
import { hasWebGL, prefersSaveData } from "@/lib/three/guards";
import { splitText } from "@/lib/splitText";
import { LENS_DURATION, slideIndexAt, bandCentre } from "@/lib/lensSlider";

export type LensSlide = {
  src: string;
  alt: string;
  title: string;
  body: string;
  meta: string;
};

type Props = {
  accent: string;
  hint: string;
  fallbackNote: string;
  /** The same note for a reader on Save-Data, who has WebGL and said no. */
  saveDataNote: string;
  counterAria: string;
  prevLabel: string;
  nextLabel: string;
  slides: LensSlide[];
};

type Mode = "loading" | "live" | "degraded";

const pad = (n: number) => String(n + 1).padStart(2, "0");

/**
 * A full-viewport slider whose transition is a lens rather than a wipe.
 *
 * The scrollbar drives it, as everywhere in the lab: the stage is pinned for
 * one viewport per slide, and crossing into the next band starts the lens —
 * a real tween, not a scrub, because a lens that sits half-open while the
 * reader hesitates is just a broken picture. Scrolling back while it is
 * still growing reverses it; the picture it was bringing in shrinks away
 * again. Going two bands in one flick plays the second lens after the first.
 *
 * Copy is one block per slide, all in the DOM, so the page reads whole with
 * no JS at all; the characters are split server-side by `splitText` and
 * ride a word-level mask on the way in and out.
 *
 * The canvas paints only while a lens is moving or the box has resized.
 * Between slides it costs nothing (DESIGN.md §5.3). three.js lives in
 * `lensRenderer.ts`, fetched only once Save-Data and WebGL have both said yes;
 * the slider below works without it.
 */
export function LensSliderDemo({
  accent,
  hint,
  fallbackNote,
  saveDataNote,
  counterAria,
  prevLabel,
  nextLabel,
  slides,
}: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stillRef = useRef<HTMLImageElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);

  /** 0 → 1 across one lens. Read by the render loop. */
  const progress = useRef({ value: 0 });
  const dirtyRef = useRef(true);
  /** Set by the WebGL effect; the choreography calls it to swap textures. */
  const bindRef = useRef<((from: number, to: number) => void) | null>(null);
  /** Set by the choreography; the nav buttons call it. */
  const goRef = useRef<((index: number) => void) | null>(null);
  const shownRef = useRef(0);

  const [mode, setMode] = useState<Mode>("loading");
  const [saveData, setSaveData] = useState(false);
  /** The slide the counter names — where the slider is, or is headed. */
  const [at, setAt] = useState(0);
  const count = slides.length;
  /** Read by the choreography, which is keyed on the pictures rather than on
   *  this array: the page hands a new one on every render. */
  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  /** The pictures alone, as one string: the lens is keyed on this rather
   *  than on `slides`, which the page rebuilds on every render — the
   *  copy can change (a locale switch) without the renderer being torn down
   *  and four textures fetched again. */
  const srcKey = slides.map((slide) => slide.src).join("\n");

  /* ---- the lens ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    const srcs = srcKey.split("\n");
    if (!canvas || srcs.length < 2) return;

    if (prefersSaveData() || !hasWebGL()) {
      setSaveData(prefersSaveData());
      setMode("degraded");
      return;
    }

    let cancelled = false;
    let teardown: (() => void) | null = null;
    import("./lensRenderer").then(
      ({ mountLens }) => {
        if (cancelled) return;
        teardown = mountLens({
          canvas,
          box: () => stickyRef.current,
          srcs,
          progress: progress.current,
          dirty: dirtyRef,
          shown: () => shownRef.current,
          onLive: (bind) => {
            bindRef.current = bind;
            setMode("live");
            ScrollTrigger.refresh();
          },
          onFail: () => setMode("degraded"),
        });
      },
      // A chunk that never arrives (offline, a stale deploy) leaves the plain
      // slider, not a spinner.
      () => {
        if (!cancelled) setMode("degraded");
      },
    );

    return () => {
      cancelled = true;
      bindRef.current = null;
      teardown?.();
    };
  }, [srcKey]);

  /* ---- the choreography: scroll → slide, and the copy that rides each lens ---- */
  useGSAP(
    (_ctx, contextSafe) => {
      const stage = stageRef.current;
      const sticky = stickyRef.current;
      const copy = copyRef.current;
      if (mode === "loading" || !stage || !sticky || !copy || !contextSafe || count < 2) return;

      const live = mode === "live";
      const articles = Array.from(copy.querySelectorAll<HTMLElement>(".ls-slide"));
      const charsOf = (i: number) => articles[i]!.querySelectorAll<HTMLElement>(".ls-char");
      const linesOf = (i: number) =>
        articles[i]!.querySelectorAll<HTMLElement>(".ls-body, .ls-meta");

      // Everything but the first slide starts below its mask.
      articles.forEach((_, i) => {
        if (i === shownRef.current) return;
        gsap.set(charsOf(i), { yPercent: 110 });
        gsap.set(linesOf(i), { autoAlpha: 0, y: 14 });
      });

      const setCounter = (i: number) => {
        if (counterRef.current) counterRef.current.textContent = `${pad(i)} / ${pad(count - 1)}`;
        setAt(i);
      };

      const still = stillRef.current;
      const showStill = (i: number) => {
        const slide = slidesRef.current[i];
        if (!still || live || !slide) return;
        still.src = slide.src;
        still.alt = slide.alt;
      };

      /* One lens at a time. `flight` is the pair in the air; `pending` is
         where the scrollbar has moved on to while it was still flying. */
      let flight: {
        from: number;
        to: number;
        tween: gsap.core.Tween;
        copy: gsap.core.Timeline;
      } | null = null;
      let pending: number | null = null;

      const settle = (landed: number) => {
        if (!flight) return;
        const { from, to } = flight;
        flight = null;
        shownRef.current = landed;
        progress.current.value = 0;
        bindRef.current?.(landed, landed);
        articles[from === landed ? to : from]!.setAttribute("aria-hidden", "true");
        articles[landed]!.removeAttribute("aria-hidden");
        setCounter(landed);
        showStill(landed);
        const next = pending;
        pending = null;
        if (next !== null && next !== landed) go(next);
      };

      const go = contextSafe((target: number) => {
        const next = Math.min(Math.max(target, 0), count - 1);
        if (flight) {
          const heading = flight.tween.reversed() ? flight.from : flight.to;
          if (next === heading) {
            // Already on its way there. Whatever the scrollbar had queued on
            // the way past goes: A → B, on to C, back to B used to land on B
            // and then fly on to C by itself.
            pending = null;
          } else if (next === flight.from) {
            // Back to where it came from: the lens shrinks away again.
            flight.tween.reverse();
            flight.copy.reverse();
            setCounter(flight.from);
            pending = null;
          } else if (next === flight.to) {
            flight.tween.play();
            flight.copy.play();
            setCounter(flight.to);
            pending = null;
          } else {
            pending = next;
          }
          return;
        }
        const from = shownRef.current;
        if (next === from) return;

        bindRef.current?.(from, next);
        articles[next]!.removeAttribute("aria-hidden");
        setCounter(next);

        const tween = gsap.fromTo(
          progress.current,
          { value: 0 },
          {
            value: 1,
            duration: live ? LENS_DURATION : 0.9,
            ease: EASE.travel,
            onUpdate: () => {
              dirtyRef.current = true;
            },
            onComplete: () => settle(next),
            onReverseComplete: () => settle(from),
          },
        );

        // Words leave upward through their masks, the next title climbs in
        // behind them; the lines below fade a beat later.
        const tl = gsap.timeline();
        tl.to(
          charsOf(from),
          { yPercent: -110, duration: 0.45, ease: EASE.exit, stagger: 0.018 },
          0,
        );
        tl.to(
          linesOf(from),
          { autoAlpha: 0, y: -10, duration: 0.3, ease: EASE.exit, stagger: 0.05 },
          0,
        );
        tl.fromTo(
          charsOf(next),
          { yPercent: 110 },
          { yPercent: 0, duration: 0.75, ease: EASE.default, stagger: 0.03 },
          0.32,
        );
        tl.fromTo(
          linesOf(next),
          { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, duration: 0.6, ease: EASE.default, stagger: 0.08 },
          0.55,
        );

        // Under Save-Data or without WebGL the still swaps at the midpoint,
        // under cover of the title change.
        if (!live) {
          gsap.delayedCall(0.4, () => {
            if (flight?.to === next) showStill(next);
          });
        }

        flight = { from, to: next, tween, copy: tl };
      });
      goRef.current = go;

      // The first title climbs in once the scene is ready.
      gsap.fromTo(
        charsOf(shownRef.current),
        { yPercent: 110 },
        { yPercent: 0, duration: 0.9, ease: EASE.default, stagger: 0.035, delay: 0.1 },
      );
      setCounter(shownRef.current);

      const trigger = ScrollTrigger.create({
        trigger: stage,
        start: "top top",
        end: "bottom bottom",
        pin: sticky,
        pinSpacing: false,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => go(slideIndexAt(self.progress, count)),
      });

      return () => {
        trigger.kill();
        flight?.tween.kill();
        flight?.copy.kill();
        goRef.current = null;
      };
    },
    // Keyed on the pictures, not on `slides`: the page builds a new array on
    // every render, and each new one tore the pin down and built it again.
    { scope, dependencies: [mode, count, srcKey], revertOnUpdate: true },
  );

  /* Scroll the page to the middle of a slide's band; the pin does the rest. */
  const step = (delta: number) => {
    const stage = stageRef.current;
    const sticky = stickyRef.current;
    if (!stage || !sticky) return;
    const index = Math.min(Math.max(shownRef.current + delta, 0), count - 1);
    // At either end the arrow is aria-disabled but still pressable.
    if (index === shownRef.current) return;
    const top = stage.getBoundingClientRect().top + window.scrollY;
    const y = top + bandCentre(index, count) * (stage.offsetHeight - sticky.offsetHeight);
    if (window.__lenis) {
      window.__lenis.scrollTo(y, { force: true });
    } else {
      window.scrollTo({ top: y, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
  };

  const first = slides[0];

  return (
    <div ref={scope} style={{ "--ls-accent": accent } as CSSProperties}>
      <style href="lab-lens-slider" precedence="medium">
        {CSS}
      </style>

      <div ref={stageRef} className="ls-stage" style={{ "--ls-count": count } as CSSProperties}>
        <div ref={stickyRef} className="ls-sticky" data-mode={mode}>
          {/* Painted first, under the canvas: the cover before the textures land,
              and the whole picture layer when WebGL is not on offer. */}
          {first && (
            // eslint-disable-next-line @next/next/no-img-element -- swapped by hand under the lens
            <img
              ref={stillRef}
              className="ls-still"
              src={first.src}
              alt={first.alt}
              decoding="async"
              fetchPriority="high"
            />
          )}
          <canvas ref={canvasRef} className="ls-canvas" aria-hidden="true" />
          <div className="ls-shade" aria-hidden="true" />

          <div ref={copyRef} className="ls-copy">
            {slides.map((slide, i) => {
              const { lines } = splitText(slide.title);
              return (
                <article
                  key={slide.src}
                  className="ls-slide"
                  aria-hidden={i === 0 ? undefined : "true"}
                >
                  <h2 className="ls-title" aria-label={slide.title}>
                    {lines.map((words, li) => (
                      <span className="ls-line" key={li}>
                        {words.map((word, wi) =>
                          word.isSpace ? (
                            <span className="ls-space" key={wi} aria-hidden="true">
                              {" "}
                            </span>
                          ) : (
                            <span className="ls-word" key={wi} aria-hidden="true">
                              {word.chars.map((ch) => (
                                <span className="ls-char" key={ch.index}>
                                  {ch.char}
                                </span>
                              ))}
                            </span>
                          ),
                        )}
                      </span>
                    ))}
                  </h2>
                  <p className="ls-body">{slide.body}</p>
                  <p className="ls-meta">{slide.meta}</p>
                </article>
              );
            })}
          </div>

          <div className="ls-nav">
            {/* aria-disabled rather than disabled at the ends: a disabled
                button drops the focus it had to <body>, and the press that
                reached the last slide is the one holding it. */}
            <button
              type="button"
              className="ls-btn"
              aria-label={prevLabel}
              aria-disabled={at === 0 || undefined}
              onClick={() => step(-1)}
            >
              ←
            </button>
            {/* A status region, so the name is read with it — on a bare span
                aria-label is ignored. */}
            <span ref={counterRef} className="ls-counter" role="status" aria-label={counterAria}>
              {pad(0)} / {pad(count - 1)}
            </span>
            <button
              type="button"
              className="ls-btn"
              aria-label={nextLabel}
              aria-disabled={at === count - 1 || undefined}
              onClick={() => step(1)}
            >
              →
            </button>
          </div>

          {mode === "degraded" && (
            <p className="ls-note">{saveData ? saveDataNote : fallbackNote}</p>
          )}
          <p className="ls-hint" aria-hidden="true">
            {hint}
          </p>
        </div>
      </div>
    </div>
  );
}

const CSS = `
/* One viewport per slide; the first and last get half a band each. */
.ls-stage { position: relative; height: calc(var(--ls-count, 4) * 100svh); }
.ls-sticky {
  position: relative;
  height: 100svh;
  overflow: hidden;
  border-block: 1px solid var(--line);
  background: #101210;
  color: #f3f1ea;
}

.ls-still,
.ls-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.ls-still { object-fit: cover; }
/* Once the lens is live the still has done its job as the cover. */
.ls-sticky[data-mode="live"] .ls-still { visibility: hidden; }
.ls-sticky[data-mode="degraded"] .ls-canvas { visibility: hidden; }

/* Ink over a photograph needs a little dusk under it. */
.ls-shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(70% 60% at 50% 50%, rgba(0, 0, 0, 0.22) 0%, rgba(0, 0, 0, 0) 100%),
    linear-gradient(180deg, rgba(0, 0, 0, 0.18) 0%, rgba(0, 0, 0, 0) 30%, rgba(0, 0, 0, 0) 70%, rgba(0, 0, 0, 0.3) 100%);
}

.ls-copy {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}
.ls-slide {
  grid-area: 1 / 1;
  width: min(48ch, 88vw);
  text-align: center;
}
.ls-slide[aria-hidden="true"] { visibility: hidden; }

.ls-title {
  margin: 0;
  font-size: clamp(2.2rem, 7vw, 5.2rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.08;
  text-shadow: 0 2px 30px rgba(0, 0, 0, 0.45);
}
.ls-title:lang(zh) { letter-spacing: 0.02em; }
.ls-line { display: block; }
/* The mask: each word clips its own characters as they climb in and out. */
.ls-word {
  display: inline-block;
  overflow: hidden;
  vertical-align: top;
  padding-bottom: 0.08em;
  margin-bottom: -0.08em;
}
.ls-space { display: inline-block; white-space: pre; }
.ls-char { display: inline-block; will-change: transform; }

.ls-body {
  margin: 1.1rem auto 0;
  max-width: 36ch;
  font-size: 0.9375rem;
  line-height: 1.7;
  opacity: 0.86;
  text-shadow: 0 1px 18px rgba(0, 0, 0, 0.5);
}
.ls-meta {
  margin: 1.2rem 0 0;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(243, 241, 234, 0.72);
  text-shadow: 0 1px 14px rgba(0, 0, 0, 0.5);
}

.ls-nav {
  position: absolute;
  left: clamp(1rem, 4vw, 2.5rem);
  bottom: clamp(1rem, 4vw, 2.5rem);
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.16em;
  color: rgba(243, 241, 234, 0.72);
}
/* 44px, the site's touch floor. */
.ls-btn {
  width: 2.75rem;
  height: 2.75rem;
  border: 1px solid rgba(243, 241, 234, 0.28);
  border-radius: 999px;
  background: rgba(16, 18, 16, 0.32);
  color: inherit;
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 0.25s ease-out, color 0.25s ease-out;
}
.ls-btn:hover,
.ls-btn:focus-visible { border-color: var(--ls-accent); color: #fff; }
.ls-btn[aria-disabled="true"] { opacity: 0.35; cursor: default; }
.ls-btn[aria-disabled="true"]:hover { border-color: rgba(243, 241, 234, 0.28); color: inherit; }
.ls-counter { min-width: 4.5em; text-align: center; font-variant-numeric: tabular-nums; }

.ls-note {
  position: absolute;
  inset: auto 0 clamp(4.5rem, 10vw, 6rem);
  margin: 0 auto;
  max-width: min(36ch, 82vw);
  text-align: center;
  font-size: 0.8125rem;
  line-height: 1.6;
  opacity: 0.66;
}
.ls-hint {
  position: absolute;
  right: clamp(1rem, 4vw, 2.5rem);
  bottom: clamp(1rem, 4vw, 2.5rem);
  margin: 0;
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(243, 241, 234, 0.42);
}
`;
