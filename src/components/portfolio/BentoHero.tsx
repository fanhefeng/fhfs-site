"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { gsap, useGSAP, Flip, ExpoScaleEase } from "@/lib/gsap";
import { SpecularEdge } from "@/components/cards/WorkCard";

export type BentoItem = {
  id: string;
  /** Display name on the cover. */
  name: string;
  /** Mono kicker under the name (category or platform). */
  kicker: string;
  /** 1–2 letter monogram — the programmatic cover art. */
  monogram: string;
  /** Cover tint + specular light colour. */
  accent: string;
  /** Internal href (i18n Link). */
  href: string;
  /** Accessible label for the whole cover. */
  label: string;
};

type Props = {
  items: BentoItem[];
  /** aria-label for the collage region. */
  ariaLabel: string;
  /** "Keep scrolling, step closer" line shown under the collage. */
  hint: string;
};

/* The two grid geometries the scrub interpolates between: the collage at
 * rest, and the "standing right in front of it" close-up. Both are applied
 * as custom properties so the capture is a single style write. */
const CLOSE_COL = "52vw";
const CLOSE_ROW = "38vh";

/**
 * Bento collage hero — "step closer to the exhibit" (after the GSAP demo
 * vYMzKZx). The final, blown-up grid is captured with Flip, the DOM snaps
 * back to the collage, and the resulting Flip tween is scrubbed by a pinned
 * ScrollTrigger: scrolling walks the camera into the wall of covers.
 *
 * Discipline: `scale: true` keeps the whole thing on transforms (no layout
 * work per frame); backdrop blur is switched off for the duration; a width
 * change rebuilds the captured state, since Flip records pixels.
 *
 * Mobile and reduced motion never pin — the collage *is* the layout there.
 */
export function BentoHero({ items, ariaLabel, hint }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  // Bumped on real width changes so useGSAP re-captures the Flip state.
  const [rebuild, setRebuild] = useState(0);

  useEffect(() => {
    let width = window.innerWidth;
    let timer: number | undefined;
    const onResize = () => {
      // Mobile URL-bar height changes must not trigger a rebuild.
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setRebuild((n) => n + 1), 200);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
    };
  }, []);

  useGSAP(
    () => {
      const section = sectionRef.current;
      const stage = stageRef.current;
      const grid = gridRef.current;
      if (!section || !stage || !grid) return;
      const cells = gsap.utils.toArray<HTMLElement>(".bento-cell", grid);
      if (cells.length === 0) return;

      const mm = gsap.matchMedia();
      mm.add(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        () => {
          // Capture the close-up, then revert — Flip.to() plays the diff.
          grid.style.setProperty("--bento-col", CLOSE_COL);
          grid.style.setProperty("--bento-row", CLOSE_ROW);
          const state = Flip.getState(cells);
          grid.style.removeProperty("--bento-col");
          grid.style.removeProperty("--bento-row");

          // expoScale keeps a zoom feeling constant-speed. Build it from the
          // config factory, not the "expoScale(1,5)" string: GSAP 3.15 never
          // resolves that string even with EasePack registered — it silently
          // degrades to power1.out, which is the wrong curve, quietly.
          const scaleEase = ExpoScaleEase.config(1, 5);

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: stage,
              start: "center center",
              end: "+=100%",
              scrub: true,
              pin: section,
              anticipatePin: 1,
              // Blur is the expensive part of the covers — drop it while the
              // grid is in motion, restore it the moment the scrub ends.
              onToggle: (self) =>
                stage.classList.toggle("is-scrubbing", self.isActive),
            },
          });
          tl.add(Flip.to(state, { simple: true, scale: true, ease: scaleEase }), 0);
          if (hintRef.current) {
            tl.to(hintRef.current, { opacity: 0, ease: "none" }, 0);
          }

          return () => {
            stage.classList.remove("is-scrubbing");
            gsap.set(cells, { clearProps: "all" });
          };
        }
      );
    },
    { scope: sectionRef, dependencies: [rebuild], revertOnUpdate: true }
  );

  return (
    <section ref={sectionRef} aria-label={ariaLabel} className="bento-section">
      {/* Component-scoped sheet: React 19 hoists and de-dupes it by href.
          Grid track sizes have to be real CSS (Flip reads the layout), which
          is why they are not Tailwind utilities. */}
      <style href="bento-hero" precedence="medium">{BENTO_CSS}</style>

      <div ref={stageRef} className="bento-stage">
        <div ref={gridRef} className="bento-grid">
          {items.slice(0, 6).map((item, i) => (
            <Link
              key={item.id}
              href={item.href}
              aria-label={item.label}
              className={`bento-cell bento-cell--${i + 1}`}
              style={{ "--cell-accent": item.accent } as CSSProperties}
            >
              <span className="bento-wash" aria-hidden="true" />
              <span className="bento-monogram" aria-hidden="true">
                {item.monogram}
              </span>
              <span className="bento-meta">
                <span className="bento-name">{item.name}</span>
                <span className="bento-kicker">{item.kicker}</span>
              </span>
              <SpecularEdge color={item.accent} />
            </Link>
          ))}
        </div>
        <p ref={hintRef} className="bento-hint liquid-chip">
          {hint}
        </p>
      </div>
    </section>
  );
}

const BENTO_CSS = `
.bento-section { position: relative; }

.bento-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem 4rem;
  /* The blown-up grid must never widen the page. */
  overflow: clip;
}

.bento-grid {
  display: grid;
  gap: 0.5rem;
  width: 100%;
  max-width: 40rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: 21vh;
}
.bento-cell--1, .bento-cell--6 { grid-column: span 2; }

@media (min-width: 768px) {
  .bento-stage { min-height: 100svh; padding: 0; }
  .bento-grid {
    --bento-col: 21vw;
    --bento-row: 15.5vh;
    gap: 0.75rem;
    width: auto;
    max-width: none;
    grid-template-columns: repeat(4, var(--bento-col));
    grid-template-rows: repeat(3, var(--bento-row));
    grid-auto-rows: auto;
  }
  /* 4×3 bento: one hero plate, two wide plates, two squares, one wide. */
  .bento-cell--1 { grid-column: span 2; grid-row: span 2; }
  .bento-cell--2 { grid-column: span 2; }
  .bento-cell--5 { grid-column: span 2; }
  .bento-cell--6 { grid-column: span 2; }
}

.bento-cell {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: 44px;
  padding: 0.75rem 0.875rem;
  border-radius: var(--r-card);
  /* Solid tinted plate: brand colour belongs on opaque layers, and six
     blurred surfaces in a scrubbed grid would cost far too much. */
  background: var(--surface-raised);
  box-shadow: var(--elev-card);
  color: var(--fg);
  text-decoration: none;
}
/* Hover lift uses the standalone translate property (not transform), so it
   composes with the Flip tween instead of fighting it. */
@media (prefers-reduced-motion: no-preference) {
  .bento-cell { transition: translate 0.3s ease-out; }
  .bento-cell:hover { translate: 0 -4px; }
}

.bento-wash {
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(115% 95% at 22% 10%,
      color-mix(in srgb, var(--cell-accent) 30%, transparent), transparent 68%),
    linear-gradient(155deg,
      color-mix(in srgb, var(--cell-accent) 13%, transparent), transparent 62%);
}

.bento-monogram {
  position: absolute;
  top: 0.55rem;
  left: 0.875rem;
  font-weight: 650;
  letter-spacing: -0.04em;
  line-height: 1;
  font-size: clamp(1.6rem, 3.2vw, 2.75rem);
  color: color-mix(in srgb, var(--cell-accent) 70%, var(--fg));
  opacity: 0.9;
}

.bento-meta { display: flex; flex-direction: column; gap: 0.15rem; }
.bento-name { font-size: 0.8125rem; font-weight: 600; letter-spacing: -0.01em; }
.bento-kicker {
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fg-tertiary);
}

.bento-hint {
  position: absolute;
  bottom: 1.25rem;
  left: 50%;
  translate: -50% 0;
  margin: 0;
  padding: 0.4rem 0.85rem;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fg-tertiary);
  pointer-events: none;
}

/* Scrub in progress: no backdrop work anywhere inside the stage, and the
   plates get a compositor layer only while they are actually moving. */
.bento-stage.is-scrubbing .liquid-chip,
.bento-stage.is-scrubbing .glass-thin {
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}
.bento-stage.is-scrubbing .bento-cell { will-change: transform; }
`;
