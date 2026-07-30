"use client";

import { useRef } from "react";
import { gsap, useGSAP, ScrollTrigger, SplitText } from "@/lib/gsap";

// Referenced so bundlers keep the plugins; registration lives in @/lib/gsap.
void ScrollTrigger;
void SplitText;

export type TourStop = {
  city: string;
  latin: string;
  year: string; // may be an empty string — not every stop has a date
  note: string;
};

type Props = {
  kicker: string;
  heading: string;
  marquee: string;
  stops: TourStop[];
  /** Mono hint under the road ("← → or drag…"); omit to hide. */
  walkHint?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Track-space px the walker keeps away from either track edge. */
const WALKER_EDGE = 24;
/** Walk speed for arrow keys, px per second (track space). */
const WALK_SPEED = 460;
/** Seconds of no input before the walker strolls back to scroll position. */
const IDLE_RETURN = 2;

/**
 * "TRACK 03½ · ON TOUR" — the road here, as a GSAP-homepage-style
 * horizontal tour: the section pins for one viewport and vertical scroll
 * is mapped 1:1 onto the horizontal travel of a wide track (ease: "none",
 * function-based end, invalidateOnRefresh). One giant outlined latin city
 * name per stop, a solid Chinese name overlapping it, a gold road line
 * running through the whole track with one dot per stop — the dot nearest
 * the current progress lights up.
 *
 * Two layers of life on top of the base act:
 *
 * 1. Char tumble — every outlined latin name is SplitText-split into chars
 *    and each char gsap.from()s in from a random height/angle, scrubbed by
 *    a containerAnimation ScrollTrigger against the master horizontal
 *    tween, so letters roll into place as their panel crosses the stage.
 *
 * 2. A playable saxophonist silhouette walks the road line. By default he
 *    stands at the route position matching scroll progress; while the
 *    section is pinned, ArrowLeft/ArrowRight (or dragging him) lets him
 *    walk ahead / back — legs swing, he bobs, and when he reaches a stop
 *    dot (±2% of the track) the dot flares and he does a little hop.
 *    After 2s of no input he strolls back to the scroll position. All of
 *    his motion is transform-only writes; every layout measurement is
 *    cached on ScrollTrigger refresh, never read per frame. Key listeners
 *    are gated on the pin being active (Escape suspends them).
 *
 * Under prefers-reduced-motion the act degrades to a plain vertical list
 * (vertical road, all dots lit) via `motion-reduce:` utilities; names are
 * not split, the walker stands still at the current stop and arrow keys
 * teleport him stop-to-stop (accessibility parity, no animation).
 */
export function TourRoad({ kicker, heading, marquee, stops, walkHint }: Props) {
  const container = useRef<HTMLElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const N = stops.length;

  useGSAP(
    () => {
      const q = gsap.utils.selector(container);
      const wrapper = wrapperRef.current;
      const stage = q<HTMLDivElement>(".tour-stage")[0];
      const track = q<HTMLDivElement>(".tour-track")[0];
      const latinEls = q<HTMLSpanElement>(".tour-latin");
      const dots = q<HTMLSpanElement>(".tour-dot");
      const walker = q<HTMLDivElement>(".tour-walker")[0];
      const jumpEl = q<HTMLDivElement>(".tour-walker-jump")[0];
      const bobEl = q<HTMLDivElement>(".tour-walker-bob")[0];
      const faceEl = q<SVGSVGElement>(".tour-walker-face")[0];
      const legL = q<SVGGElement>(".tour-walker-legl")[0];
      const legR = q<SVGGElement>(".tour-walker-legr")[0];
      if (!wrapper || !stage || !track || !walker || N === 0) return;

      const mm = gsap.matchMedia();

      // Ignore key events aimed at editable elements elsewhere on the page.
      const isEditable = (t: EventTarget | null) =>
        t instanceof HTMLElement &&
        (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName));

      // ------------------------------------------------------------------
      // Reduced motion: layout is entirely handled by `motion-reduce:`
      // utilities (vertical list, vertical road, every dot lit). No char
      // splitting, no walk cycle. The walker stands beside the current
      // stop's dot and arrow keys teleport him between stops — position is
      // measured once per discrete keypress, never per frame.
      // ------------------------------------------------------------------
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set([track, ...latinEls], { clearProps: "transform" });

        let idx = 0;
        const place = () => {
          const dot = dots[idx];
          if (!dot) return;
          const dr = dot.getBoundingClientRect();
          const tr = track.getBoundingClientRect();
          gsap.set(walker, {
            x: dr.left - tr.left + dr.width / 2 + 14,
            y: dr.top - tr.top + dr.height / 2 - 20,
          });
        };
        // Place once the reduced layout has actually reflowed (the media
        // flip reverts the pin/transforms asynchronously), then re-place on
        // any track resize — discrete layout events, never per frame.
        const ro = new ResizeObserver(() => place());
        ro.observe(track);
        const settle = gsap.delayedCall(0.2, place);

        let attached = false;
        let suspended = false;
        const onKey = (e: KeyboardEvent) => {
          if (isEditable(e.target)) return;
          if (e.key === "Escape") {
            suspended = true;
            detach();
            return;
          }
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          idx = gsap.utils.clamp(0, N - 1, idx + (e.key === "ArrowRight" ? 1 : -1));
          place();
        };
        const attach = () => {
          if (attached) return;
          attached = true;
          window.addEventListener("keydown", onKey);
        };
        const detach = () => {
          if (!attached) return;
          attached = false;
          window.removeEventListener("keydown", onKey);
        };

        // IO gate: keys live only while the act fills most of the viewport.
        const io = new IntersectionObserver(
          (entries) => {
            const e = entries[entries.length - 1];
            const on =
              e.isIntersecting &&
              e.intersectionRect.height > window.innerHeight * 0.4;
            if (on && !suspended) attach();
            else {
              detach();
              if (!on) suspended = false; // re-arm after leaving
            }
          },
          { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1] }
        );
        io.observe(stage);

        return () => {
          io.disconnect();
          ro.disconnect();
          settle.kill();
          detach();
          gsap.set(walker, { clearProps: "transform" });
        };
      });

      // ------------------------------------------------------------------
      // Full motion
      // ------------------------------------------------------------------
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // The classic horizontal-scroll mapping: total horizontal overflow
        // becomes the pin distance, so scroll speed equals travel speed.
        const dist = () => track.scrollWidth - stage.clientWidth;

        const clampPos = gsap.utils.clamp(0, N - 1);
        let lastActive = 0;

        // Layout caches — refreshed only in onRefresh, never per frame.
        let stageW = 0;
        let trackW = 0;
        let travel = 0;
        let dotXs: number[] = [];
        const measure = () => {
          stageW = stage.clientWidth;
          trackW = track.scrollWidth;
          travel = trackW - stageW;
          dotXs = dots.map((dot) => {
            const panel = dot.parentElement as HTMLElement;
            return panel.offsetLeft + panel.offsetWidth / 2;
          });
        };

        // ---- walker state ------------------------------------------------
        let scrollBaseX = 0; // route position for the current scroll progress
        let offset = 0; // manual deviation (keys / drag / return tween)
        let walkerX = 0; // last applied x
        let facing = 1;
        let nearIdx = -1;
        let initialized = false;
        const xSet = gsap.quickSetter(walker, "x", "px") as (v: number) => void;

        // Walk cycle: two legs swinging in anti-phase around the hip
        // (svgOrigin) + a light bob on the body. Played while he moves,
        // eased back to standing shortly after movement stops.
        gsap.set([legL, legR], { svgOrigin: "12.5 26" });
        const legTl = gsap
          .timeline({ paused: true, repeat: -1 })
          .fromTo(
            legL,
            { rotation: 20 },
            { rotation: -20, duration: 0.22, ease: "sine.inOut", yoyo: true, repeat: 1 },
            0
          )
          .fromTo(
            legR,
            { rotation: -20 },
            { rotation: 20, duration: 0.22, ease: "sine.inOut", yoyo: true, repeat: 1 },
            0
          )
          .fromTo(
            bobEl,
            { y: 0 },
            { y: -2.5, duration: 0.11, ease: "sine.inOut", yoyo: true, repeat: 3 },
            0
          );

        const stopLegs = gsap
          .delayedCall(0.18, () => {
            legTl.pause();
            gsap.to([legL, legR], { rotation: 0, duration: 0.2, ease: "sine.out" });
            gsap.to(bobEl, { y: 0, duration: 0.2, ease: "sine.out" });
          })
          .pause();

        const noteMoving = () => {
          if (!legTl.isActive()) {
            gsap.killTweensOf([legL, legR, bobEl]);
            legTl.play();
          }
          stopLegs.restart(true);
        };

        /** Transform-only writes: position, facing, near-dot flare + hop. */
        const applyWalker = () => {
          const x = gsap.utils.clamp(
            WALKER_EDGE,
            Math.max(WALKER_EDGE, trackW - WALKER_EDGE),
            scrollBaseX + offset
          );
          const dx = x - walkerX;
          walkerX = x;
          xSet(x);

          const first = !initialized;
          initialized = true;

          if (!first && Math.abs(dx) > 0.4) {
            noteMoving();
            const dir = dx > 0 ? 1 : -1;
            if (dir !== facing) {
              facing = dir;
              gsap.set(faceEl, { scaleX: dir });
            }
          }

          // Which stop dot is he standing on? (±2% of the whole track)
          const range = trackW * 0.02;
          let idx = -1;
          for (let i = 0; i < dotXs.length; i++) {
            if (Math.abs(dotXs[i] - x) <= range) {
              idx = i;
              break;
            }
          }
          if (idx !== nearIdx) {
            if (nearIdx >= 0) dots[nearIdx].dataset.near = "false";
            nearIdx = idx;
            if (idx >= 0) {
              dots[idx].dataset.near = "true";
              if (!first) {
                // Little hop of arrival — up fast, bounce back down.
                gsap.killTweensOf(jumpEl);
                gsap.set(jumpEl, { y: 0 });
                gsap.to(jumpEl, {
                  keyframes: [
                    { y: -8, duration: 0.16, ease: "power2.out" },
                    { y: 0, duration: 0.34, ease: "bounce.out" },
                  ],
                });
              }
            }
          }
        };

        // ---- idle return -------------------------------------------------
        let returnTween: gsap.core.Tween | null = null;
        const killReturn = () => {
          if (returnTween) {
            returnTween.kill();
            returnTween = null;
          }
        };
        const idle = gsap
          .delayedCall(IDLE_RETURN, () => {
            if (Math.abs(offset) < 1) {
              offset = 0;
              return;
            }
            const state = { o: offset };
            returnTween = gsap.to(state, {
              o: 0,
              duration: gsap.utils.clamp(0.6, 2.4, Math.abs(offset) / 480),
              ease: "power1.inOut",
              onUpdate: () => {
                offset = state.o;
                applyWalker();
              },
              onComplete: () => {
                returnTween = null;
              },
            });
          })
          .pause();

        // ---- arrow keys (gated on the pin being active) --------------------
        const pressed = new Set<string>();
        const step = () => {
          const dir =
            (pressed.has("ArrowRight") ? 1 : 0) - (pressed.has("ArrowLeft") ? 1 : 0);
          if (dir !== 0) {
            // Clamp the frame delta so a stalled frame can't teleport him.
            const dt = Math.min(gsap.ticker.deltaRatio(60), 2.5);
            offset += dir * (WALK_SPEED / 60) * dt;
            applyWalker();
          }
        };

        let keysAttached = false;
        let suspended = false;
        const onKeyDown = (e: KeyboardEvent) => {
          if (isEditable(e.target)) return;
          if (e.key === "Escape") {
            suspended = true;
            detachKeys();
            return;
          }
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          if (e.repeat) return; // movement runs on the ticker, not key repeat
          killReturn();
          idle.pause();
          if (!pressed.has(e.key)) {
            pressed.add(e.key);
            if (pressed.size === 1) gsap.ticker.add(step);
          }
        };
        const onKeyUp = (e: KeyboardEvent) => {
          if (pressed.delete(e.key) && pressed.size === 0) {
            gsap.ticker.remove(step);
            idle.restart(true);
          }
        };
        const attachKeys = () => {
          if (keysAttached) return;
          keysAttached = true;
          window.addEventListener("keydown", onKeyDown);
          window.addEventListener("keyup", onKeyUp);
        };
        const detachKeys = () => {
          if (!keysAttached) return;
          keysAttached = false;
          window.removeEventListener("keydown", onKeyDown);
          window.removeEventListener("keyup", onKeyUp);
          pressed.clear();
          gsap.ticker.remove(step);
        };

        // ---- drag the walker ----------------------------------------------
        let dragId = -1;
        let dragStartX = 0;
        let dragStartOffset = 0;
        const onPointerDown = (e: PointerEvent) => {
          e.preventDefault();
          dragId = e.pointerId;
          walker.setPointerCapture(e.pointerId);
          dragStartX = e.clientX;
          dragStartOffset = offset;
          killReturn();
          idle.pause();
        };
        const onPointerMove = (e: PointerEvent) => {
          if (e.pointerId !== dragId) return;
          offset = dragStartOffset + (e.clientX - dragStartX);
          applyWalker();
        };
        const onPointerEnd = (e: PointerEvent) => {
          if (e.pointerId !== dragId) return;
          dragId = -1;
          idle.restart(true);
        };
        walker.addEventListener("pointerdown", onPointerDown);
        walker.addEventListener("pointermove", onPointerMove);
        walker.addEventListener("pointerup", onPointerEnd);
        walker.addEventListener("pointercancel", onPointerEnd);

        // ---- render (dots + walker follow), driven by the scrub ------------
        const render = (progress: number) => {
          const pos = progress * (N - 1);

          // Light up the dot nearest the current progress; touch the DOM
          // only when the active stop actually changes (CSS transitions
          // handle the glow).
          const active = Math.round(clampPos(pos));
          if (active !== lastActive) {
            lastActive = active;
            dots.forEach((dot, i) => {
              dot.dataset.active = String(i === active);
            });
          }

          // The walker's default spot: the piece of road currently at the
          // viewport's center — he strolls in place as the road slides by.
          scrollBaseX = stageW * 0.5 + progress * travel;
          applyWalker();
        };

        const scrollTween = gsap.to(track, {
          x: () => -dist(),
          ease: "none", // required — keeps scroll and travel in sync
          scrollTrigger: {
            trigger: wrapper,
            start: "top top",
            end: () => "+=" + dist(),
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onRefresh: (self) => {
              measure();
              render(self.progress);
            },
            onUpdate: (self) => render(self.progress),
            // Keyboard only while the act owns the viewport (pin active).
            onToggle: (self) => {
              if (self.isActive && !suspended) attachKeys();
              else {
                detachKeys();
                if (!self.isActive) suspended = false; // re-arm on leave
              }
            },
          },
        });

        // Char tumble: split each outlined latin name and roll every char
        // in from a random height/angle as its panel crosses the stage —
        // scrubbed against the master horizontal tween (containerAnimation).
        // Latin-only text, so splitting is line-break safe.
        const splits: SplitText[] = [];
        latinEls.forEach((el) => {
          const split = new SplitText(el, { type: "chars" });
          splits.push(split);
          const panel = el.closest<HTMLElement>(".tour-panel") ?? el;
          split.chars.forEach((char) => {
            gsap.from(char, {
              yPercent: "random(-160,160)",
              rotation: "random(-24,24)",
              opacity: 0,
              ease: "back.out(1.2)",
              scrollTrigger: {
                trigger: panel,
                containerAnimation: scrollTween,
                start: "left 95%",
                end: "left 45%",
                scrub: 1,
              },
            });
          });
        });

        return () => {
          detachKeys();
          walker.removeEventListener("pointerdown", onPointerDown);
          walker.removeEventListener("pointermove", onPointerMove);
          walker.removeEventListener("pointerup", onPointerEnd);
          walker.removeEventListener("pointercancel", onPointerEnd);
          splits.forEach((s) => s.revert());
          dots.forEach((dot) => {
            dot.dataset.near = "false";
          });
        };
      });
    },
    { scope: container }
  );

  return (
    <section ref={container} data-act="tour">
      {/* Ticker tape across the top of the act — pure CSS loop. Two equal
          copies inside a w-max flex row; -50% translate = one copy, so the
          loop is seamless. Frozen under prefers-reduced-motion. */}
      <div aria-hidden="true" className="overflow-hidden border-y border-line py-2">
        <style>{`@keyframes tour-marquee { to { transform: translateX(-50%); } }`}</style>
        <div className="flex w-max whitespace-nowrap font-mono text-[11px] tracking-[0.35em] text-gold/50 [animation:tour-marquee_60s_linear_infinite] motion-reduce:[animation:none]">
          <span className="pr-10">{marquee}</span>
          <span className="pr-10">{marquee}</span>
        </div>
      </div>

      {/* Pin wrapper — the element ScrollTrigger pins. No transform of its
          own and no transformed ancestor, so pinning stays exact. */}
      <div ref={wrapperRef}>
        <div className="tour-stage relative h-svh overflow-hidden motion-reduce:h-auto motion-reduce:overflow-visible">
          {/* The horizontal track: w-max so it is exactly as wide as its
              panels and the road line can span the full travel. */}
          {/* pr: trailing road so the last outlined name (which spills past
              its panel) fully clears the right edge at the end of travel. */}
          <div className="tour-track relative flex h-full w-max flex-nowrap items-stretch pr-[14vw] will-change-transform motion-reduce:h-auto motion-reduce:w-full motion-reduce:flex-col motion-reduce:gap-16 motion-reduce:py-20 motion-reduce:pr-0">
            {/* The road — one gold line through the entire track. Becomes a
                vertical roadside line in the reduced-motion list. */}
            <span
              aria-hidden="true"
              className="absolute left-0 right-0 top-[78%] h-0.5 -translate-y-1/2 bg-gradient-to-r from-transparent via-gold/35 to-gold/15 motion-reduce:hidden"
            />
            <span
              aria-hidden="true"
              className="absolute bottom-0 top-0 left-[28px] hidden w-0.5 bg-gradient-to-b from-transparent via-gold/35 to-transparent motion-reduce:block"
            />

            {/* Panel 0 — the act's own marquee card */}
            <div className="tour-panel relative flex h-full w-[80vw] shrink-0 flex-col justify-center px-[8vw] md:w-[60vw] md:px-[5vw] motion-reduce:h-auto motion-reduce:w-full motion-reduce:py-0 motion-reduce:pl-20 motion-reduce:pr-6">
              <span className="track-kicker">{kicker}</span>
              <h2 className="mt-5 font-deco text-[clamp(44px,7vw,96px)] leading-[1.08] text-gold [text-shadow:var(--glow-gold)]">
                {heading}
              </h2>
              <span className="mt-8 font-mono text-[11px] tracking-[0.3em] text-muted-fg">
                1990 ⟶ 2026
              </span>
            </div>

            {/* One panel per stop — deliberately uneven: odd/even panels sit
                ±6svh off the centerline, GSAP-homepage style, not a card row. */}
            {stops.map((stop, i) => (
              <div
                key={stop.latin}
                className="tour-panel relative h-full w-[85vw] shrink-0 md:w-[clamp(340px,44vw,620px)] motion-reduce:h-auto motion-reduce:w-full"
              >
                <div
                  className={`relative flex h-full flex-col justify-center px-[7vw] md:px-[2vw] ${
                    i % 2 === 0 ? "-translate-y-[6svh]" : "translate-y-[6svh]"
                  } motion-reduce:h-auto motion-reduce:translate-y-0 motion-reduce:pl-20 motion-reduce:pr-6`}
                >
                  <span className="font-mono text-xs tracking-[0.3em] text-gold/40">
                    {pad(i + 1)}
                  </span>
                  <div className="relative mt-2">
                    {/* Giant outlined latin name — stroke only, gold token,
                        allowed to spill past the panel edge. Split into
                        chars at runtime for the tumble-in. */}
                    <span
                      aria-hidden="true"
                      className="tour-latin block w-max select-none whitespace-nowrap font-deco leading-none text-transparent [-webkit-text-stroke:1.5px_var(--gold)] text-[13vw] md:text-[clamp(72px,10vw,160px)]"
                    >
                      {stop.latin}
                    </span>
                    {/* Solid Chinese name, overlapping the outline off-axis */}
                    <span className="absolute bottom-[-0.3em] left-[10%] font-deco font-bold leading-none text-fg text-[clamp(30px,3.4vw,46px)]">
                      {stop.city}
                    </span>
                  </div>
                  <div className="mt-10 md:mt-12">
                    {stop.year ? (
                      <span className="block font-mono tabular-nums leading-none text-neon-blue [text-shadow:var(--glow-blue)] text-[clamp(22px,2.4vw,34px)]">
                        {stop.year}
                      </span>
                    ) : null}
                    <p className="mt-3 max-w-[32ch] text-sm text-muted-fg">
                      {stop.note}
                    </p>
                  </div>
                </div>

                {/* Station dot on the road line. Lit = current stop; flared
                    (data-near) = the walker is standing on it; in the
                    reduced-motion list every dot is lit. */}
                <span
                  aria-hidden="true"
                  data-active={i === 0}
                  className="tour-dot absolute left-1/2 top-[78%] z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/60 bg-transparent transition-[background-color,border-color,box-shadow,scale] duration-500 data-[active=true]:border-gold data-[active=true]:bg-gold data-[active=true]:shadow-[0_0_12px_var(--gold),0_0_32px_var(--gold)] data-[near=true]:scale-150 data-[near=true]:border-gold data-[near=true]:bg-gold data-[near=true]:shadow-[0_0_16px_var(--gold),0_0_44px_var(--gold)] motion-reduce:left-[29px] motion-reduce:top-1/2 motion-reduce:border-gold motion-reduce:bg-gold motion-reduce:shadow-[0_0_10px_var(--gold)]"
                />
              </div>
            ))}

            {/* The playable saxophonist. Feet sit on the road line (normal
                mode); in the reduced-motion list he is re-anchored to the
                track origin and positioned next to the current stop's dot.
                Position changes are translate-only, written by GSAP. */}
            <div
              aria-hidden="true"
              className="tour-walker absolute left-0 top-[78%] z-20 -ml-3.5 -mt-10 h-10 w-7 cursor-grab touch-none select-none will-change-transform active:cursor-grabbing motion-reduce:left-0 motion-reduce:top-0 motion-reduce:m-0 motion-reduce:cursor-default"
            >
              <div className="tour-walker-jump h-full w-full">
                <div className="tour-walker-bob h-full w-full">
                  {/* Minimal two-color silhouette: gold player, neon-blue gig bag */}
                  <svg
                    className="tour-walker-face block h-full w-full"
                    viewBox="0 0 28 40"
                    fill="none"
                  >
                    {/* Drawn unambiguously facing RIGHT — at ~30px tall only
                        the silhouette reads, so every cue agrees: hat brim
                        and head ahead of the hips, torso a forward-leaning
                        curve, one arm swinging out front, and the gig bag
                        slung BEHIND him (a tiny blue shape reads as luggage,
                        not as a horn — so it lives on his back), its strap
                        crossing the chest. scaleX(-1) mirrors the whole
                        figure to walk left. */}
                    {/* gig bag on the back — round-ended capsule, tip peeking
                        above the shoulder; drawn first so the body overlaps it */}
                    <path d="M10.6 13.4 L7.2 23.6" stroke="var(--neon-blue)" strokeWidth="4.2" strokeLinecap="round" />
                    {/* torso — forward-leaning curve, chest proud, head leads */}
                    <path d="M16 13 C15.9 16.8 14 21.5 12.5 26" stroke="var(--gold)" strokeWidth="2.8" strokeLinecap="round" />
                    {/* solid head under a slightly tipped top hat:
                        elliptical brim + tapered crown + hairline band */}
                    <circle cx="16" cy="10.5" r="2.7" fill="var(--gold)" />
                    <g transform="rotate(5 16 10)">
                      <ellipse cx="16.6" cy="7.9" rx="4.9" ry="1" fill="var(--gold)" />
                      <path d="M14.1 7.9 L14.35 3.9 Q14.35 3.1 15.15 3.1 L18.05 3.1 Q18.85 3.1 18.85 3.9 L19.1 7.9 Z" fill="var(--gold)" />
                      <path d="M14.25 6.6 H18.95" stroke="var(--neon-blue)" strokeWidth="0.9" />
                    </g>
                    {/* strap over the chest, front shoulder down to the bag */}
                    <path d="M16.5 14.6 Q14.4 16.6 10.9 19.6" stroke="var(--neon-blue)" strokeWidth="1.5" strokeLinecap="round" />
                    {/* arms — near hand holding the strap, far arm swinging ahead */}
                    <path d="M15.8 14.3 Q15.9 15.7 14.7 16.6" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" />
                    <path d="M15.6 14.3 Q18.4 15.6 19.6 19.4" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" />
                    {/* legs mid-stride, bent at the knee, shoe dots riding
                        along — each leg is a group so its shoe swings with it
                        (rotation still pivots on the hip svgOrigin above) */}
                    <g className="tour-walker-legl">
                      <path d="M12.5 26 L10.6 31.6 L8.2 36.9" stroke="var(--gold)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="8" cy="37.2" r="1.4" fill="var(--gold)" />
                    </g>
                    <g className="tour-walker-legr">
                      <path d="M12.5 26 L15.2 31.2 L16.6 36.9" stroke="var(--gold)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="16.9" cy="37.2" r="1.4" fill="var(--gold)" />
                    </g>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Walk hint — mono whisper under the road line. Falls back into
              normal flow at the end of the reduced-motion list. */}
          {walkHint ? (
            <p className="pointer-events-none absolute inset-x-0 top-[86%] z-10 text-center font-mono text-[10px] tracking-[0.35em] text-muted-fg/80 motion-reduce:static motion-reduce:mt-4 motion-reduce:pb-8 motion-reduce:pl-20 motion-reduce:text-left">
              {walkHint}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
