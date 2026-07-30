"use client";

import { useMemo, useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

type Props = { lines: string[] };

/** Latin/digit/punct pool used for the scramble-through intermediate frames. */
const FLIP_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·:";
const FLIP_SET = new Set(FLIP_CHARSET.split(""));
/** Resting glyph the board shows before its first reveal. */
const IDLE_CHAR = "·";
/** CJK & fullwidth ranges get wider cells and flip in one move (no scramble). */
const WIDE_RE = /[⺀-鿿豈-﫿＀-｠　-〿]/;

const FLIP_IN = 0.09;
const FLIP_OUT = 0.09;
const REVEAL_STAGGER = 0.04;
const IDLE_INTERVAL = 18;

type Cell = {
  el: HTMLElement;
  topStatic: HTMLElement;
  bottomStatic: HTMLElement;
  topFlap: HTMLElement;
  bottomFlap: HTMLElement;
  target: string;
  col: number;
  row: number;
};

/** Chars to flip through on the way to `target` (scramble only for Latin). */
function buildSequence(target: string, scramble: boolean): string[] {
  if (!scramble || !FLIP_SET.has(target)) return [target];
  const steps = 2 + Math.floor(Math.random() * 2); // 2–3 intermediates
  const seq: string[] = [];
  for (let i = 0; i < steps; i++) {
    seq.push(FLIP_CHARSET[Math.floor(Math.random() * FLIP_CHARSET.length)]);
  }
  seq.push(target);
  return seq;
}

const FACE_BASE =
  "absolute inset-0 flex items-center justify-center rounded-[2px] " +
  "bg-surface-raised text-fg transition-[filter] duration-200 " +
  "group-hover:[filter:brightness(1.12)] " +
  "[backface-visibility:hidden] [-webkit-backface-visibility:hidden]";
/* Subtle vertical shading sells the fold: top halves lit, bottom in shadow. */
const TOP_SHADE =
  "[background-image:linear-gradient(to_bottom,rgba(255,255,255,0.07),rgba(255,255,255,0))]";
const BOTTOM_SHADE =
  "[background-image:linear-gradient(to_bottom,rgba(0,0,0,0.14),rgba(0,0,0,0.03))]";
const TOP_CLIP = "[clip-path:inset(0_0_50%_0)]";
const BOTTOM_CLIP = "[clip-path:inset(50%_0_0_0)]";

/**
 * Airport/station split-flap departure board — the club's "tonight" sign.
 * Each cell is a classic four-face flap: two static halves behind two
 * rotating halves. A flip is a two-beat relay: the old top folds down to
 * -90°, then the new bottom falls from -90° into place.
 */
export function SplitFlap({ lines }: Props) {
  const container = useRef<HTMLDivElement>(null);

  // Uppercase, pad every row to the widest one so the board is rectangular.
  const rows = useMemo(() => {
    const upper = lines.map((l) => l.toUpperCase());
    const width = Math.max(...upper.map((l) => [...l].length), 1);
    return upper.map((l) => {
      const chars = [...l];
      // Center-pad short lines so blank cells split evenly on both sides.
      const pad = width - chars.length;
      const left = Math.floor(pad / 2);
      return [
        ...Array<string>(left).fill(" "),
        ...chars,
        ...Array<string>(pad - left).fill(" "),
      ];
    });
  }, [lines]);

  useGSAP(
    (_, contextSafe) => {
      const root = container.current;
      if (!root || !contextSafe) return;

      const cells: Cell[] = Array.from(
        root.querySelectorAll<HTMLElement>("[data-flap-cell]")
      ).map((el) => ({
        el,
        topStatic: el.querySelector<HTMLElement>(".ff-ts")!,
        bottomStatic: el.querySelector<HTMLElement>(".ff-bs")!,
        topFlap: el.querySelector<HTMLElement>(".ff-tf")!,
        bottomFlap: el.querySelector<HTMLElement>(".ff-bf")!,
        target: el.dataset.flapCell ?? " ",
        col: Number(el.dataset.col),
        row: Number(el.dataset.row),
      }));

      const mm = gsap.matchMedia();

      // Reduced motion: SSR markup already shows the full text — leave it.
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Blank the board pre-paint; flaps float 0.4px forward so the
        // preserve-3d stack never z-fights the static faces beneath.
        for (const c of cells) {
          c.topStatic.textContent = IDLE_CHAR;
          c.bottomStatic.textContent = IDLE_CHAR;
          c.topFlap.textContent = IDLE_CHAR;
          c.bottomFlap.textContent = IDLE_CHAR;
          gsap.set([c.topFlap, c.bottomFlap], { z: 0.4, rotateX: 0 });
        }

        // One transient timeline per cell per burst — killed on complete,
        // never resident. Concurrency stays ≤ one wave across the board.
        const active = new Set<gsap.core.Timeline>();

        const flipCell = (cell: Cell, seq: string[], delay: number) => {
          const tl = gsap.timeline({
            delay,
            onComplete: () => {
              active.delete(tl);
              tl.kill();
            },
          });
          for (const ch of seq) {
            tl.call(() => {
              // New char waits behind the top flap and above the fold.
              cell.topStatic.textContent = ch;
              cell.bottomFlap.textContent = ch;
              gsap.set(cell.bottomFlap, { rotateX: -90 });
            });
            tl.to(cell.topFlap, {
              rotateX: -90,
              duration: FLIP_IN,
              ease: "power1.in",
            });
            tl.call(() => {
              cell.topFlap.textContent = ch;
              gsap.set(cell.topFlap, { rotateX: 0 });
            });
            tl.to(cell.bottomFlap, {
              rotateX: 0,
              duration: FLIP_OUT,
              ease: "power1.out",
            });
            tl.call(() => {
              cell.bottomStatic.textContent = ch;
            });
          }
          // 0.5px settle bounce as the last flap lands.
          tl.to(cell.el, {
            y: 0.5,
            duration: 0.05,
            yoyo: true,
            repeat: 1,
            ease: "power1.out",
          });
          active.add(tl);
        };

        let revealed = false;
        let inView = false;

        const reveal = contextSafe(() => {
          for (const c of cells) {
            flipCell(c, buildSequence(c.target, true), c.col * REVEAL_STAGGER);
          }
        });

        // Idle life: every 18s one random row re-flips (only while in view).
        const scheduleIdle = contextSafe(function tick() {
          gsap.delayedCall(IDLE_INTERVAL, () => {
            if (revealed && inView && document.visibilityState === "visible") {
              const row = Math.floor(Math.random() * rows.length);
              for (const c of cells) {
                if (c.row !== row || c.target === " ") continue;
                flipCell(
                  c,
                  buildSequence(c.target, true),
                  c.col * REVEAL_STAGGER
                );
              }
            }
            tick();
          });
        });

        const io = new IntersectionObserver(
          (entries) => {
            inView = entries[0].isIntersecting;
            if (inView && !revealed) {
              revealed = true;
              reveal();
              scheduleIdle();
            }
          },
          { threshold: 0.25 }
        );
        io.observe(root);

        return () => {
          io.disconnect();
          for (const tl of active) tl.kill();
          active.clear();
        };
      });
    },
    { scope: container }
  );

  return (
    <div className="glass mx-auto mb-12 w-fit max-w-full rounded-xl p-2.5 sm:p-3">
      {/* Each glyph lives in four faces — hide the board from readers
          and speak the plain lines instead. */}
      <p className="sr-only">{lines.join(" — ")}</p>
      {/* Dark inner slot; its background bleeds through the 1px cell gaps. */}
      <div
        ref={container}
        aria-hidden="true"
        className="flex flex-col gap-1 overflow-x-auto rounded-lg bg-bg px-3 py-2.5 font-mono text-[13px] sm:text-sm md:text-base"
      >
        {rows.map((chars, row) => (
          <div
            key={row}
            className="flex justify-center gap-px [perspective:1400px]"
          >
            {chars.map((ch, col) => {
              const wide = WIDE_RE.test(ch);
              return (
                <div
                  key={col}
                  data-flap-cell={ch}
                  data-row={row}
                  data-col={col}
                  className="group relative rounded-[2px] [transform-style:preserve-3d]
                    after:pointer-events-none after:absolute after:left-0 after:right-0
                    after:top-1/2 after:z-20 after:h-px after:-translate-y-1/2
                    after:bg-bg after:opacity-70 after:content-['']"
                  style={{ width: wide ? "1.5em" : "1em", height: "1.55em" }}
                >
                  {/* SSR shows the target text — no-JS and reduced-motion safe. */}
                  <div className={`ff-ts ${FACE_BASE} ${TOP_SHADE} ${TOP_CLIP}`}>
                    {ch}
                  </div>
                  <div
                    className={`ff-bs ${FACE_BASE} ${BOTTOM_SHADE} ${BOTTOM_CLIP}`}
                  >
                    {ch}
                  </div>
                  <div
                    className={`ff-tf ${FACE_BASE} ${TOP_SHADE} ${TOP_CLIP} z-10`}
                  >
                    {ch}
                  </div>
                  <div
                    className={`ff-bf ${FACE_BASE} ${BOTTOM_SHADE} ${BOTTOM_CLIP} z-10`}
                  >
                    {ch}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
