"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { gsap, useGSAP, EASE } from "@/lib/client/gsap";
import { Vinyl } from "./Vinyl";
import { catalogueNumber, type SoftwareApp } from "./appMeta";

/* The deck is drawn in one 500 × 400 box: the platter's centre at (190, 200),
 * the record 320 across, the tonearm pivoting at (440, 60) with its needle
 * 254 below. Straight down the needle is parked off the record, clear of the
 * start/stop button in the corner under it; turned 30° it sits in the outer
 * grooves, 147 from the centre. The HTML parts below are the same numbers as
 * percentages of the box. */
const PIVOT = "440 60";
const ARM_PARKED = 0;
const ARM_PLAYING = 30;
/** One turn at 33⅓ rpm. */
const TURN = 1.8;

type Rect = { left: number; top: number; width: number; height: number };

/** The move that puts `rect`'s record where `at`'s is, centre on centre. */
const offset = (rect: Rect, at: Rect) => ({
  x: rect.left + rect.width / 2 - (at.left + at.width / 2),
  y: rect.top + rect.height / 2 - (at.top + at.height / 2),
  scale: rect.width / at.width,
});

/** Where a record rests inside its sleeve — or null when the sleeve is filtered away. */
function sleeveRecord(id: string): Rect | null {
  const slot = document.querySelector(`[data-sleeve-slot="${CSS.escape(id)}"]`);
  const box = slot?.getBoundingClientRect();
  if (!box || box.width === 0) return null;
  const inset = box.width * 0.03;
  return {
    left: box.left + inset,
    top: box.top + inset,
    width: box.width - 2 * inset,
    height: box.height - 2 * inset,
  };
}

const moveArm = (arm: SVGGElement, rotation: number, duration: number) =>
  gsap.to(arm, { rotation, svgOrigin: PIVOT, duration, ease: EASE.travel, overwrite: "auto" });

/** Start a label turning, from a standstill up to speed. */
function spinUp(label: HTMLElement): gsap.core.Tween {
  const spin = gsap.to(label, { rotation: "+=360", duration: TURN, ease: EASE.linear, repeat: -1 });
  spin.timeScale(0);
  gsap.to(spin, { timeScale: 1, duration: 1, ease: EASE.soft });
  return spin;
}

/** Let a turning label run down to a stop rather than freeze. */
const spinDown = (spin: gsap.core.Tween, duration: number) =>
  gsap.to(spin, { timeScale: 0, duration, ease: EASE.soft, onComplete: () => void spin.pause() });

type Props = {
  apps: SoftwareApp[];
  /** The app whose record is on the platter. */
  current: string;
  /**
   * Where the record about to land was when it was picked, put here by the
   * shelf just before `current` changes and used once. Empty when the change
   * came from the address bar — the record is then simply there.
   */
  arrival: RefObject<Rect | null>;
  /** The turntable itself, for the shelf to bring into view on a phone. */
  deckRef: RefObject<HTMLDivElement | null>;
};

/**
 * The top of /software: a turntable and the liner notes of what is on it.
 *
 * Every record is on the platter from the start, stacked, and all but one
 * hidden — a change of record is then only motion: the one playing flies back
 * to its sleeve, the one picked flies up out of its own (from where the
 * sleeve showed it, half drawn out), and the arm lifts and drops round them.
 * React draws the records' visibility once (`first`) and never again; after
 * that GSAP owns it, so a re-render cannot snap a record mid-flight.
 *
 * The turning is an endless loop, so it has a stop button — the deck's own
 * start/stop, which also parks the arm — rather than a branch on reduced
 * motion (DESIGN.md §1.5 keeps that list shut). It waits for the deck to come
 * into view before it starts, and pauses whenever the deck leaves it.
 */
export function RecordDeck({ apps, current, arrival, deckRef }: Props) {
  const t = useTranslations("software");
  const rootRef = useRef<HTMLDivElement>(null);
  const armRef = useRef<SVGGElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const records = useRef(new Map<string, HTMLSpanElement>());
  const labels = useRef(new Map<string, HTMLSpanElement>());
  const spin = useRef<gsap.core.Tween | null>(null);
  const swap = useRef<gsap.core.Timeline | null>(null);
  /** The record on the platter now — `current` before GSAP has caught up. */
  const shown = useRef(current);
  const [first] = useState(current);
  const [playing, setPlaying] = useState(true);
  const playingRef = useRef(true);
  /** Whether the deck has been seen yet: the first drop of the arm waits for it. */
  const started = useRef(false);
  /** Whether it is on screen now. */
  const inView = useRef(false);

  const app = apps.find((a) => a.id === current) ?? apps[0]!;
  const position = apps.indexOf(app);

  /** Set a label turning — held still if the deck is off screen by then (a
   *  record can land after the reader has scrolled away); coming back into
   *  view resumes it. */
  const turn = (label: HTMLElement) => {
    const tween = spinUp(label);
    if (!inView.current) tween.pause();
    return tween;
  };

  /** Bring a change still in the air to where it was going, without running
   *  what it would have done on landing — whoever interrupted decides that. */
  const land = () => {
    swap.current?.progress(1, true).kill();
    swap.current = null;
  };

  // Start when the deck is first seen; pause the platter whenever it is not.
  useEffect(() => {
    const deck = deckRef.current;
    const arm = armRef.current;
    if (!deck || !arm) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView.current = entry?.isIntersecting ?? false;
        if (!inView.current) {
          spin.current?.pause();
          return;
        }
        if (!started.current) {
          started.current = true;
          if (!playingRef.current) return;
          const label = labels.current.get(shown.current);
          if (label) spin.current = spinUp(label);
          moveArm(arm, ARM_PLAYING, 0.9).delay(0.25);
          return;
        }
        if (playingRef.current) spin.current?.resume();
      },
      { threshold: 0.35 },
    );
    observer.observe(deck);
    return () => {
      observer.disconnect();
      spin.current?.kill();
      swap.current?.kill();
    };
  }, [deckRef]);

  const toggle = () => {
    const arm = armRef.current;
    if (!arm) return;
    const next = !playingRef.current;
    playingRef.current = next;
    setPlaying(next);
    land();
    if (next) {
      const label = labels.current.get(shown.current);
      spin.current?.kill();
      if (label) spin.current = turn(label);
      moveArm(arm, ARM_PLAYING, 0.8).delay(0.2);
    } else {
      moveArm(arm, ARM_PARKED, 0.6);
      if (spin.current) spinDown(spin.current, 1.4);
    }
  };

  // A new record: the swap, and the notes coming up with it.
  useGSAP(
    () => {
      const before = shown.current;
      if (before === current) return;
      // Whatever the last change still had in the air lands first.
      land();
      shown.current = current;
      const from = arrival.current;
      arrival.current = null;
      const leaving = records.current.get(before);
      const coming = records.current.get(current);
      const label = labels.current.get(current);
      const arm = armRef.current;
      if (!leaving || !coming || !label || !arm) return;

      gsap.fromTo(
        notesRef.current,
        { autoAlpha: 0, y: 12 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          ease: EASE.soft,
          delay: from ? 0.35 : 0,
          clearProps: "transform,opacity,visibility",
        },
      );

      const running = playingRef.current && started.current;
      if (!from) {
        gsap.set(leaving, { autoAlpha: 0 });
        gsap.set(coming, { autoAlpha: 1, x: 0, y: 0, scale: 1 });
        spin.current?.kill();
        spin.current = running ? turn(label) : null;
        return;
      }

      const tl = gsap.timeline();
      swap.current = tl;
      // The arm comes up and the platter runs down…
      tl.add(moveArm(arm, ARM_PARKED, 0.35), 0);
      if (spin.current) tl.add(spinDown(spin.current, 0.35), 0);
      // …the record goes home while the new one comes up from its sleeve…
      const home = sleeveRecord(before);
      const platter = coming.getBoundingClientRect();
      tl.set([leaving, coming], { zIndex: 20 }, 0.2);
      if (home) {
        tl.to(
          leaving,
          { ...offset(home, leaving.getBoundingClientRect()), duration: 0.6, ease: EASE.travel },
          0.2,
        ).to(leaving, { autoAlpha: 0, duration: 0.15, ease: EASE.fadeOut }, 0.65);
      } else {
        tl.to(leaving, { autoAlpha: 0, duration: 0.3, ease: EASE.fadeOut }, 0.2);
      }
      tl.fromTo(
        coming,
        { ...offset(from, platter), autoAlpha: 1 },
        { x: 0, y: 0, scale: 1, duration: 0.75, ease: EASE.travel },
        0.2,
      );
      tl.set(leaving, { x: 0, y: 0, scale: 1, zIndex: "auto" });
      tl.set(coming, { zIndex: "auto" });
      // …and it turns, and the needle goes down.
      if (running) {
        tl.add(() => {
          spin.current?.kill();
          spin.current = turn(label);
        });
        tl.add(moveArm(arm, ARM_PLAYING, 0.7), "+=0.1");
      } else {
        tl.add(() => {
          spin.current?.kill();
          spin.current = null;
        });
      }
    },
    { dependencies: [current], scope: rootRef },
  );

  return (
    <div
      ref={rootRef}
      className="grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12"
    >
      <div ref={deckRef} className="relative mx-auto aspect-[5/4] w-full max-w-[30rem]">
        {/* The plinth. Its decoration is clipped, the records are not: one
            flies in from the shelf below. */}
        <div
          aria-hidden
          className="absolute inset-0 overflow-hidden rounded-[1.4rem] bg-[#1c1b1f] shadow-lift ring-1 ring-white/10"
        >
          <span className="absolute inset-0 bg-[radial-gradient(120%_90%_at_15%_0%,rgba(255,255,255,0.09),transparent_60%)]" />
          {/* Platter: a turned-metal rim just wider than the record. */}
          <span
            className="absolute left-[4.4%] top-[8%] aspect-square w-[67.2%] rounded-full shadow-[0_6px_18px_rgba(0,0,0,0.5)]"
            style={{
              background:
                "conic-gradient(from 30deg, #8d8b86, #d8d5ce, #7c7a75, #c9c6bf, #8d8b86, #e2dfd8, #8d8b86)",
            }}
          />
        </div>

        {apps.map((a) => (
          <span
            key={a.id}
            ref={(el) => {
              if (el) records.current.set(a.id, el);
              else records.current.delete(a.id);
            }}
            className="absolute left-[6%] top-[10%] w-[64%]"
            style={a.id === first ? undefined : { visibility: "hidden", opacity: 0 }}
          >
            <Vinyl
              app={a}
              spinRef={(el) => {
                if (el) labels.current.set(a.id, el);
                else labels.current.delete(a.id);
              }}
            />
          </span>
        ))}

        {/* The tonearm, over the records. */}
        <svg
          aria-hidden
          viewBox="0 0 500 400"
          className="pointer-events-none absolute inset-0 z-30 h-full w-full overflow-visible"
        >
          <defs>
            <radialGradient id="deck-metal" cx="35%" cy="30%" r="75%">
              <stop offset="0" stopColor="#f1eee7" />
              <stop offset="1" stopColor="#7f7c76" />
            </radialGradient>
          </defs>
          <circle cx="440" cy="60" r="30" fill="#141316" stroke="rgba(255,255,255,0.12)" />
          <rect x="456" y="232" width="22" height="10" rx="3" fill="#2a292e" />
          <g ref={armRef}>
            <rect x="428" y="8" width="24" height="30" rx="5" fill="url(#deck-metal)" />
            {/* A solid stroke: a gradient sized to its object has nothing to
                size against on a line with no width, and paints nothing. */}
            <path
              d="M440 60 L440 266"
              stroke="#c9c6bf"
              strokeWidth="7"
              strokeLinecap="round"
              fill="none"
            />
            <rect x="429" y="262" width="22" height="42" rx="4" fill="#2b2a2f" stroke="#c9c6bf" />
            <rect x="437" y="302" width="6" height="10" rx="1.5" fill="#c9c6bf" />
          </g>
          <circle cx="440" cy="60" r="13" fill="url(#deck-metal)" />
        </svg>

        {/* Start / stop, in the one corner the platter leaves free. */}
        <button
          type="button"
          aria-pressed={playing}
          aria-label={t("spinAria")}
          onClick={toggle}
          className="absolute bottom-[5%] right-[4.5%] z-30 flex min-h-11 items-center gap-2 rounded-full bg-white/[0.06] px-3 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-white/65 ring-1 ring-white/10 transition-colors duration-200 hover:bg-white/10 hover:text-white/85"
        >
          <span
            aria-hidden
            className={`size-1.5 rounded-full transition-[background-color,box-shadow] duration-300 ${
              playing ? "" : "bg-white/20"
            }`}
            style={
              playing
                ? {
                    background: `oklch(0.78 0.15 ${app.hue})`,
                    boxShadow: `0 0 8px oklch(0.78 0.15 ${app.hue})`,
                  }
                : undefined
            }
          />
          <span aria-hidden>{t("startStop")}</span>
        </button>
      </div>

      <div ref={notesRef} className="flex min-w-0 flex-col gap-4">
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {t("side", {
            index: catalogueNumber(position),
            count: catalogueNumber(apps.length - 1),
          })}
        </p>
        <div>
          <h2 lang="en" className="text-title text-fg">
            {app.name}
          </h2>
          <p className="mt-2 font-accent text-heading font-normal text-fg-secondary">
            {app.tagline}
          </p>
        </div>
        <p className="text-[0.975rem] leading-relaxed text-fg-secondary">{app.description}</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
          <a
            href={app.website}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${t(app.cta)} — ${app.name}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-fg px-5 text-caption font-medium text-bg transition-opacity duration-200 hover:opacity-85"
          >
            {t(app.cta)}
            <span aria-hidden>↗</span>
          </a>
          {app.version || app.platforms.length > 0 ? (
            <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
              {/* The repo's latest GitHub release — it keeps itself current. */}
              {app.version ? <span className="normal-case text-accent">{app.version}</span> : null}
              {app.version && app.platforms.length > 0 ? " · " : null}
              {app.platforms.join(" · ")}
            </p>
          ) : null}
        </div>
        {/* What a screen reader hears when the record changes. */}
        <p className="sr-only" aria-live="polite">
          {t("deckAria", { name: app.name })}
        </p>
      </div>
    </div>
  );
}
