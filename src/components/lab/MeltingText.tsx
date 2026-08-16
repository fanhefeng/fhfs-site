"use client";

import { useCallback, useId, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";
import { splitText } from "@/lib/splitText";

export type MeltingTextMode = "load" | "inView" | "scrub";

export type MeltingTextProps = {
  /** The text to melt. "\n" is a hard line break. Must be a plain string. */
  children: string;
  /** Rendered tag — kept to block-ish elements the stage can live inside. */
  as?: "span" | "p" | "h2" | "h3" | "div";
  className?: string;
  style?: CSSProperties;

  /**
   * `load`   — plays once on mount
   * `inView` — plays when it scrolls into view
   * `scrub`  — progress is bound to the scrollbar, both directions
   */
  mode?: MeltingTextMode;

  /** Per-glyph blur at the start of the melt, in px. */
  blur?: number;
  /** How far neighbouring glyphs bleed into each other. 0 drops the filter. */
  goo?: number;
  /** Alpha contrast of the goo pass — higher reads as harder, more liquid. */
  gooContrast?: number;
  /**
   * `blur`/`goo` are authored against ~96px type and rescaled to the real
   * font-size, so one set of numbers works on a headline and on body copy.
   */
  autoScale?: boolean;

  /** How far each glyph rises from. Any CSS length. */
  shift?: string;
  /** Scale each glyph grows from. */
  scale?: number;

  duration?: number;
  stagger?: number;
  staggerFrom?: gsap.StaggerVars["from"];
  ease?: string;
  /** `load` only. */
  delay?: number;

  /** ScrollTrigger start — `inView` and `scrub`. */
  start?: string;
  /** ScrollTrigger end — `scrub` only. */
  end?: string;
  /** `scrub` only: true follows instantly, a number adds smoothing seconds. */
  scrub?: boolean | number;
  /** `inView` only: replay on every re-entry instead of firing once. */
  repeat?: boolean;
};

const SPACE_RE = /^[ \t]$/;

/** The type size the `blur` / `goo` numbers are authored against. */
const REFERENCE_SIZE = 96;

/**
 * Melting type — glyphs congeal into one sticky liquid, then resolve.
 *
 * Two layers stacked: a per-glyph blur/rise/scale entrance, and an SVG gooey
 * pass over the whole stage (`feGaussianBlur` → `feColorMatrix` alpha
 * threshold) that fuses blurred neighbours into a single shape. Shrinking the
 * blur radius over time tightens the liquid back into letters.
 *
 * Three things the naive version gets wrong, all handled below: opacity must
 * resolve before the blur does, the filter has to come *off* at the end, and
 * the blur radius must track the font size.
 *
 * Accessibility: the full string sits in a visually-hidden span for screen
 * readers, and every split glyph is `aria-hidden`.
 */
export function MeltingText({
  children,
  as = "span",
  className,
  style,
  mode = "load",
  blur = 10,
  goo = 7,
  gooContrast = 16,
  autoScale = true,
  shift = "0.38em",
  scale = 0.92,
  duration = 1.1,
  stagger = 0.05,
  staggerFrom = "start",
  ease = "power3.out",
  delay = 0,
  start = "top 78%",
  end = "bottom 45%",
  scrub = true,
  repeat = false,
}: MeltingTextProps) {
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLSpanElement>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement>(null);

  // useId emits characters that are illegal inside a CSS url(#…) reference.
  const rawId = useId();
  const filterId = useMemo(
    () => `melt-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [rawId]
  );

  const { lines } = useMemo(() => splitText(children), [children]);
  const useGoo = goo > 0;

  /** Drives the shared gooey pass, and drops the filter entirely once it is
   *  done so the final text keeps its native antialiasing. */
  const applyGoo = useCallback(
    (value: number) => {
      const stage = stageRef.current;
      const node = blurRef.current;
      if (!stage || !node) return;

      if (value <= 0.06) {
        stage.style.filter = "none";
        node.setAttribute("stdDeviation", "0");
        return;
      }
      node.setAttribute("stdDeviation", value.toFixed(3));
      stage.style.filter = `url(#${filterId})`;
    },
    [filterId]
  );

  useGSAP(
    () => {
      const stage = stageRef.current;
      const root = rootRef.current;
      if (!stage || !root) return;

      const chars = gsap.utils.toArray<HTMLElement>(
        stage.querySelectorAll<HTMLElement>("[data-mt-char]:not([data-mt-space])")
      );
      if (!chars.length) return;

      const mm = gsap.matchMedia();

      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          reduced: "(prefers-reduced-motion: reduce)",
        },
        (ctx) => {
          const { reduced } = ctx.conditions as {
            motion: boolean;
            reduced: boolean;
          };

          // The pre-hydration CSS state hands over to GSAP here.
          stage.removeAttribute("data-mt-hidden");

          if (reduced) {
            gsap.set(chars, { clearProps: "all" });
            stage.style.filter = "none";
            return;
          }

          // Blur has to track the type size: the numbers that read as liquid
          // on a headline shred 15px copy into specks.
          const fontSize = parseFloat(getComputedStyle(chars[0]).fontSize) || 16;
          // Sub-linear, so small type still melts a little.
          const k = autoScale ? Math.pow(fontSize / REFERENCE_SIZE, 0.75) : 1;
          const blurPx = blur * k;

          const gooState = { value: useGoo ? goo * k : 0 };
          applyGoo(gooState.value);

          const tl = gsap.timeline({ paused: true, defaults: { ease } });
          const stagVars = { each: stagger, from: staggerFrom };

          // Opacity resolves in a third of the time the blur takes, and that
          // ordering is the whole trick: a glyph arrives as an opaque blob —
          // opaque enough to survive the alpha threshold — and only then melts
          // into a readable letter. Fading both together leaves it translucent
          // while blurred, and the threshold shatters it into specks.
          tl.fromTo(
            chars,
            { opacity: 0, y: shift, scale, filter: `blur(${blurPx}px)` },
            {
              opacity: 1,
              duration: duration * 0.34,
              ease: "power1.out",
              stagger: stagVars,
            },
            0
          ).to(
            chars,
            { y: 0, scale: 1, filter: "blur(0px)", duration, stagger: stagVars },
            0
          );

          if (useGoo) {
            tl.to(
              gooState,
              {
                value: 0,
                // Stay sticky while the glyphs are soft, then let go before
                // the end so the final text has clean edges.
                ease: "power2.in",
                duration: tl.duration() * 0.82,
                onUpdate: () => applyGoo(gooState.value),
              },
              0
            );
          }

          if (mode === "scrub") {
            ScrollTrigger.create({ trigger: root, start, end, scrub, animation: tl });
          } else if (mode === "inView") {
            ScrollTrigger.create({
              trigger: root,
              start,
              once: !repeat,
              onEnter: () => tl.play(),
              onLeaveBack: repeat ? () => tl.pause(0).progress(0) : undefined,
            });
          } else if (delay > 0) {
            // A paused timeline ignores its own `delay` once you call play(),
            // so schedule the start instead.
            gsap.delayedCall(delay, () => tl.play());
          } else {
            tl.play();
          }

          // Web fonts land after first paint and shift every glyph box.
          if (document.fonts) {
            void document.fonts.ready.then(() => ScrollTrigger.refresh());
          }

          return () => {
            tl.kill();
            stage.style.filter = "none";
          };
        }
      );

      return () => mm.revert();
    },
    {
      scope: rootRef,
      dependencies: [
        children,
        mode,
        blur,
        goo,
        gooContrast,
        autoScale,
        shift,
        scale,
        duration,
        stagger,
        ease,
        delay,
        start,
        end,
        scrub,
        repeat,
      ],
      revertOnUpdate: true,
    }
  );

  let charIndex = 0;
  const Tag = as as "span";

  return (
    <Tag
      ref={rootRef as React.Ref<HTMLSpanElement>}
      className={["mt-root", className].filter(Boolean).join(" ")}
      style={
        {
          ...style,
          "--mt-blur": `${blur}px`,
          "--mt-shift": shift,
          "--mt-scale": String(scale),
        } as CSSProperties
      }
    >
      <span className="mt-a11y">{children}</span>

      <span ref={stageRef} className="mt-stage" data-mt-hidden="true" aria-hidden="true">
        {lines.map((words, lineIdx) => (
          <span className="mt-line" key={lineIdx}>
            {words.map((word, wordIdx) => (
              <span className="mt-word" key={wordIdx}>
                {word.chars.map((c) => (
                  <span
                    className="mt-char"
                    key={charIndex++}
                    data-mt-char=""
                    data-mt-space={SPACE_RE.test(c.char) ? "" : undefined}
                  >
                    {c.char === " " ? " " : c.char}
                  </span>
                ))}
              </span>
            ))}
          </span>
        ))}
      </span>

      {useGoo ? (
        <svg className="mt-defs" aria-hidden="true" focusable="false">
          <defs>
            <filter
              id={filterId}
              x="-25%"
              y="-25%"
              width="150%"
              height="150%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur ref={blurRef} in="SourceGraphic" stdDeviation="0" result="soft" />
              {/* alpha' = k·alpha − 0.3k: anything under ~30% opacity is cut
                  away and anything above is pushed to solid, which is what
                  fuses two blurred glyphs into one liquid shape. */}
              <feColorMatrix
                in="soft"
                type="matrix"
                values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${gooContrast} ${(
                  -gooContrast * 0.3
                ).toFixed(2)}`}
              />
            </filter>
          </defs>
        </svg>
      ) : null}
    </Tag>
  );
}

/** Shared by every MeltingText on the page; injected once by the demo. */
export const MELTING_TEXT_CSS = `
.mt-root { display: block; position: relative; }
/* Block-ish so the filter region covers every line, and isolated so
   neighbouring glyphs actually melt together in one layer. */
.mt-stage { display: block; isolation: isolate; }
.mt-line { display: block; }
.mt-line:empty::before { content: "\\00a0"; }
.mt-word {
  display: inline-block;
  white-space: pre;
  /* Holds the ascender/descender box steady while glyphs are scaled. */
  vertical-align: top;
}
.mt-char {
  display: inline-block;
  white-space: pre;
  will-change: opacity, transform, filter;
  transform-origin: 50% 70%;
  backface-visibility: hidden;
}

/* Pre-hydration state: the same values GSAP tweens *from*, written in CSS so
   finished text never flashes before the animation takes over. The attribute
   is removed as soon as GSAP owns the DOM. */
.mt-stage[data-mt-hidden="true"] .mt-char {
  opacity: 0;
  filter: blur(var(--mt-blur, 12px));
  transform: translate3d(0, var(--mt-shift, 0.35em), 0) scale(var(--mt-scale, 0.94));
}

@media (prefers-reduced-motion: reduce) {
  .mt-stage[data-mt-hidden="true"] .mt-char {
    opacity: 1;
    filter: none;
    transform: none;
  }
}

.mt-defs { position: absolute; width: 0; height: 0; overflow: hidden; pointer-events: none; }

.mt-a11y {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
`;
