"use client";

import { useRef } from "react";
import { gsap, useGSAP, isFinePointer } from "@/lib/gsap";
// Registers Draggable + Inertia for the drag and CustomWiggle for the
// `wiggle(…)` hover ease.
import { Draggable } from "@/lib/gsap-extras";
import { Sticker } from "@/components/ui/Sticker";

/**
 * One sticker, already resolved to this page's language. The wall's
 * vocabulary is stored rather than written here — most entries are proper
 * nouns that read identically in both languages, and the few that don't carry
 * their own pair, which the page unwraps before handing them over. `tone` only
 * picks a paper colour.
 */
type WallChip = {
  label: string;
  tone: "paper" | "ink" | "accent";
};

/** The little shapes that puff out of a sticker when you let go of it. */
const PUFFS = ["✳", "◆", "✶", "●", "▲", "✚", "❍", "✦"];

const TONE_CLASS: Record<"paper" | "ink" | "accent", string> = {
  paper: "bg-surface text-fg",
  ink: "bg-fg text-bg",
  accent: "bg-accent text-white",
};

type Props = {
  chips: WallChip[];
  title: string;
  hint: string;
  ariaLabel: string;
  className?: string;
};

/**
 * The sticker wall — the one place on the site where the reader gets to touch
 * something. Interests, tools and a city, die-cut as stickers (the site's
 * "content" material) and scattered across a patch of paper.
 *
 * Motion, in order of appearance:
 * 1. entrance — the stickers converge from an arc above the wall, polar
 *    coordinates + `i*0.05` stagger + `elastic.out(1, 0.5)` (gbwvbgQ);
 * 2. hover — a CustomWiggle shiver on rotation only, so it composes with the
 *    drag transform instead of fighting it; the contact shadow softens in CSS;
 * 3. drag — Draggable + Inertia with `edgeResistance` for a rubberband edge
 *    and `minimumMovement: 10` so a stray click never counts as a throw;
 * 4. release — one or two mini stickers puff off the top and fade.
 *
 * Drag is limited to fine pointers — on touch, hijacking a swipe over a wall
 * this wide would cost more (a page that won't scroll) than the play is
 * worth; there the wall is a plain, complete, perfectly readable row of
 * stickers.
 */
export function StickerWall({ chips, title, hint, ariaLabel, className }: Props) {
  const wallRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const wall = wallRef.current;
      if (!wall) return;
      const items = gsap.utils.toArray<HTMLElement>("[data-sticker]", wall);
      const puffs = gsap.utils.toArray<HTMLElement>("[data-puff]", wall);
      if (items.length === 0) return;

      const finePointer = isFinePointer();
      const draggables: Draggable[] = [];
      const teardown: Array<() => void> = [];

      /* --- release puff -------------------------------------------------
       * A pool of 8 reused nodes (WbbEGmp, scaled down): pop in elastic,
       * drift up, fade. Nothing is created or destroyed per gesture. */
      const nextPuff = gsap.utils.wrap(0, puffs.length);
      let puffCursor = 0;

      const puff = (from: HTMLElement) => {
        if (puffs.length === 0) return;
        const base = wall.getBoundingClientRect();
        const rect = from.getBoundingClientRect();
        const count = 1 + Math.round(Math.random());
        for (let k = 0; k < count; k += 1) {
          const el = puffs[nextPuff(puffCursor)];
          puffCursor += 1;
          gsap.killTweensOf(el);
          gsap.set(el, {
            xPercent: -50,
            yPercent: -50,
            x: rect.left - base.left + rect.width / 2 + gsap.utils.random(-16, 16),
            y: rect.top - base.top + rect.height / 2,
            rotation: gsap.utils.random(-25, 25),
            scale: 0,
            autoAlpha: 1,
          });
          gsap
            .timeline()
            .to(el, { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.5)" })
            .to(
              el,
              {
                y: `-=${gsap.utils.random(70, 120)}`,
                rotation: gsap.utils.random(-45, 45),
                autoAlpha: 0,
                duration: 0.9,
                ease: "power2.out",
              },
              0.06
            );
        }
      };

      /* --- drag ---------------------------------------------------------
       * Created only once the entrance has landed, so the from-tween's
       * clearProps can never wipe a sticker the reader is already holding. */
      const enableDrag = () => {
        if (!finePointer) return;
        for (const el of items) {
          const [instance] = Draggable.create(el, {
            type: "x,y",
            bounds: wall,
            // Progressive resistance past the edge instead of a hard stop.
            edgeResistance: 0.78,
            inertia: true,
            minimumMovement: 10,
            dragClickables: true,
            cursor: "grab",
            activeCursor: "grabbing",
            onPress() {
              // A held sticker must not keep shivering under the finger.
              gsap.killTweensOf(el, "rotation");
            },
            onDragStart() {
              gsap.to(el, { scale: 1.08, duration: 0.2, overwrite: "auto" });
            },
            onDragEnd() {
              gsap.to(el, {
                scale: 1,
                duration: 0.45,
                ease: "back.out(1.2)",
                overwrite: "auto",
              });
              puff(el);
            },
          });
          if (instance) draggables.push(instance);
        }
      };

      /* --- entrance ------------------------------------------------------
       * Polar layout: every sticker starts somewhere along a shallow arc
       * over the wall and springs down into its natural slot. */
      const startAngle = Math.PI * 0.92;
      const endAngle = Math.PI * 0.08;
      const radius = 170;
      const tl = gsap.timeline({
        scrollTrigger: { trigger: wall, start: "top 80%", once: true },
        onComplete: enableDrag,
      });
      items.forEach((el, i) => {
        const t = items.length === 1 ? 0.5 : i / (items.length - 1);
        const angle = startAngle + (endAngle - startAngle) * t;
        tl.from(
          el,
          {
            x: Math.cos(angle) * radius,
            y: -Math.sin(angle) * radius * 0.5,
            scale: 0.55,
            autoAlpha: 0,
            duration: 0.9,
            ease: "elastic.out(1, 0.5)",
            clearProps: "transform,opacity,visibility",
          },
          i * 0.05
        );
      });

      /* --- the shiver ------------------------------------------------------
       * Rotation only: Draggable owns x/y, and `overwrite: 'auto'` kills
       * just the conflicting rotation tween, never the throw. Hover on a
       * mouse; a tap on touch, where the sticker also puffs — the wall
       * still answers back on a phone even though it can't be dragged. */
      const shiver = (el: HTMLElement) => {
        gsap.to(el, {
          rotation: 7,
          duration: 0.7,
          ease: "wiggle({ wiggles: 7, type: easeOut })",
          overwrite: "auto",
        });
      };

      for (const el of items) {
        const event = finePointer ? "pointerenter" : "click";
        const onPoke = () => {
          shiver(el);
          if (!finePointer) puff(el);
        };
        el.addEventListener(event, onPoke);
        teardown.push(() => el.removeEventListener(event, onPoke));
      }

      return () => {
        for (const d of draggables) d.kill();
        for (const off of teardown) off();
      };
    },
    { scope: wallRef }
  );

  return (
    <section className={className} aria-labelledby="sticker-wall-title">
      <header className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2
          id="sticker-wall-title"
          className="font-mono text-meta uppercase tracking-meta text-fg-tertiary"
        >
          {title}
        </h2>
        <p className="text-caption text-fg-tertiary">{hint}</p>
      </header>

      <div
        ref={wallRef}
        role="group"
        aria-label={ariaLabel}
        className="relative -mx-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-4 px-2 py-8"
      >
        {chips.map((chip, i) => {
          const label = chip.label;
          return (
            <span
              // The label alone would collide when two chips share a word.
              key={`${label}-${i}`}
              data-sticker
              className="relative inline-block select-none"
            >
              {/* Shadow lives on this wrapper so the die-cut silhouette (not a
                  rectangle) casts it, and hover can soften it in pure CSS —
                  no box-shadow tween anywhere. */}
              <span className="inline-block drop-shadow-[0_1px_2px_var(--sticker-shadow-color)] transition-[filter] duration-300 ease-out hover:drop-shadow-[0_10px_16px_var(--sticker-shadow-color)]">
                <Sticker seed={i} border={3}>
                  <span
                    className={`flex min-h-11 items-center rounded-full px-4 text-[0.9375rem] font-medium ${
                      TONE_CLASS[chip.tone]
                    }`}
                  >
                    {label}
                  </span>
                </Sticker>
              </span>
            </span>
          );
        })}

        {/* Puff pool — inert until a sticker is thrown. */}
        {PUFFS.map((glyph, i) => (
          <span
            key={glyph}
            data-puff
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 opacity-0"
          >
            <Sticker seed={i + 41} border={2}>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] leading-none text-white">
                {glyph}
              </span>
            </Sticker>
          </span>
        ))}
      </div>
    </section>
  );
}
