"use client";

import { useRef } from "react";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";

/* Atmosphere — a fixed, full-viewport light layer that sits between the
 * body background (which propagates to the canvas) and all page content.
 * Three radial "light pools" are positioned/colored/dimmed entirely via
 * CSS variables on the host element; each act of the show re-grades the
 * pools so the whole page reads as one continuous night:
 * street (cold starlight) → door (lights down) → setlist (warm club) →
 * poem (single cold spot) → bar (low warm pools) → encore (almost out).
 * Only transform/opacity/CSS variables are animated. */

type SceneVars = Record<string, string | number>;

/* Every scene sets all 12 variables so tweens never leave stale values. */
const SCENES: Record<string, SceneVars> = {
  // Out on the street: cold blue above, one thin line of gold at the curb.
  street: {
    "--atm1-x": "50vw", "--atm1-y": "0vh", "--atm1-o": 0.07, "--atm1-c": "#4cc9f0",
    "--atm2-x": "80vw", "--atm2-y": "72vh", "--atm2-o": 0, "--atm2-c": "#ff4d6d",
    "--atm3-x": "50vw", "--atm3-y": "102vh", "--atm3-o": 0.04, "--atm3-c": "#e8b44f",
  },
  // Pushing through the window: house lights down, the scene glows itself.
  door: {
    "--atm1-x": "50vw", "--atm1-y": "16vh", "--atm1-o": 0.02, "--atm1-c": "#4cc9f0",
    "--atm2-x": "72vw", "--atm2-y": "62vh", "--atm2-o": 0.02, "--atm2-c": "#ff4d6d",
    "--atm3-x": "42vw", "--atm3-y": "90vh", "--atm3-o": 0.02, "--atm3-c": "#e8b44f",
  },
  // Inside the club: warm gold upper-left, a dim red wash lower-right.
  setlist: {
    "--atm1-x": "50vw", "--atm1-y": "8vh", "--atm1-o": 0, "--atm1-c": "#4cc9f0",
    "--atm2-x": "86vw", "--atm2-y": "86vh", "--atm2-o": 0.05, "--atm2-c": "#ff4d6d",
    "--atm3-x": "14vw", "--atm3-y": "14vh", "--atm3-o": 0.09, "--atm3-c": "#e8b44f",
  },
  // The poem: everything out but one cold blue-violet spot, upper middle.
  poem: {
    "--atm1-x": "50vw", "--atm1-y": "22vh", "--atm1-o": 0.07, "--atm1-c": "#6a75f0",
    "--atm2-x": "80vw", "--atm2-y": "80vh", "--atm2-o": 0, "--atm2-c": "#ff4d6d",
    "--atm3-x": "20vw", "--atm3-y": "30vh", "--atm3-o": 0, "--atm3-c": "#e8b44f",
  },
  // At the bar: two low warm pools, gold left and red right.
  bar: {
    "--atm1-x": "50vw", "--atm1-y": "10vh", "--atm1-o": 0, "--atm1-c": "#4cc9f0",
    "--atm2-x": "82vw", "--atm2-y": "86vh", "--atm2-o": 0.07, "--atm2-c": "#ff4d6d",
    "--atm3-x": "18vw", "--atm3-y": "82vh", "--atm3-o": 0.08, "--atm3-c": "#e8b44f",
  },
  // Encore under the night sky: almost everything out, a breath of blue up top.
  encore: {
    "--atm1-x": "50vw", "--atm1-y": "4vh", "--atm1-o": 0.02, "--atm1-c": "#4cc9f0",
    "--atm2-x": "80vw", "--atm2-y": "88vh", "--atm2-o": 0, "--atm2-c": "#ff4d6d",
    "--atm3-x": "20vw", "--atm3-y": "88vh", "--atm3-o": 0, "--atm3-c": "#e8b44f",
  },
};

/* Pool geometry: index → diameter. Centers land on (--atmN-x, --atmN-y). */
const POOLS = [
  { n: 1, size: "90vmax", drift: false },
  { n: 2, size: "70vmax", drift: true, dur: 30 },
  { n: 3, size: "80vmax", drift: true, dur: 24 },
] as const;

export function Atmosphere() {
  const hostRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const host = hostRef.current;
      if (!host) return;

      const mm = gsap.matchMedia();

      // Reduced motion: no scroll grading, no drift — one static neutral
      // grade (the club interior) so the page still has depth.
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(host, SCENES.setlist);
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const applyScene = (act: string) => {
          const scene = SCENES[act];
          if (!scene) return;
          gsap.to(host, {
            duration: 0.9,
            ease: "sine.inOut",
            overwrite: "auto",
            ...scene,
          });
        };

        /* NOTE: pass real nodes, not selector text — inside a scoped
         * useGSAP context selector strings resolve against the host div,
         * which contains none of the act sections. */
        const sections = Array.from(
          document.querySelectorAll<HTMLElement>("[data-act]"),
        );
        sections.forEach((section) => {
          const act = section.dataset.act;
          if (!act || !SCENES[act]) return;
          ScrollTrigger.create({
            trigger: section,
            start: "top 55%",
            end: "bottom 55%",
            /* Atmosphere mounts before every act section, so its triggers
             * are created first. Refresh them last (negative priority) so
             * the pinned acts (door/setlist) register their pin distances
             * first — otherwise these start/end values are computed in
             * pre-pin-spacer coordinates and land wildly off. */
            refreshPriority: -10,
            onEnter: () => applyScene(act),
            onEnterBack: () => applyScene(act),
          });
        });

        // Glacial drift on two pools so the light never feels frozen.
        host.querySelectorAll<HTMLElement>("[data-atm-drift]").forEach((el) => {
          const dur = Number(el.dataset.atmDrift) || 28;
          gsap.fromTo(
            el,
            { xPercent: -2.5, yPercent: 1.5 },
            {
              xPercent: 2.5,
              yPercent: -1.5,
              duration: dur,
              ease: "sine.inOut",
              yoyo: true,
              repeat: -1,
            },
          );
        });
      });
    },
    { scope: hostRef },
  );

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="atm-layer pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ ...SCENES.street } as React.CSSProperties}
    >
      {/* Light theme (handled by another layer) dims every pool by half. */}
      <style>{`:root[data-theme="light"] .atm-layer { --atm-dim: 0.5; }`}</style>
      {POOLS.map((pool) => (
        <div
          key={pool.n}
          className="absolute"
          style={{
            width: pool.size,
            height: pool.size,
            left: `calc(${pool.size} / -2)`,
            top: `calc(${pool.size} / -2)`,
            opacity: `calc(var(--atm${pool.n}-o) * var(--atm-dim, 1))`,
            transform: `translate3d(var(--atm${pool.n}-x), var(--atm${pool.n}-y), 0)`,
          }}
        >
          <div
            data-atm-drift={pool.drift ? pool.dur : undefined}
            className="absolute inset-0"
            style={{
              background: `radial-gradient(closest-side, var(--atm${pool.n}-c), transparent 70%)`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
