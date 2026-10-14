"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP, EASE } from "@/lib/client/gsap";
import { HELLO_WORDS, type HelloWord } from "@/lib/hello";
import { StudyPanel } from "./StudyPanel";
import type { StudyText } from "./LabStudy";

const THEMES = ["paper", "peach", "blue", "night"] as const;
type Theme = (typeof THEMES)[number];
const SPEEDS = [0.5, 1, 2] as const;
const WRITE_SECONDS = 4.6;

export function HelloDemo({ accent, text }: { accent: string; text: StudyText }) {
  const [word, setWord] = useState<HelloWord>("hello");
  const [theme, setTheme] = useState<Theme>("paper");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const [guide, setGuide] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const drawing = useRef<SVGGElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const inView = useRef(false);
  const wanted = useRef(true);
  const rate = useRef(1);
  const art = HELLO_WORDS[word];
  // The route resolves this study's copy on the server, like the other demos.
  const s = (key: string): string => {
    const value = text[key];
    if (value === undefined) throw new Error(`hello study is missing text.${key}`);
    return value;
  };

  useGSAP(
    () => {
      const group = drawing.current;
      if (!group) return;
      const paths = [...group.querySelectorAll<SVGPathElement>("path")];
      const lengths = paths.map((path) => path.getTotalLength());
      const total = lengths.reduce((sum, length) => sum + length, 0);
      // Each stroke is normalized to 1. Durations use its actual arc length,
      // so a short crossbar is quicker than an ascender or a long loop.
      // Animate SVG attributes rather than CSS lengths: CSSPlugin rounds
      // pixel values by default, which snaps a normalized 1 → 0 to two frames.
      gsap.set(paths, { attr: { "stroke-dasharray": 1, "stroke-dashoffset": 1 }, opacity: 0 });
      const loop = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.45 });
      loop.set(group, { opacity: 1 });
      paths.forEach((path, index) => {
        loop.set(path, { opacity: 1 });
        loop.to(path, {
          attr: { "stroke-dashoffset": 0 },
          duration: (lengths[index]! / total) * WRITE_SECONDS,
          ease: EASE.linear,
        });
        if (art.lift && index < paths.length - 1) loop.to({}, { duration: art.lift });
      });
      loop.to(group, { opacity: 0, duration: 0.7, ease: EASE.crossfade }, "+=1.8");
      loop.timeScale(rate.current);
      timeline.current = loop;
      if (wanted.current && inView.current && !document.hidden) loop.play();
      return () => {
        loop.kill();
        timeline.current = null;
      };
    },
    { scope: stage, dependencies: [word, art.lift], revertOnUpdate: true },
  );

  // Off screen and hidden tabs freeze the same timeline. Returning resumes
  // its position only if the reader has left playback enabled.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const sync = () => {
      if (wanted.current && inView.current && !document.hidden) timeline.current?.resume();
      else timeline.current?.pause();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView.current = entry?.isIntersecting ?? false;
        sync();
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const toggle = () => {
    const next = !wanted.current;
    wanted.current = next;
    setPlaying(next);
    if (next && inView.current && !document.hidden) timeline.current?.resume();
    else timeline.current?.pause();
  };
  const replay = () => {
    wanted.current = true;
    setPlaying(true);
    timeline.current?.restart();
    if (!inView.current || document.hidden) timeline.current?.pause();
  };
  const changeSpeed = (next: number) => {
    rate.current = next;
    setSpeed(next);
    timeline.current?.timeScale(next);
  };

  return (
    <StudyPanel accent={accent} label={s("label")} lede={s("lede")}>
      <style href="lab-hello" precedence="medium">
        {HELLO_CSS}
      </style>
      <div ref={stage} className="hlo-stage" data-theme-name={theme}>
        <svg
          className="hlo-art"
          viewBox={art.viewBox}
          role="img"
          aria-label={s(word)}
          lang={art.lang}
          fill="none"
          stroke="currentColor"
          strokeWidth={art.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <g className="hlo-guide" opacity={guide ? 0.18 : 0} aria-hidden="true">
            {art.strokes.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          <g ref={drawing} key={word}>
            {art.strokes.map((d) => (
              <path key={d} d={d} pathLength={1} />
            ))}
          </g>
        </svg>
      </div>
      <div className="hlo-controls">
        <div className="hlo-playback">
          <button
            type="button"
            className="spn-btn"
            aria-label={s("playbackAria")}
            aria-pressed={playing}
            onClick={toggle}
          >
            <span aria-hidden="true">{playing ? "Ⅱ" : "▷"}</span>
            {playing ? s("pause") : s("play")}
          </button>
          <button type="button" className="spn-btn" onClick={replay}>
            <span aria-hidden="true">↻</span>
            {s("replay")}
          </button>
        </div>
        <fieldset className="hlo-field">
          <legend className="spn-field-name">{s("wordLabel")}</legend>
          <div className="hlo-options">
            {(["hello", "nihao"] as const).map((value) => (
              <label key={value} className="hlo-choice">
                <input
                  type="radio"
                  name="hello-word"
                  value={value}
                  checked={word === value}
                  onChange={() => setWord(value)}
                />
                <span lang={HELLO_WORDS[value].lang}>{s(value)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="hlo-field">
          <legend className="spn-field-name">{s("speedLabel")}</legend>
          <div className="hlo-options">
            {SPEEDS.map((value) => (
              <label key={value} className="hlo-choice">
                <input
                  type="radio"
                  name="hello-speed"
                  value={value}
                  checked={speed === value}
                  onChange={() => changeSpeed(value)}
                />
                <span>{value}×</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="hlo-field">
          <legend className="spn-field-name">{s("themeLabel")}</legend>
          <div className="hlo-options">
            {THEMES.map((value) => (
              <label key={value} className="hlo-swatch" data-theme-name={value}>
                <input
                  type="radio"
                  name="hello-theme"
                  value={value}
                  checked={theme === value}
                  onChange={() => setTheme(value)}
                />
                <span className="hlo-swatch-dot" aria-hidden="true" />
                <span className="sr-only">{s(`${value}Aria`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="hlo-guide-control">
          <input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} />
          {s("guideLabel")}
        </label>
      </div>
    </StudyPanel>
  );
}

const HELLO_CSS = `
.hlo-stage, .hlo-swatch { --hlo-paper: #f4f3ef; --hlo-ink: #242323; }
.hlo-stage[data-theme-name="peach"], .hlo-swatch[data-theme-name="peach"] { --hlo-paper: #ed9c85; --hlo-ink: #fff6ed; }
.hlo-stage[data-theme-name="blue"], .hlo-swatch[data-theme-name="blue"] { --hlo-paper: #7aabc6; --hlo-ink: #f5f9fc; }
.hlo-stage[data-theme-name="night"], .hlo-swatch[data-theme-name="night"] { --hlo-paper: #242832; --hlo-ink: #f4f3ef; }
.hlo-stage {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 280px;
  height: clamp(280px, 48vw, 620px);
  overflow: hidden;
  background: var(--hlo-paper);
  color: var(--hlo-ink);
  border-radius: 4px;
  transition: background-color .5s, color .5s;
}
.hlo-art { display: block; width: min(82%, 820px); height: auto; overflow: visible; }
.hlo-guide { transition: opacity .2s; }
.hlo-controls { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 1.5rem 2rem; }
.hlo-playback { display: flex; gap: .5rem; align-self: center; }
.hlo-field { border: 0; padding: 0; margin: 0; min-width: 0; }
.hlo-field legend { padding: 0; margin-bottom: .5rem; }
.hlo-options { display: flex; gap: .25rem; }
.hlo-choice, .hlo-swatch { position: relative; display: grid; place-items: center; min-height: 44px; cursor: pointer; }
.hlo-choice input, .hlo-swatch input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.hlo-choice span { padding: .6rem .8rem; border: 1px solid transparent; border-radius: 999px; font-size: .8125rem; color: var(--fg-secondary); }
.hlo-choice input:checked + span { border-color: var(--line); color: var(--fg); }
.hlo-choice input:focus-visible + span, .hlo-swatch input:focus-visible + span { outline: 2px solid var(--spn-accent); outline-offset: 3px; }
.hlo-swatch { width: 44px; }
.hlo-swatch-dot { width: 24px; height: 24px; background: var(--hlo-paper); border: 1px solid color-mix(in srgb, var(--fg) 18%, transparent); border-radius: 50%; }
.hlo-swatch input:checked + .hlo-swatch-dot { box-shadow: 0 0 0 3px var(--bg), 0 0 0 4px var(--fg-secondary); }
.hlo-guide-control { display: flex; align-items: center; gap: .5rem; min-height: 44px; font-size: .8125rem; color: var(--fg-secondary); cursor: pointer; }
.hlo-guide-control input { width: 16px; height: 16px; accent-color: var(--spn-accent); }
@media (max-width: 600px) {
  .hlo-stage { min-height: 260px; }
  .hlo-art { width: 94%; }
  .hlo-controls { gap: 1.25rem; }
  .hlo-playback { width: 100%; }
}
`;
