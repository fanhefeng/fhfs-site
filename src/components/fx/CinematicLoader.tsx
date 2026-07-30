"use client";

import { useRef, useState } from "react";
import { gsap, useGSAP, CustomEase, ScrollTrigger } from "@/lib/gsap";

const SEEN_KEY = "fhfs-overture-seen";
const DONE_EVENT = "fhfs:overture-done";

/** Progress ring geometry: radius + circumference for stroke-dashoffset. */
const R = 54;
const CIRC = 2 * Math.PI * R;
/** Diagonal offset between the cut's left and right edges, in %. */
const SKEW = 16;
/** Timeline position where the blade cut begins — clicks seek here to skip. */
const CUT_AT = 2.15;

export type CinematicLoaderProps = {
  /** Wordmark revealed letter by letter (font-sign — latin chars only). */
  word: string;
  /** "Click anywhere to enter" hint line. */
  hint: string;
};

type Phase = "pending" | "playing" | "done";

/**
 * Cinematic opening curtain for the home page: a gold progress ring fills
 * while the neon wordmark rises letter by letter, then a glowing blade
 * sweeps a diagonal clip-path cut and the whole overlay is "sliced away".
 *
 * The cut is not an inset() — a real blade lands at an angle. Every frame
 * we build a four-point polygon whose left/right edges are offset by 16%,
 * and a glowing line rides the midpoint of the cut.
 *
 * Plays once per session; repeat visits and reduced-motion users go
 * straight to the final state. Either way a "fhfs:overture-done" event is
 * dispatched so the hero underneath knows when to start its own entrance.
 */
export function CinematicLoader({ word, hint }: CinematicLoaderProps) {
  const container = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const bladeRef = useRef<HTMLDivElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);
  const numRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  // Overlay starts transparent and inert so returning visitors never see
  // a flash of the curtain before the effect decides to skip it.
  const [phase, setPhase] = useState<Phase>("pending");

  useGSAP(
    () => {
      const overlay = overlayRef.current;
      const blade = bladeRef.current;
      const arc = arcRef.current;
      const num = numRef.current;
      if (!overlay || !blade || !arc || !num) return;

      const q = gsap.utils.selector(container);

      const finishInstant = () => {
        setPhase("done");
        window.dispatchEvent(new Event(DONE_EVENT));
      };

      const mm = gsap.matchMedia();

      // Reduced motion: never play — hand over the stage immediately.
      mm.add("(prefers-reduced-motion: reduce)", finishInstant);

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (sessionStorage.getItem(SEEN_KEY)) {
          finishInstant();
          return;
        }

        setPhase("playing");
        // Easter egg — a self-mockery from the site owner's old me.md.
        console.log(
          "%c一个废物。",
          "color:#e8b44f;font-size:14px;font-family:serif;"
        );

        // Lock scrolling while the curtain is up.
        window.__lenis?.stop();
        document.documentElement.style.overflow = "hidden";
        let locked = true;
        const unlock = () => {
          if (!locked) return;
          locked = false;
          document.documentElement.style.overflow = "";
          // Re-sync before resuming: anything the user spun during the
          // curtain must not teleport the page once it lifts.
          window.__lenis?.scrollTo(window.scrollY, {
            immediate: true,
            force: true,
          });
          window.__lenis?.start();
          // Pinned sections were measured while the page was locked and had
          // no scrollbar; re-measure now that the real layout is back.
          ScrollTrigger.refresh();
        };

        // The curtain is opaque, so anything focusable behind it would take
        // an invisible focus ring — and Enter would activate an unseen link.
        const onFocusIn = (e: FocusEvent) => {
          const target = e.target as HTMLElement | null;
          if (locked && target && target !== document.body) target.blur();
        };
        // Mouse users click to skip; give the keyboard the same way out.
        const onKeyDown = (e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
            e.preventDefault();
            skip();
          }
        };

        // Custom ease: slow wind-up, violent mid-swing, soft landing —
        // the entire "blade" feel lives in this curve.
        CustomEase.create(
          "blade",
          "M0,0 C0.16,0 0.2,0.06 0.34,0.36 0.5,0.72 0.62,1 1,1"
        );

        // Per-frame diagonal cut: t=0 covers the screen, t=1.18 fully gone.
        // The blade rides the midpoint of the cut (y in vh — transform only,
        // no layout writes per frame).
        const setBladeY = gsap.quickSetter(blade, "y", "vh");
        const cut = (t: number) => {
          const a = t * (100 + SKEW); // left edge
          const b = a - SKEW; // right edge leaves earlier → diagonal mouth
          overlay.style.clipPath = `polygon(0% ${a}%, 100% ${b}%, 100% 100%, 0% 100%)`;
          setBladeY((a + b) / 2);
        };

        // Initial states — set in JS so SSR markup stays untouched.
        gsap.set(overlay, { autoAlpha: 1 });
        gsap.set(q(".loader-ch"), { yPercent: 115 });
        gsap.set(q(".loader-hint"), { opacity: 0 });
        gsap.set(q(".loader-breath"), { scale: 0.86, opacity: 0.5 });
        gsap.set(blade, { opacity: 0, rotate: -3.6 });
        cut(0);

        // Breathing halo around the ring so the wait never feels frozen.
        // Killed with the curtain — the component stays mounted after the
        // overlay stops rendering, so useGSAP's cleanup never runs here.
        const breath = gsap.to(q(".loader-breath"), {
          scale: 1.08,
          opacity: 1,
          duration: 1.7,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });

        const counter = { v: 0 };
        const cutter = { t: 0 };

        const tl = gsap.timeline();
        tl
          // 1. Ring fill + number driven by one tween — readings never fight.
          .to(
            counter,
            {
              v: 100,
              duration: 1.9,
              ease: "power1.inOut",
              onUpdate: () => {
                num.textContent = String(Math.round(counter.v));
                arc.style.strokeDashoffset = String(
                  CIRC * (1 - counter.v / 100)
                );
              },
            },
            0
          )
          // 2. Letters rise alongside the ring, not after it.
          .to(
            q(".loader-ch"),
            {
              yPercent: 0,
              duration: 1.1,
              ease: "expo.out",
              stagger: { each: 0.045, from: "start" },
            },
            0.25
          )
          .to(q(".loader-hint"), { opacity: 1, duration: 0.5 }, 1.5)
          // 3. Blade cut: loader content retreats, blade lights up, cut runs.
          .to(
            q(".loader-in"),
            { opacity: 0, scale: 0.96, duration: 0.45, ease: "power2.in" },
            CUT_AT
          )
          .to(blade, { opacity: 1, duration: 0.18 }, 2.3)
          .to(
            cutter,
            {
              t: 1.18,
              duration: 1.15,
              ease: "blade",
              onUpdate: () => cut(cutter.t),
            },
            2.35
          )
          .to(blade, { opacity: 0, duration: 0.3 }, 3.2)
          // 4. Relay: hand over 0.25s before the cut lands so the page
          //    underneath starts rising while the curtain is still leaving.
          .add(() => {
            window.dispatchEvent(new Event(DONE_EVENT));
          }, 3.25)
          .set(overlay, { display: "none" })
          .add(() => {
            unlock();
            breath.kill();
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("focusin", onFocusIn);
            sessionStorage.setItem(SEEN_KEY, "1");
            setPhase("done");
          });

        tlRef.current = tl;

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("focusin", onFocusIn);

        // Restore scroll even if we unmount mid-play (route change).
        return () => {
          unlock();
          breath.kill();
          window.removeEventListener("keydown", onKeyDown);
          window.removeEventListener("focusin", onFocusIn);
        };
      });
    },
    { scope: container }
  );

  // Click anywhere to skip the wait and jump straight to the cut.
  const skip = () => {
    const tl = tlRef.current;
    if (tl && tl.time() < CUT_AT) tl.seek(CUT_AT);
  };

  if (phase === "done") return null;

  return (
    <div ref={container} className="contents">
      {/* Curtain palette: midnight stage at night, warm paper after hours.
          Component-private tokens — do not move these into globals.css. */}
      <style>{`
        :root {
          --curtain-bg: #0a0a18;
          --curtain-blade-core: #fff;
          --curtain-ink: var(--fg);
          --curtain-track: var(--surface-raised);
          --curtain-glow-rgb: 232, 180, 79;
        }
        :root[data-theme="light"] {
          --curtain-bg: #f0ead9;
          --curtain-blade-core: #fff;
          --curtain-track: #ddd3bc;
          --curtain-glow-rgb: 168, 116, 31;
        }
      `}</style>
      <div
        ref={overlayRef}
        onClick={skip}
        aria-hidden="true"
        className={`fixed inset-0 z-[90] grid place-items-center ${
          phase === "pending" ? "pointer-events-none opacity-0" : ""
        }`}
        // Initial polygon must match cut(0) or the first frame flashes.
        style={{
          background: "var(--curtain-bg)",
          clipPath: "polygon(0% 0%, 100% -16%, 100% 100%, 0% 100%)",
        }}
      >
        <div className="loader-in flex flex-col items-center gap-8">
          <div className="relative h-[132px] w-[132px]">
            <div
              className="loader-breath absolute -inset-[18%] rounded-full will-change-transform"
              style={{
                background:
                  "radial-gradient(closest-side, rgba(var(--curtain-glow-rgb), 0.16), transparent 72%)",
              }}
            />
            <svg
              viewBox="0 0 120 120"
              className="block h-full w-full -rotate-90"
            >
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                strokeWidth="2"
                style={{ stroke: "var(--curtain-track)" }}
              />
              <circle
                ref={arcRef}
                cx="60"
                cy="60"
                r={R}
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                style={{
                  stroke: "var(--gold)",
                  strokeDasharray: CIRC,
                  strokeDashoffset: CIRC,
                  filter:
                    "drop-shadow(0 0 6px rgba(var(--curtain-glow-rgb), 0.55))",
                }}
              />
            </svg>
            <div
              ref={numRef}
              className="absolute inset-0 grid place-items-center font-mono text-[22px] tabular-nums"
              style={{ color: "var(--curtain-ink)" }}
            >
              0
            </div>
          </div>
          <div className="flex leading-none font-sign text-[clamp(3rem,9vw,6rem)] text-neon-red [text-shadow:var(--glow-red)]">
            {Array.from(word).map((c, i) => (
              <span key={i} className="inline-block overflow-hidden">
                <span className="loader-ch inline-block will-change-transform">
                  {c === " " ? "\u00A0" : c}
                </span>
              </span>
            ))}
          </div>
          <p className="loader-hint font-mono text-[11px] tracking-[0.14em] text-muted-fg">
            {hint}
          </p>
        </div>
      </div>
      {/* The blade: a glowing diagonal line riding the mouth of the cut. */}
      <div
        ref={bladeRef}
        className="pointer-events-none fixed top-0 left-[-10%] z-[91] h-[2px] w-[120%] opacity-0"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--gold) 18%, var(--curtain-blade-core) 50%, var(--gold) 82%, transparent)",
          boxShadow: "0 0 24px 4px rgba(var(--curtain-glow-rgb), 0.5)",
        }}
      />
    </div>
  );
}
