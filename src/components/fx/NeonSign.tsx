"use client";

import { useRef, useState } from "react";
import { gsap, useGSAP, SplitText } from "@/lib/gsap";

const GLOW_RED =
  "0 0 7px rgba(255,77,109,0.9), 0 0 20px rgba(255,77,109,0.5), 0 0 42px rgba(255,77,109,0.3)";
const GLOW_BLUE =
  "0 0 7px rgba(76,201,240,0.9), 0 0 20px rgba(76,201,240,0.5), 0 0 42px rgba(76,201,240,0.3)";

const INTRO_SEEN_KEY = "neon-intro-seen";
const OVERTURE_SEEN_KEY = "fhfs-overture-seen";
const OVERTURE_DONE_EVENT = "fhfs:overture-done";

type Props = {
  welcome: string;
  name: string;
  tagline: string;
  skipLabel: string;
  children?: React.ReactNode;
};

/**
 * "Welcome to Seb's" style neon sign opening.
 * Tubes light up segment by segment, a couple of letters buzz-flicker
 * before settling, then the rest of the hero fades in from the dark.
 */
export function NeonSign({ welcome, name, tagline, skipLabel, children }: Props) {
  const container = useRef<HTMLElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const [playing, setPlaying] = useState(false);

  useGSAP(
    () => {
      const q = gsap.utils.selector(container);
      const welcomeEl = q(".neon-welcome");
      const nameEl = q(".neon-name");
      const rest = q(".neon-rest");

      const litName = { color: "#ff4d6d", textShadow: GLOW_RED, opacity: 1 };
      const litWelcome = { color: "#4cc9f0", textShadow: GLOW_BLUE, opacity: 1 };
      const setFinal = () => {
        gsap.set(welcomeEl, litWelcome);
        // On repeat visits SplitText never ran, so there are no per-char
        // spans — light the whole headline instead of querying for them.
        gsap.set(nameEl, { ...litName, opacity: 1 });
        gsap.set(rest, { opacity: 1, y: 0 });
      };

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", setFinal);

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (sessionStorage.getItem(INTRO_SEEN_KEY)) {
          setFinal();
          return;
        }

        const split = new SplitText(nameEl, { type: "chars" });
        const chars = split.chars;

        // Unlit initial state — set in JS so no-JS visitors still see content.
        gsap.set(welcomeEl, { opacity: 0.15, textShadow: "none", color: "#4cc9f0" });
        gsap.set(nameEl, { opacity: 1 });
        gsap.set(chars, { opacity: 0.12, textShadow: "none", color: "#ff4d6d" });
        gsap.set(rest, { opacity: 0, y: 16 });

        const tl = gsap.timeline({
          paused: true,
          onStart: () => setPlaying(true),
          onComplete: () => {
            sessionStorage.setItem(INTRO_SEEN_KEY, "1");
            setPlaying(false);
          },
        });

        // 1. "Welcome to" tube hums on with two quick stutters
        tl.to(welcomeEl, { ...litWelcome, duration: 0.08 })
          .to(welcomeEl, { opacity: 0.2, textShadow: "none", duration: 0.05 })
          .to(welcomeEl, { ...litWelcome, duration: 0.06 }, "+=0.12")
          .to(welcomeEl, { opacity: 0.3, textShadow: "none", duration: 0.04 })
          .to(welcomeEl, { ...litWelcome, duration: 0.1 }, "+=0.06");

        // 2. Name letters light up one by one
        tl.to(
          chars,
          { ...litName, duration: 0.18, stagger: 0.07, ease: "power1.in" },
          "+=0.25"
        );

        // 3. One stubborn letter flickers before settling (Seb's homage)
        const stubborn = chars[Math.min(1, chars.length - 1)];
        if (stubborn) {
          tl.to(stubborn, { opacity: 0.15, textShadow: "none", duration: 0.05 })
            .to(stubborn, { ...litName, duration: 0.05 })
            .to(stubborn, { opacity: 0.25, textShadow: "none", duration: 0.04 }, "+=0.09")
            .to(stubborn, { ...litName, duration: 0.07 });
        }

        // 4. The rest of the stage fades in from the dark
        tl.to(
          rest,
          { opacity: 1, y: 0, duration: 0.6, stagger: 0.12, ease: "power2.out" },
          "+=0.2"
        );

        tlRef.current = tl;

        // Relay handoff: on a first visit the cinematic overture (loader)
        // plays above us — the sign only hums on once its blade cut finishes.
        // Any later visit this session starts immediately.
        let timeoutId = 0;
        const startNow = () => {
          window.clearTimeout(timeoutId);
          tl.play();
        };
        if (sessionStorage.getItem(OVERTURE_SEEN_KEY)) {
          startNow();
        } else {
          window.addEventListener(OVERTURE_DONE_EVENT, startNow, { once: true });
          // Safety net: never leave the stage dark if the loader misfires.
          timeoutId = window.setTimeout(startNow, 12000);
        }

        return () => {
          window.clearTimeout(timeoutId);
          window.removeEventListener(OVERTURE_DONE_EVENT, startNow);
          split.revert();
        };
      });
    },
    { scope: container }
  );

  const skip = () => {
    const tl = tlRef.current;
    if (tl && tl.isActive()) tl.progress(1);
  };

  return (
    <section
      ref={container}
      className="relative flex min-h-[70dvh] flex-col items-center justify-center gap-6 px-6 py-24 text-center"
    >
      <p className="neon-welcome font-sign text-lg tracking-[0.3em] text-neon-blue md:text-2xl">
        {welcome}
      </p>
      <h1 className="neon-name font-sign text-6xl text-neon-red md:text-8xl">
        {name}
      </h1>
      <p className="neon-rest mt-2 font-deco tracking-[0.25em] text-gold/90">
        {tagline}
      </p>
      {children}
      {playing && (
        <button
          type="button"
          onClick={skip}
          className="absolute bottom-6 right-6 cursor-pointer text-xs text-muted-fg transition-colors hover:text-fg"
        >
          {skipLabel}
        </button>
      )}
    </section>
  );
}
