import { useEffect, type RefObject } from "react";
import { gsap, EASE, isFinePointer } from "@/lib/client/gsap";
import { stopMusic, wantMusic } from "@/lib/client/jukebox";
import {
  LETTER_SEGS,
  STUTTER,
  score,
  writeLightScore,
  writeOffScore,
  type SegName,
} from "./NeonSignArt";
import { layoutWall } from "./wall";

/**
 * The two places the sign hangs — the front door (home/NeonSplash) and the
 * lab's study of it (lab/NeonSignDemo) — are the same wall and the same
 * switch with different ways in and out. What they share lives here; they
 * used to carry a copy each, and the copies had started to drift.
 */

/** Paints the brick wall behind the sign, and again whenever the stage
 *  resizes — once a frame at most. `active` holds it off until the wall is
 *  actually on screen (the door decides that after mount). */
export function useBrickWall(
  stage: RefObject<HTMLElement | null>,
  wall: RefObject<HTMLCanvasElement | null>,
  sign: RefObject<HTMLElement | null>,
  active = true,
) {
  useEffect(() => {
    if (!active) return;
    const stageEl = stage.current;
    const wallEl = wall.current;
    const signEl = sign.current;
    if (!stageEl || !wallEl || !signEl) return;
    let frame = 0;
    const layout = () => {
      frame = 0;
      layoutWall(stageEl, wallEl, signEl);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(layout);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(stageEl);
    schedule();
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [active, stage, wall, sign]);
}

export type NeonSign = {
  /** The lit layer of one segment of the sign. */
  seg: (name: SegName) => Element[];
  letters: Element[][];
  /** The score that lights it, played on every power-on. */
  main: gsap.core.Timeline;
  powerOn: () => void;
  powerOff: () => void;
  toggle: () => void;
  /**
   * The light alone, to match music that changed somewhere else — the note on
   * the island, a record that would not load. It does not write back: a load
   * failure put through `powerOff` became the reader's own "no" (`silenced`).
   */
  follow: (on: boolean) => void;
  /** One tube loses its nerve for a moment under the pointer. */
  stutter: () => void;
  /** Stops everything that moves on its own — the door's way in. */
  freeze: () => void;
  kill: () => void;
};

/**
 * Wires the sign inside a GSAP context: the lighting score and its reverse,
 * the switch (which is also the bar's music — `lib/client/jukebox`), the stutter,
 * and the parallax that has the sign hang a little in front of the wall.
 *
 * `held` answers true while the sign must not respond — the door is being
 * walked through. `pointer` turns a pointer event into the offset from the
 * middle of whatever the sign is centred in (-0.5…0.5 each way).
 */
export function wireNeonSign({
  svg,
  spill,
  sign,
  stage,
  welcome,
  welcomeStagger = 0,
  poweredRef,
  setPowered,
  held = () => false,
  pointer,
}: {
  svg: SVGSVGElement;
  spill: HTMLElement;
  sign: HTMLElement;
  stage: HTMLElement;
  /** Faded in the first time the sign lights. */
  welcome: HTMLElement[];
  welcomeStagger?: number;
  poweredRef: { current: boolean };
  setPowered: (on: boolean) => void;
  held?: () => boolean;
  pointer: (e: PointerEvent) => { nx: number; ny: number };
}): NeonSign {
  const q = gsap.utils.selector(svg);
  const seg = (name: SegName) => q(`.neon-seg[data-seg="${name}"]`);
  const letters = LETTER_SEGS.map(seg);
  const lit = q(".neon-lit");

  const main = gsap.timeline({ paused: true });
  writeLightScore(main, seg, [spill]);
  const off = gsap.timeline({ paused: true });
  writeOffScore(off, lit, [spill], EASE.exit);

  let welcomed = false;
  const lightOn = (): boolean => {
    if (poweredRef.current || held()) return false;
    poweredRef.current = true;
    setPowered(true);
    off.pause(0);
    gsap.set(lit, { opacity: 1 });
    if (!welcomed) {
      welcomed = true;
      gsap.fromTo(
        welcome,
        { autoAlpha: 0, filter: "blur(6px)" },
        {
          autoAlpha: 1,
          filter: "blur(0px)",
          duration: 1.1,
          ease: EASE.default,
          stagger: welcomeStagger,
        },
      );
    }
    main.restart();
    return true;
  };
  const lightOff = (): boolean => {
    if (!poweredRef.current || held()) return false;
    poweredRef.current = false;
    setPowered(false);
    main.pause();
    off.restart();
    return true;
  };
  // The switch: the light, and the reader's word on the music with it.
  const powerOn = () => {
    if (lightOn()) wantMusic();
  };
  const powerOff = () => {
    if (lightOff()) stopMusic();
  };

  let stutterTl: gsap.core.Timeline | null = null;
  const stutter = () => {
    if (
      !poweredRef.current ||
      held() ||
      main.isActive() ||
      stutterTl?.isActive() ||
      !isFinePointer()
    )
      return;
    const i = Math.floor(Math.random() * letters.length);
    stutterTl = gsap.timeline();
    score(stutterTl, letters[i]!, 0, STUTTER);
  };

  // The sign hangs a little in front of the wall: it rides the pointer more
  // than the light it throws does.
  let onMove: ((e: PointerEvent) => void) | null = null;
  if (isFinePointer()) {
    const signX = gsap.quickTo(sign, "x", { duration: 0.7, ease: EASE.default });
    const signY = gsap.quickTo(sign, "y", { duration: 0.7, ease: EASE.default });
    const spillX = gsap.quickTo(spill, "x", { duration: 0.9, ease: EASE.default });
    const spillY = gsap.quickTo(spill, "y", { duration: 0.9, ease: EASE.default });
    onMove = (e) => {
      if (held()) return;
      const { nx, ny } = pointer(e);
      signX(nx * 16);
      signY(ny * 12);
      spillX(nx * 9);
      spillY(ny * 7);
    };
    stage.addEventListener("pointermove", onMove, { passive: true });
  }
  const stopParallax = () => {
    if (onMove) stage.removeEventListener("pointermove", onMove);
    onMove = null;
  };

  return {
    seg,
    letters,
    main,
    powerOn,
    powerOff,
    toggle: () => (poweredRef.current ? powerOff() : powerOn()),
    follow: (on) => void (on ? lightOn() : lightOff()),
    stutter,
    freeze: () => {
      stutterTl?.kill();
      main.pause();
      stopParallax();
    },
    kill: () => {
      main.kill();
      off.kill();
      stutterTl?.kill();
      stopParallax();
    },
  };
}
