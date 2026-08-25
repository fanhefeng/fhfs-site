"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";
import { ScrollVideo } from "@/lib/scrollVideo";

type Props = {
  accent: string;
  hint: string;
  loading: string;
  captionOne: string;
  captionOneBody: string;
  captionTwo: string;
  captionTwoBody: string;
};

type Manifest = {
  frameCount: number;
  pattern: string;
  padding?: number;
};

const BASE = "/lab/scroll-video";
/** First pass fetches every Nth frame; the loader ring tracks that pass only. */
const WARMUP_STEP = 6;

/**
 * Scroll-as-playhead: a frame sequence painted onto a canvas, with the frame
 * number driven by ScrollTrigger rather than by a media element. There is no
 * `<video>` here — scrolling back simply draws in reverse, which is the whole
 * point (a real video seeks, and seeking backwards stutters).
 *
 * The tall `.sv-stage` supplies the scroll distance while its inner sticky
 * layer is pinned, so the canvas holds the viewport for five screens.
 */
export function ScrollVideoDemo({
  accent,
  hint,
  loading,
  captionOne,
  captionOneBody,
  captionTwo,
  captionTwoBody,
}: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<ScrollVideo | null>(null);

  const [frameCount, setFrameCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  // Load the manifest, then the frames. Kept out of useGSAP: it is async work
  // with its own teardown, and the scroll wiring must not run until the first
  // pass has landed.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let player: ScrollVideo | null = null;

    void (async () => {
      try {
        const res = await fetch(`${BASE}/manifest.json`);
        if (!res.ok) throw new Error(`manifest: HTTP ${res.status}`);
        const manifest: Manifest = await res.json();
        if (cancelled) return;

        const pad = manifest.padding ?? 4;
        player = new ScrollVideo({
          canvas,
          frameCount: manifest.frameCount,
          src: (n) =>
            `${BASE}/frames/${manifest.pattern.replace(
              "%d",
              String(n).padStart(pad, "0")
            )}`,
          warmupStep: WARMUP_STEP,
          onProgress: (loaded, total) => {
            if (cancelled) return;
            // Track the sparse first pass, not the full download — the reader
            // is allowed to scroll long before every frame is in.
            const warmupTotal = Math.ceil(total / WARMUP_STEP);
            setProgress(Math.min(loaded / warmupTotal, 1));
          },
        });
        playerRef.current = player;
        setFrameCount(manifest.frameCount);

        await player.load();
        if (cancelled) return;
        setReady(true);
        ScrollTrigger.refresh();
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      player?.destroy();
      playerRef.current = null;
    };
  }, []);

  useGSAP(
    () => {
      const player = playerRef.current;
      const stage = stageRef.current;
      const sticky = stickyRef.current;
      if (!ready || !player || !stage || !sticky || frameCount < 2) return;

      const captions = gsap.utils.toArray<HTMLElement>(".sv-caption", scope.current);
      const lastFrame = frameCount - 1;
      const state = { frame: 0 };

      // Both conditions must cover every width: a matchMedia callback only
      // runs while at least one query matches, so a gap silently disables it.
      const mm = gsap.matchMedia();
      mm.add(
        {
          isDesktop: "(min-width: 768px)",
          isMobile: "(max-width: 767px)",
          reduced: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { isDesktop, reduced } = context.conditions as {
            isDesktop: boolean;
            reduced: boolean;
          };

          const tween = gsap.to(state, {
            frame: lastFrame,
            ease: "none",
            snap: "frame", // frame numbers are integers; don't tween through halves
            scrollTrigger: {
              trigger: stage,
              start: "top top",
              end: "bottom bottom",
              pin: sticky,
              pinSpacing: false, // .sv-stage's own height is the scroll distance
              anticipatePin: 1,
              invalidateOnRefresh: true,
              // Catch-up in seconds. Reduced motion gets `true` — strict
              // tracking, no inertia.
              scrub: reduced ? true : isDesktop ? 0.35 : 0.15,
            },
            onUpdate: () => {
              const p = state.frame / lastFrame;
              player.seek(p);

              const hud = scope.current?.querySelector<HTMLElement>(".sv-hud-frame");
              const bar = scope.current?.querySelector<HTMLElement>(".sv-hud-bar i");
              if (hud) hud.textContent = String(Math.round(state.frame) + 1).padStart(4, "0");
              if (bar) bar.style.transform = `scaleX(${p})`;

              const active = Math.min(
                Math.floor(p * captions.length),
                captions.length - 1
              );
              captions.forEach((el, i) =>
                el.classList.toggle("is-active", i === active)
              );
            },
          });

          return () => {
            tween.scrollTrigger?.kill();
            tween.kill();
          };
        }
      );

      return () => mm.revert();
    },
    { scope, dependencies: [ready, frameCount] }
  );

  return (
    <div ref={scope} style={{ "--sv-accent": accent } as CSSProperties}>
      <style href="lab-scroll-video" precedence="medium">
        {CSS}
      </style>

      <div ref={stageRef} className="sv-stage">
        <div ref={stickyRef} className="sv-sticky">
          <canvas ref={canvasRef} className="sv-canvas" aria-hidden="true" />

          {!ready && (
            <div className="sv-loader">
              <span className="sv-loader-ring" aria-hidden="true">
                <i style={{ transform: `scaleX(${progress})` }} />
              </span>
              <p className="sv-loader-label">
                {failed ? "—" : `${loading} · ${Math.round(progress * 100)}%`}
              </p>
            </div>
          )}

          <div className="sv-overlay" aria-hidden="true">
            <div className="sv-caption is-active">
              <h2>{captionOne}</h2>
              <p>{captionOneBody}</p>
            </div>
            <div className="sv-caption">
              <h2>{captionTwo}</h2>
              <p>{captionTwoBody}</p>
            </div>
          </div>

          <div className="sv-hud" aria-hidden="true">
            <span className="sv-hud-key">FRAME</span>
            <span className="sv-hud-frame">0001</span>
            <span className="sv-hud-bar">
              <i />
            </span>
          </div>

          <p className="sv-hint" aria-hidden="true">
            {hint}
          </p>
        </div>
      </div>
    </div>
  );
}

const CSS = `
/* Five screens of scroll distance for the pinned canvas to chew through. */
.sv-stage { position: relative; height: 500vh; }
.sv-sticky {
  position: relative;
  height: 100svh;
  overflow: hidden;
  background: #0a0a0c;
  border-block: 1px solid var(--line);
}
.sv-canvas { display: block; width: 100%; height: 100%; }

.sv-loader {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.9rem;
  background: #0a0a0c;
}
.sv-loader-ring {
  display: block;
  width: min(180px, 40vw);
  height: 2px;
  background: rgba(255, 255, 255, 0.16);
  overflow: hidden;
}
.sv-loader-ring i {
  display: block;
  height: 100%;
  background: var(--sv-accent);
  transform-origin: 0 50%;
  transition: transform 0.3s ease-out;
}
.sv-loader-label {
  margin: 0;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
}

.sv-overlay { position: absolute; inset: 0; display: grid; place-items: center; }
.sv-caption {
  grid-area: 1 / 1;
  max-width: min(30ch, 78vw);
  text-align: center;
  color: #fff;
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.5s ease-out, transform 0.5s ease-out;
}
.sv-caption.is-active { opacity: 1; transform: none; }
.sv-caption h2 {
  margin: 0;
  font-size: clamp(1.6rem, 4.5vw, 2.6rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  text-shadow: 0 2px 24px rgba(0, 0, 0, 0.55);
}
.sv-caption p {
  margin: 0.75rem 0 0;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.76);
  text-shadow: 0 1px 16px rgba(0, 0, 0, 0.6);
}

.sv-hud {
  position: absolute;
  left: clamp(1rem, 4vw, 2.5rem);
  bottom: clamp(1rem, 4vw, 2.5rem);
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.14em;
  color: rgba(255, 255, 255, 0.5);
}
.sv-hud-frame { color: rgba(255, 255, 255, 0.85); }
.sv-hud-bar {
  display: block;
  width: clamp(60px, 18vw, 140px);
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
  overflow: hidden;
}
.sv-hud-bar i {
  display: block;
  height: 100%;
  background: var(--sv-accent);
  transform-origin: 0 50%;
  transform: scaleX(0);
}

.sv-hint {
  position: absolute;
  right: clamp(1rem, 4vw, 2.5rem);
  bottom: clamp(1rem, 4vw, 2.5rem);
  margin: 0;
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.42);
}
`;
