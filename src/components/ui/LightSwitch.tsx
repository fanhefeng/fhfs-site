"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { readTheme, toggleTheme, type Theme } from "@/lib/theme";

/* One AudioContext for every switch instance, created lazily inside the
 * first click (a user gesture, so autoplay policy is satisfied) — zero
 * assets, zero cold-start cost before that. */
let audioCtx: AudioContext | null = null;

/** Synthesized toggle "click": a 50ms square blip, pitched up for on. */
function playClick(lightsOn: boolean) {
  try {
    if (typeof AudioContext === "undefined") return;
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(lightsOn ? 2600 : 1700, t0);
    osc.frequency.exponentialRampToValueAtTime(lightsOn ? 1200 : 800, t0 + 0.03);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.1, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.06);
  } catch {
    /* Audio is a garnish — never let it break the switch. */
  }
}

/**
 * The "lights on" lever — heir to the old pull cord. A liquid-chip glass
 * capsule whose knob slides right when the gallery lights come on (light
 * theme). Toggling honours the site-wide theme contract — localStorage
 * 'fhfs-theme' + documentElement.dataset.theme + the 'fhfs:theme' event —
 * and wraps the swap in document.startViewTransition, which globals.css
 * (data-vt="theme") stretches into the 1.2s cross-fade. Click + haptic tick
 * fire on the same frame as the visual (the one sanctioned multimodal spot).
 *
 * Multiple instances stay in sync by listening to 'fhfs:theme'.
 */
export function LightSwitch({ className }: { className?: string }) {
  const t = useTranslations("common");
  /* The server cannot know the theme, so it renders the light default and
   * the initialiser must match it — reading data-theme here would be a
   * hydration mismatch. */
  const [theme, setTheme] = useState<Theme>("light");

  /* A layout effect, not a passive one: the pre-paint script in the layout
   * has already put data-theme="dark" on <html>, so correcting after paint
   * showed dark-mode readers one frame of a switch flipped fully on — knob
   * right, filament lit, aria-pressed="true". React flushes a setState from
   * here before the browser paints, so the wrong frame never lands. */
  useLayoutEffect(() => {
    setTheme(readTheme());
    const sync = () => setTheme(readTheme());
    window.addEventListener("fhfs:theme", sync);
    return () => window.removeEventListener("fhfs:theme", sync);
  }, []);

  const toggle = useCallback(() => {
    // Multimodal trio on the causal frame: sound + haptic + the cross-fade.
    // The state update rides the 'fhfs:theme' event the toggle dispatches.
    playClick(readTheme() === "dark");
    navigator.vibrate?.(10);
    toggleTheme();
  }, []);

  const on = theme === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={t("lightSwitch")}
      /* Tooltip names the *next* state, so hovering explains the action. */
      title={on ? t("lightsOff") : t("lightsOn")}
      className={`inline-flex h-11 min-w-11 cursor-pointer items-center justify-center ${className ?? ""}`}
    >
      {/* Track — glass capsule; the knob is the lamp. */}
      <span
        aria-hidden
        className="liquid-chip relative block h-6 w-11 rounded-full"
      >
        <span
          className={`absolute left-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-surface-raised shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-[translate] duration-200 ease-out ${
            on ? "translate-x-5" : "translate-x-0"
          }`}
        >
          {/* Filament dot: amber and haloed when the lights are on. */}
          <span
            className={`block size-1.5 rounded-full transition-colors duration-200 ${
              on
                ? "bg-accent shadow-[0_0_8px_2px_rgba(255,184,107,0.75)]"
                : "bg-fg-tertiary"
            }`}
          />
        </span>
      </span>
    </button>
  );
}
