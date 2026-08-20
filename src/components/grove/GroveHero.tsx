"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import { Link } from "@/i18n/navigation";
import { GroveScene } from "./GroveScene";
import { NavDock, type DockItem } from "./NavDock";
import { PortalCard, FloatingKnob } from "./PortalCard";
import { LiquidPill } from "./LiquidPill";
import { GROVE_CSS } from "./hero.css";

export type GroveCard = {
  label: string;
  title: string;
  href: string;
  src: string;
  alt: string;
  linkLabel: string;
};

type Props = {
  ghost: string;
  headline: [string, string];
  lede: string;
  cta: { label: string; href: string };
  play: { label: string; href: string };
  stats: [{ label: string; value: string }, { label: string; value: string }];
  cards: [GroveCard, GroveCard];
  scrollLabel: string;
  dock: { ariaLabel: string; markLabel: string; markHref: string; items: DockItem[] };
};

/**
 * The grove: one composition, laid out on a 1600 × 880 stage and lit by a
 * procedural moss root that is pinned to the same coordinates the copy is.
 *
 * Everything about the arrangement — where the arch crests, which card the
 * root drapes over, how far each layer rides the pointer — is measured in one
 * design unit, so the whole thing scales as a picture rather than reflowing as
 * a document. Below 900px it becomes a single column and the moss becomes a
 * band between the copy and the cards.
 */
export function GroveHero({ ghost, headline, lede, cta, play, stats, cards, scrollLabel, dock }: Props) {
  const heroRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  const onReady = useCallback(() => setReady(true), []);

  /** The dock and the two controls ask the scene for a puff of pollen. */
  const burst = useCallback((x: number, y: number) => {
    heroRef.current?.dispatchEvent(new CustomEvent("grove:burst", { detail: { x, y } }));
  }, []);

  // Never leave the page unrevealed if the scene stalls or is skipped.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 4000);
    return () => clearTimeout(t);
  }, []);

  // The wipes are done — drop the clips so nothing keeps a stacking context
  // alive. The About knob has to stay above the moss.
  useEffect(() => {
    if (!ready) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setDone(true), calm ? 0 : 2900);
    return () => clearTimeout(t);
  }, [ready]);

  /* Pointer parallax, published as two custom properties on the hero.
     Three decimals is finer than a pixel of travel, and rounding lets the
     writes stop entirely once the pointer settles — no style invalidation on
     an idle page. */
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const pointer = { x: 0, y: 0 };
    const smooth = { x: 0, y: 0 };
    let lastX: string | null = null;
    let lastY: string | null = null;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const tick = () => {
      smooth.x += (pointer.x - smooth.x) * 0.055;
      smooth.y += (pointer.y - smooth.y) * 0.055;
      const nx = (Math.round(smooth.x * 1000) / 1000).toString();
      const ny = (Math.round(smooth.y * 1000) / 1000).toString();
      if (nx === lastX && ny === lastY) return;
      lastX = nx;
      lastY = ny;
      hero.style.setProperty("--px", nx);
      hero.style.setProperty("--py", ny);
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <>
      <style href="grove-hero" precedence="medium">{GROVE_CSS}</style>
      {/* Sets the pre-intro state only when scripting is on, so a page without
          it renders finished rather than clipped away to nothing. */}
      <script dangerouslySetInnerHTML={{ __html: 'document.documentElement.dataset.groveJs=""' }} />

      <main ref={heroRef} className="gh-hero" data-ready={ready || undefined} data-done={done || undefined}>
        <GroveScene heroRef={heroRef} stageRef={stageRef} onReady={onReady} />

        <NavDock
          ariaLabel={dock.ariaLabel}
          markLabel={dock.markLabel}
          markHref={dock.markHref}
          items={dock.items}
          onBurst={burst}
          mark={
            <svg viewBox="0 0 22 24" aria-hidden="true">
              <path d="M11 1.3c-2.1 0-3.95 1.2-4.75 2.95C3.95 4.55 2.3 6.25 2.3 8.35c0 2.3 1.9 4.2 4.3 4.2h8.8c2.4 0 4.3-1.9 4.3-4.2 0-2.1-1.65-3.8-4-4.1C14.95 2.5 13.1 1.3 11 1.3Z" />
              <path d="M9.6 12.55h2.8v4.2c1.35.3 2.45 1.15 3.15 2.4-1.35.4-2.4.15-3.15-.4v4.15H9.6v-4.15c-.75.55-1.8.8-3.15.4.7-1.25 1.8-2.1 3.15-2.4v-4.2Z" />
            </svg>
          }
        />

        <div ref={stageRef} className="gh-stage">
          <div className="gh-guides fade" style={{ "--d": "900ms" } as React.CSSProperties} aria-hidden="true">
            <i style={{ left: "calc(405 * var(--gh-u))" }} />
            <i style={{ left: "calc(748 * var(--gh-u))" }} />
            <i style={{ left: "calc(1091 * var(--gh-u))" }} />
          </div>

          <div className="gh-ghost fade" style={{ "--d": "1150ms" } as React.CSSProperties} aria-hidden="true">
            {ghost}
          </div>

          {/* Card one sits BEHIND the canvas, so the moss drapes over its shoulder. */}
          <PortalCard
            className="gh-card--a"
            plateFirst
            knob
            preload
            delay={920}
            label={cards[0].label}
            title={cards[0].title}
            href={cards[0].href}
            src={cards[0].src}
            alt={cards[0].alt}
            linkLabel={cards[0].linkLabel}
            style={{ "--d": "760ms", "--pd": 10, "--pr": 2.2 } as React.CSSProperties}
          />
          <FloatingKnob
            href={cards[0].href}
            label={cards[0].linkLabel}
            style={{ "--pd": 10, "--pr": 2.2, "--d": "1100ms" } as React.CSSProperties}
          />

          <h1 className="gh-headline par" style={{ "--pd": 18, "--pr": 1.2 } as React.CSSProperties}>
            <span><i style={{ "--d": "260ms" } as React.CSSProperties}>{headline[0]}</i></span>
            <span><i style={{ "--d": "360ms" } as React.CSSProperties}>{headline[1]}</i></span>
          </h1>

          <p className="gh-lede mask par" style={{ "--d": "480ms", "--pd": 14, "--pr": 1 } as React.CSSProperties}>
            {lede}
          </p>

          <div className="gh-pill mask par" style={{ "--d": "600ms", "--pd": 15, "--pr": 1.4, "--mr": "calc(150 * var(--gh-u))" } as React.CSSProperties}>
            <LiquidPill height="calc(52 * var(--gh-u))" base={0} href={cta.href} label={cta.label} onPress={burst}>
              <svg className="gh-pill-ico" viewBox="0 0 115 115" aria-hidden="true">
                <g stroke="currentColor" strokeWidth="11" strokeLinecap="round">
                  <path d="M14 34.5 H101" />
                  <path d="M14 57.5 H101" />
                  <path d="M14 80.5 H68" />
                </g>
              </svg>
              <span className="gh-pill-lbl">{cta.label}</span>
            </LiquidPill>
          </div>

          <span className="gh-play par" style={{ "--pd": 20 } as React.CSSProperties}>
            <span className="gh-play-glass mask-circle" style={{ "--d": "900ms" } as React.CSSProperties}>
              <LiquidPill height="calc(170 * var(--gh-u))" base={0} className="gh-play-pill" href={play.href} label={play.label} onPress={burst}>
                <svg className="gh-play-ico" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 7.4 17 12l-8 4.6z" fill="currentColor" />
                </svg>
              </LiquidPill>
            </span>
            <span className="gh-play-ring mask-circle" style={{ "--d": "840ms" } as React.CSSProperties} aria-hidden="true" />
          </span>

          {stats.map((s, i) => (
            <dl
              key={s.label}
              className={`gh-stat gh-stat--${i === 0 ? "a" : "b"} mask par`}
              style={{ "--d": `${700 + i * 70}ms`, "--pd": 12 + i } as React.CSSProperties}
            >
              <span className="gh-mark" aria-hidden="true">
                {i === 0 ? (
                  <svg viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                    <circle cx="15" cy="15" r="10.5" strokeDasharray="0.6 3.6" />
                    <circle cx="15" cy="15" r="5.6" strokeDasharray="0.6 3.2" />
                    <circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                    <path d="M15 3.5v5" /><path d="M15 21.5v5" /><path d="M3.5 15h5" /><path d="M21.5 15h5" />
                    <path d="M6.9 6.9l3.5 3.5" /><path d="M19.6 19.6l3.5 3.5" />
                    <path d="M23.1 6.9l-3.5 3.5" /><path d="M10.4 19.6l-3.5 3.5" />
                    <circle cx="15" cy="15" r="3.6" />
                  </svg>
                )}
              </span>
              <div>
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            </dl>
          ))}

          <PortalCard
            className="gh-card--b par"
            delay={1080}
            label={cards[1].label}
            title={cards[1].title}
            href={cards[1].href}
            src={cards[1].src}
            alt={cards[1].alt}
            linkLabel={cards[1].linkLabel}
            style={{ "--d": "880ms", "--pd": 22, "--pr": 2.4 } as React.CSSProperties}
          />

          <Link className="gh-scroll mask par" style={{ "--d": "1040ms", "--pd": 9 } as React.CSSProperties} href="/blog">
            {scrollLabel}
            <span className="gh-track" />
          </Link>
        </div>
      </main>
    </>
  );
}
