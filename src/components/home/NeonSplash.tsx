"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP, EASE, isFinePointer } from "@/lib/gsap";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import { OVERTURE_DONE_EVENT, OVERTURE_SEEN_KEY } from "@/components/fx/OvertureLight";
import { SPLASH_INIT_SCRIPT, SPLASH_SEEN_KEY, splashDebug, splashDue } from "@/lib/splash";
import { stopMusic, useJukebox, wantMusic } from "@/lib/jukebox";
import {
  NeonSignArt,
  RING,
  LETTER_SEGS,
  STUTTER,
  score,
  writeLightScore,
  writeOffScore,
  type SegName,
} from "@/components/neon/NeonSignArt";
import { layoutWall, WALL_CSS } from "@/components/neon/wall";

type Props = {
  /** The dialog's accessible name: what the sign says. */
  label: string;
  welcome: string;
  signOn: string;
  signOff: string;
  toggleHint: string;
  enter: string;
  enterHint: string;
  tonight: string;
  trackTitle: string;
  trackArtist: string;
  /** The artist line when the stand-in recording is what plays. */
  fallbackTrackArtist: string;
};

type Phase = "pending" | "up" | "done";

/** Timeline landmarks of the way in (s). */
const LIGHTS_AT = 0.4;
const IRIS_AT = 0.3;
const IRIS_FOR = 0.45;
const DONE_AT = 0.8;
const PUSH_AT = 0.75;
const PUSH_FOR = 1.0;

/**
 * The front door: welcome to fhf's.
 *
 * The neon over the door of Seb's, re-lettered, on a brick wall the size of
 * the viewport — the first thing a reader landing on the cover sees, once
 * per session. The sign lights up by itself and asks for the music; the sign
 * is the switch for both (`lib/jukebox` — the player is behind the wall, in
 * the layout, so the tune follows the reader inside). The way in is through
 * the ring: the letters go dark, the ring holds, the paper of the cover
 * shows through it as an iris opens, and the wall pushes past the reader
 * with the ring growing around them until the tube has left the corners of
 * the screen. The masthead rises behind it on the overture's done event —
 * this door stands in for the opening ritual on the cover.
 *
 * Mechanics: the "due" decision is made before first paint by an inline
 * script (`lib/splash`), so a returning reader never sees the wall flash and
 * a reader arriving by client navigation never sees it at all; scroll is
 * locked under the lenis contract while the door is up; the way in is the
 * button, Enter/Space/Escape, a wheel or a swipe once the sign holds; the
 * push is one transform on a masked layer — the hole tracks the ring
 * because the mask lives in the layer's own coordinates and scales with it.
 */
export function NeonSplash({
  label,
  welcome,
  signOn,
  signOff,
  toggleHint,
  enter,
  enterHint,
  tonight,
  trackTitle,
  trackArtist,
  fallbackTrackArtist,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const wallRef = useRef<HTMLCanvasElement>(null);
  const spillRef = useRef<HTMLDivElement>(null);
  const welcomeRef = useRef<HTMLParagraphElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const switchRef = useRef<HTMLButtonElement>(null);
  const enterRef = useRef<HTMLButtonElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [phase, setPhase] = useState<Phase>("pending");
  const [powered, setPowered] = useState(false);
  const poweredRef = useRef(false);
  const { fallback } = useJukebox();
  /** Set by the choreography; the buttons call them. */
  const toggleRef = useRef<(() => void) | null>(null);
  const stutterRef = useRef<(() => void) | null>(null);
  const enterRefFn = useRef<(() => void) | null>(null);

  /* ---- the wall ---- */
  useEffect(() => {
    if (phase !== "up") return;
    const stage = stageRef.current;
    const wall = wallRef.current;
    const sign = switchRef.current;
    if (!stage || !wall || !sign) return;
    let frame = 0;
    const layout = () => {
      frame = 0;
      layoutWall(stage, wall, sign);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(layout);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(stage);
    schedule();
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [phase]);

  /* ---- the choreography ---- */
  useGSAP(
    (_ctx, contextSafe) => {
      const root = rootRef.current;
      const stage = stageRef.current;
      const svg = svgRef.current;
      const spill = spillRef.current;
      const welcomeEl = welcomeRef.current;
      const hintEl = hintRef.current;
      const foot = footRef.current;
      const sign = switchRef.current;
      const enterBtn = enterRef.current;
      if (!root || !stage || !svg || !spill || !welcomeEl || !hintEl || !foot || !sign || !enterBtn || !contextSafe) {
        return;
      }

      // Not owed: a returning reader, a client navigation, blocked storage.
      if (!splashDue()) {
        setPhase("done");
        return;
      }
      setPhase("up");
      const debug = splashDebug();

      lockScroll();
      let locked = true;
      const unlock = () => {
        if (!locked) return;
        locked = false;
        unlockScroll({ refresh: true });
      };

      const q = gsap.utils.selector(svg);
      const seg = (name: SegName) => q(`.neon-seg[data-seg="${name}"]`);
      const ring = seg("ring");
      const bar = seg("bar");
      const note = seg("note");
      const letters = LETTER_SEGS.map(seg);
      const lit = q(".neon-lit");

      const main = gsap.timeline({ paused: true });
      writeLightScore(main, seg, [spill]);
      const off = gsap.timeline({ paused: true });
      writeOffScore(off, lit, [spill], EASE.exit);

      let welcomed = false;
      let entering = false;
      const powerOn = () => {
        if (poweredRef.current || entering) return;
        poweredRef.current = true;
        setPowered(true);
        off.pause(0);
        gsap.set(lit, { opacity: 1 });
        if (!welcomed) {
          welcomed = true;
          gsap.fromTo(
            [welcomeEl, foot],
            { autoAlpha: 0, filter: "blur(6px)" },
            { autoAlpha: 1, filter: "blur(0px)", duration: 1.1, ease: EASE.default, stagger: 0.25 }
          );
        }
        wantMusic();
        main.restart();
      };
      const powerOff = () => {
        if (!poweredRef.current || entering) return;
        poweredRef.current = false;
        setPowered(false);
        main.pause();
        off.restart();
        stopMusic();
      };
      toggleRef.current = contextSafe(() => (poweredRef.current ? powerOff() : powerOn()));

      // One tube loses its nerve for a moment under the pointer.
      let stutter: gsap.core.Timeline | null = null;
      stutterRef.current = contextSafe(() => {
        if (!poweredRef.current || entering || main.isActive() || stutter?.isActive() || !isFinePointer()) return;
        const i = Math.floor(Math.random() * letters.length);
        stutter = gsap.timeline();
        score(stutter, letters[i], 0, STUTTER);
      });

      // The sign hangs a little in front of the wall: it rides the pointer
      // more than the light it throws does.
      let onMove: ((e: PointerEvent) => void) | null = null;
      if (isFinePointer()) {
        const signX = gsap.quickTo(sign, "x", { duration: 0.7, ease: EASE.default });
        const signY = gsap.quickTo(sign, "y", { duration: 0.7, ease: EASE.default });
        const spillX = gsap.quickTo(spill, "x", { duration: 0.9, ease: EASE.default });
        const spillY = gsap.quickTo(spill, "y", { duration: 0.9, ease: EASE.default });
        onMove = (e) => {
          if (entering) return;
          const nx = e.clientX / window.innerWidth - 0.5;
          const ny = e.clientY / window.innerHeight - 0.5;
          signX(nx * 16);
          signY(ny * 12);
          spillX(nx * 9);
          spillY(ny * 7);
        };
        stage.addEventListener("pointermove", onMove, { passive: true });
      }

      // Initial states, set in JS so the SSR markup stays a finished, dark wall.
      gsap.set([welcomeEl, foot], { autoAlpha: 0 });
      // A beat of dark wall, then the transformer warms up.
      const lightsCall = gsap.delayedCall(LIGHTS_AT, powerOn);

      /* ---- the way in ---- */
      let exit: gsap.core.Timeline | null = null;
      const finish = () => {
        unlock();
        document.removeEventListener("focusin", onFocusIn);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("wheel", onWheel);
        window.removeEventListener("touchstart", onTouchStart);
        window.removeEventListener("touchmove", onTouchMove);
        document.documentElement.dataset.splash = "seen";
        if (!debug) {
          try {
            sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
            // The opening ritual is not owed after the door: the masthead
            // and the lamp both read this key.
            sessionStorage.setItem(OVERTURE_SEEN_KEY, "1");
          } catch {
            /* Showing the door again beats crashing the page. */
          }
        }
        setPhase("done");
      };

      const goIn = () => {
        if (entering) return;
        entering = true;
        lightsCall.kill();
        stutter?.kill();
        main.pause();
        if (onMove) stage.removeEventListener("pointermove", onMove);

        // The door lights to let the reader through, whatever the switch says.
        gsap.set([ring, note], { opacity: 1 });

        // The ring, where it hangs right now (parallax included).
        const box = svg.getBoundingClientRect();
        const cx = box.left + box.width * RING.cx;
        const cy = box.top + box.height * RING.cy;
        const rIn = box.width * RING.inner;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const far = Math.max(
          Math.hypot(cx, cy),
          Math.hypot(vw - cx, cy),
          Math.hypot(cx, vh - cy),
          Math.hypot(vw - cx, vh - cy)
        );
        // Far enough that the tube's inner edge has cleared the last corner.
        const S = (far / rIn) * 1.06 + 0.1;

        stage.style.transformOrigin = `${cx}px ${cy}px`;
        stage.style.setProperty("--ns-cx", `${cx}px`);
        stage.style.setProperty("--ns-cy", `${cy}px`);
        stage.style.setProperty("--ns-hole", "0px");
        stage.classList.add("is-opening");

        const p = { u: 0, s: 1 };
        const apply = () => {
          stage.style.setProperty("--ns-hole", `${(rIn * p.u).toFixed(1)}px`);
          stage.style.transform = `scale(${p.s.toFixed(4)})`;
        };

        const tl = gsap.timeline({ onComplete: finish });
        exit = tl;
        tl.to([welcomeEl, hintEl, foot], { autoAlpha: 0, duration: 0.25, ease: EASE.exit }, 0);
        // The letters and the bar lose power; the ring and the note hold the door.
        letters.forEach((l, i) => score(tl, l, 0.05 + i * 0.04, [[0.04, 0], [0.03, 0.5], [0.04, 0]]));
        score(tl, bar, 0.12, [[0.05, 0], [0.04, 0.6], [0.04, 0]]);
        tl.to(spill, { opacity: 0.5, duration: 0.35, ease: "none" }, 0.1);
        // The iris: paper shows through the ring.
        tl.to(p, { u: 1, duration: IRIS_FOR, ease: "power2.inOut", onUpdate: apply }, IRIS_AT);
        // Relay: the masthead starts rising as the ring begins to grow.
        tl.add(() => window.dispatchEvent(new Event(OVERTURE_DONE_EVENT)), DONE_AT);
        // The push: through the door, the ring growing around the reader.
        tl.to(p, { s: S, duration: PUSH_FOR, ease: "power2.in", onUpdate: apply }, PUSH_AT);
      };
      enterRefFn.current = contextSafe(goIn);

      // The wall is opaque, so anything focusable behind it would take an
      // invisible focus ring — and Enter would activate an unseen link.
      const onFocusIn = (e: FocusEvent) => {
        const target = e.target;
        if (target instanceof Node && !root.contains(target)) enterBtn.focus({ preventScroll: true });
      };
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.target === sign && (e.key === "Enter" || e.key === " ")) return;
        if (e.target === enterBtn && (e.key === "Enter" || e.key === " ")) return;
        if (["Enter", " ", "Escape", "ArrowDown", "PageDown"].includes(e.key)) {
          e.preventDefault();
          goIn();
        }
      };
      // A wheel or a swipe down is the same wish, once the sign holds.
      const ready = () => poweredRef.current && !main.isActive();
      const onWheel = (e: WheelEvent) => {
        if (e.deltaY > 20 && ready()) goIn();
      };
      let touchY: number | null = null;
      const onTouchStart = (e: TouchEvent) => {
        touchY = e.touches[0]?.clientY ?? null;
      };
      const onTouchMove = (e: TouchEvent) => {
        const y = e.touches[0]?.clientY;
        if (touchY !== null && y !== undefined && touchY - y > 48 && ready()) goIn();
      };
      document.addEventListener("focusin", onFocusIn);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("wheel", onWheel, { passive: true });
      window.addEventListener("touchstart", onTouchStart, { passive: true });
      window.addEventListener("touchmove", onTouchMove, { passive: true });

      return () => {
        lightsCall.kill();
        main.kill();
        off.kill();
        stutter?.kill();
        exit?.kill();
        toggleRef.current = null;
        stutterRef.current = null;
        enterRefFn.current = null;
        if (onMove) stage.removeEventListener("pointermove", onMove);
        document.removeEventListener("focusin", onFocusIn);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("wheel", onWheel);
        window.removeEventListener("touchstart", onTouchStart);
        window.removeEventListener("touchmove", onTouchMove);
        // Restore scroll even if we unmount mid-way (a locale switch).
        unlock();
        // The lights belong to this run: a re-run (dev's double mount)
        // starts dark again, or its call would find the switch already
        // thrown and never light the sign.
        poweredRef.current = false;
        setPowered(false);
      };
    },
    { scope: rootRef }
  );

  if (phase === "done") return null;

  return (
    <>
      {/* The pre-paint decision, as raw HTML: see ThemeInitScript for why a
          script goes through a wrapper element rather than a React <script>. */}
      <div hidden suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `<script>${SPLASH_INIT_SCRIPT}</script>` }} />
      <div ref={rootRef} className="ns" role="dialog" aria-modal="true" aria-label={label}>
        <style href="home-neon-splash" precedence="medium">
          {WALL_CSS + CSS}
        </style>
        <div ref={stageRef} className="nb-stage ns-stage">
          <canvas ref={wallRef} className="nb-wall" aria-hidden="true" />
          <div ref={spillRef} className="nb-spill" aria-hidden="true" />

          <div className="ns-room">
            <div className="ns-body">
              <p ref={welcomeRef} className="ns-welcome">
                {welcome}
              </p>
              <button
                ref={switchRef}
                type="button"
                className="ns-switch"
                aria-pressed={powered}
                aria-label={powered ? signOff : signOn}
                onClick={() => toggleRef.current?.()}
                onPointerEnter={() => stutterRef.current?.()}
              >
                <NeonSignArt id="ns" svgRef={svgRef} className="ns-sign" />
              </button>
              <p ref={hintRef} className="ns-hint">
                {toggleHint}
              </p>
            </div>

            <div ref={footRef} className="ns-foot">
              <button ref={enterRef} type="button" className="ns-enter" onClick={() => enterRefFn.current?.()}>
                <span>{enter}</span>
                <span className="ns-enter-arrow" aria-hidden="true">
                  →
                </span>
              </button>
              <p className="ns-enter-hint">{enterHint}</p>
              <p className="ns-track">
                <span className="ns-kicker">{tonight}</span>
                <span className="ns-track-title">{trackTitle}</span>
                <span className="ns-track-artist">{fallback ? fallbackTrackArtist : trackArtist}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const CSS = `
/* Decided before first paint: a returning reader never sees the wall, and a
   reader without scripting is not shut behind a door that cannot open. */
html[data-splash="seen"] .ns,
html:not([data-js]) .ns { display: none; }

.ns {
  position: fixed;
  inset: 0;
  z-index: 96;
  color: #f3f1ea;
}
.ns-stage {
  position: absolute;
  inset: 0;
  border: 0;
}
/* The way in: a hole in the wall where the ring is, in the wall's own
   coordinates so the one transform carries it. */
.ns-stage.is-opening {
  will-change: transform;
  -webkit-mask-image: radial-gradient(
    circle at var(--ns-cx, 50%) var(--ns-cy, 55%),
    transparent var(--ns-hole, 0px),
    #000 calc(var(--ns-hole, 0px) + 1px)
  );
  mask-image: radial-gradient(
    circle at var(--ns-cx, 50%) var(--ns-cy, 55%),
    transparent var(--ns-hole, 0px),
    #000 calc(var(--ns-hole, 0px) + 1px)
  );
}

.ns-room {
  position: relative;
  z-index: 2;
  height: 100%;
  display: grid;
  grid-template-rows: 1fr auto;
}
.ns-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(0.5rem, 1.6vh, 1rem);
  padding: clamp(2rem, 6vh, 4rem) 1.5rem 0.25rem;
}

/* The channel letters over the sign: warm, lit from inside, a little haze. */
.ns-welcome {
  margin: 0;
  padding-left: 0.34em;
  font-family: var(--font-stack-serif);
  font-size: clamp(1.05rem, 2.6vw, 1.7rem);
  font-weight: 400;
  letter-spacing: 0.34em;
  text-transform: uppercase;
  color: #f6eedf;
  text-shadow:
    0 0 10px rgba(255, 236, 210, 0.55),
    0 0 30px rgba(255, 222, 184, 0.25);
}

.ns-switch {
  appearance: none;
  display: block;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  border-radius: 50%;
  line-height: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  will-change: transform;
}
.ns-switch:focus-visible {
  outline: 2px solid rgba(180, 200, 255, 0.85);
  outline-offset: 14px;
}
.ns-switch:active { transform: none; }

.ns-sign {
  display: block;
  width: min(52vh, 82vw, 520px);
  aspect-ratio: 1;
  height: auto;
  overflow: visible;
}

.ns-hint {
  margin: 0.25rem 0 0;
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(243, 241, 234, 0.42);
}

.ns-foot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 1rem 1.5rem max(clamp(1.5rem, 5vh, 3rem), env(safe-area-inset-bottom));
}

/* The way in: one warm control, in the letters' light. */
.ns-enter {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 0.6em;
  min-height: 2.75rem;
  margin: 0;
  padding: 0.7rem 1.4rem;
  border: 1px solid rgba(246, 238, 223, 0.32);
  border-radius: 999px;
  background: rgba(10, 10, 15, 0.35);
  font-family: var(--font-stack-mono);
  font-size: 0.75rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #f6eedf;
  text-shadow: 0 0 12px rgba(255, 236, 210, 0.35);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: border-color 0.3s, box-shadow 0.3s, background-color 0.3s;
}
.ns-enter:hover,
.ns-enter:focus-visible {
  border-color: rgba(246, 238, 223, 0.7);
  box-shadow: 0 0 24px rgba(255, 222, 184, 0.16);
  background: rgba(10, 10, 15, 0.5);
}
.ns-enter:focus-visible {
  outline: 2px solid rgba(180, 200, 255, 0.85);
  outline-offset: 4px;
}
.ns-enter:active { transform: scale(0.97); }
.ns-enter-arrow {
  display: inline-block;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.ns-enter:hover .ns-enter-arrow { transform: translateX(3px); }

.ns-enter-hint {
  margin: 0;
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(243, 241, 234, 0.38);
}

.ns-track {
  margin: 0.5rem 0 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: baseline;
  gap: 0.25rem 0.75rem;
  text-align: center;
  font-size: 0.8125rem;
  line-height: 1.5;
}
.ns-kicker {
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(243, 241, 234, 0.5);
}
.ns-track-title { color: rgba(243, 241, 234, 0.85); }
.ns-track-artist { color: rgba(243, 241, 234, 0.45); }

@media (max-height: 640px) {
  .ns-enter-hint { display: none; }
  .ns-track { display: none; }
}
`;
