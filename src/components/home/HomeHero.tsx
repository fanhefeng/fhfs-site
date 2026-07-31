"use client";

import { useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { site } from "@/config/site";
import { gsap, useGSAP, ScrollTrigger, SplitText } from "@/lib/gsap";
import { Magnetic } from "@/components/fx/Magnetic";

// Referenced so bundlers keep the plugins; registration lives in @/lib/gsap.
void ScrollTrigger;

/** Overture handshake — the site-wide loader contract (see OvertureLight). */
const OVERTURE_SEEN_KEY = "fhfs-overture-seen";
const OVERTURE_DONE_EVENT = "fhfs:overture-done";
/** Safety net: never leave the cover blank if the overture misfires. */
const RELAY_TIMEOUT = 8000;

/** Wire geometry, in px (the SVG has no viewBox — user units are px). */
const WIRE_H = 14;
const CORD_MID = WIRE_H / 2;
/** How far the cord trails off to the left, fading out as it goes. */
const CORD_TAIL = 900;

type WordParts = { before: string; match: string; after: string };

/** Locates the kinetic keyword inside a line, case-insensitively. */
function splitOnWord(text: string, word: string): WordParts | null {
  if (!word) return null;
  const i = text.toLowerCase().indexOf(word.toLowerCase());
  if (i < 0) return null;
  return {
    before: text.slice(0, i),
    match: text.slice(i, i + word.length),
    after: text.slice(i + word.length),
  };
}

/**
 * A line of the manifesto. When it carries the kinetic keyword, that word is
 * set in Instrument Serif italic and marked `.hero-kinetic` — it is both the
 * editorial serif accent and the socket the cord plugs into.
 */
function Line({ text, word }: { text: string; word: string | null }) {
  const parts = word ? splitOnWord(text, word) : null;
  if (!parts) return <>{text}</>;
  return (
    <>
      {parts.before}
      <em
        className="hero-kinetic font-serif text-[1.06em] italic"
        data-lit="false"
      >
        {parts.match}
      </em>
      {parts.after}
    </>
  );
}

/**
 * The cover of the issue.
 *
 * Editorial single column (920px, the one place the 680px measure is broken):
 * quiet wordmark, an oversized two-line manifesto revealed line by line
 * behind SplitText masks, and a glass colophon card holding the lamp and the
 * one CTA.
 *
 * The kinetic mechanism (after jh3y's "messin' with text", r08 A6): a cord
 * slides in from off-screen, its plug clicks into the serif keyword, and at
 * that instant the lamp warms up and a specular highlight (r08 A1:
 * feSpecularLighting + fePointLight) sweeps along the colophon card's edge —
 * the lights-on narrative closing on itself. The cord lives outside the text
 * flow: it is measured against the keyword's own box, so it never fights the
 * SplitText line masks and re-places itself on resize.
 *
 * Timing follows the site handshake: on a first visit the entrance waits for
 * the overture's 'fhfs:overture-done'; any later visit this session starts
 * immediately. Under prefers-reduced-motion nothing moves — the cover is
 * simply there, already plugged in and lit.
 */
export function HomeHero() {
  const t = useTranslations("home");
  const locale = useLocale();

  const container = useRef<HTMLElement>(null);
  const markOuterRef = useRef<HTMLSpanElement>(null);
  const markInnerRef = useRef<HTMLSpanElement>(null);
  const wireRef = useRef<SVGSVGElement>(null);
  const slideRef = useRef<SVGGElement>(null);
  const placeRef = useRef<SVGGElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const lightRef = useRef<SVGFEPointLightElement>(null);
  const lampRef = useRef<HTMLSpanElement>(null);

  const line1 = t("heroLine1");
  const line2 = t("heroLine2");
  const sub = t("heroSub");
  const keyword = t("heroKineticWord");
  // The mechanism follows the keyword: on `en` it sits in the headline, on
  // `zh` the headline is Chinese and it lands on the English subtitle.
  const host = [line1, line2, sub].find((s) => splitOnWord(s, keyword)) ?? null;

  useGSAP(
    () => {
      const root = container.current;
      const wire = wireRef.current;
      const slide = slideRef.current;
      const place = placeRef.current;
      const card = cardRef.current;
      const ring = ringRef.current;
      const lamp = lampRef.current;
      const light = lightRef.current;
      const markInner = markInnerRef.current;
      const markOuter = markOuterRef.current;
      if (!root || !wire || !slide || !place || !card || !markInner) return;

      const q = gsap.utils.selector(container);
      const headline = q<HTMLElement>(".hero-headline")[0];
      const subline = q<HTMLElement>(".hero-sub")[0];
      const lines = q<HTMLElement>(".hero-line");
      const cue = q<HTMLElement>(".hero-cue");
      if (!headline || !subline || lines.length === 0) return;

      /** Timelines built after the effect body ran — killed by hand. */
      const spawned: gsap.core.Timeline[] = [];

      /**
       * Park the cord so its plug meets the left edge of the keyword, riding
       * just under the baseline. Returns the travel width, or null while the
       * keyword cannot be measured. Layout is read on discrete events only
       * (entrance end, resize) — never per frame. Visibility is the caller's
       * business: the cord must be positioned *and* offset before it shows.
       */
      const placeWire = (): number | null => {
        const word = root.querySelector<HTMLElement>(".hero-kinetic");
        if (!word) return null;
        const wordRect = word.getClientRects()[0];
        if (!wordRect) return null;
        const rootRect = root.getBoundingClientRect();
        const w = Math.round(wordRect.left - rootRect.left);
        const y = Math.round(wordRect.bottom - rootRect.top);
        wire.style.top = `${y - CORD_MID}px`;
        wire.setAttribute("width", String(Math.max(w, 1)));
        place.setAttribute("transform", `translate(${w} 0)`);
        return w;
      };

      /** Contact: the keyword, the cord and the colophon card light up. */
      const ignite = (animate: boolean) => {
        const word = root.querySelector<HTMLElement>(".hero-kinetic");
        if (word) word.dataset.lit = "true";
        wire.dataset.lit = "true";
        if (!animate) {
          if (lamp) gsap.set(lamp, { autoAlpha: 1 });
          if (ring) gsap.set(ring, { autoAlpha: 0.4 });
          return;
        }
        const tl = gsap.timeline();
        if (lamp) tl.to(lamp, { autoAlpha: 1, duration: 0.4 }, 0);
        if (ring && light) {
          // The point light sweeps the card's edge once, then settles — the
          // glass reads as lit from the plug side, not as a glowing border.
          tl.fromTo(ring, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0)
            .fromTo(
              light,
              { attr: { x: 0 } },
              {
                attr: { x: card.offsetWidth },
                duration: 1.2,
                ease: "power2.inOut",
              },
              0
            )
            .to(ring, { autoAlpha: 0.4, duration: 0.5 }, 0.7);
        }
        spawned.push(tl);
      };

      const mm = gsap.matchMedia();

      // ------------------------------------------------------------------
      // Reduced motion: the cover is already open, the lamp already on.
      // Only the (discrete) measurement of the cord still runs.
      // ------------------------------------------------------------------
      mm.add("(prefers-reduced-motion: reduce)", () => {
        const settle = gsap.delayedCall(0.05, () => {
          if (placeWire() == null) return;
          gsap.set(wire, { autoAlpha: 1 });
          ignite(false);
        });
        const ro = new ResizeObserver(() => placeWire());
        ro.observe(root);
        return () => {
          settle.kill();
          ro.disconnect();
        };
      });

      // ------------------------------------------------------------------
      // Full motion
      // ------------------------------------------------------------------
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Initial states in JS so the SSR markup stays readable without JS.
        gsap.set([headline, subline], { autoAlpha: 0 });
        gsap.set([markInner, card, ...cue], { autoAlpha: 0, y: 14 });

        let split: SplitText | null = null;
        let ro: ResizeObserver | null = null;

        const plugIn = () => {
          const w = placeWire();
          if (w == null) return;
          // Offset first, then reveal — otherwise the plug flashes for one
          // frame already seated in the word.
          gsap.set(slide, { x: -(w + 320) });
          gsap.set(wire, { autoAlpha: 1 });
          const tl = gsap.timeline();
          tl.to(slide, { x: 0, duration: 0.85, ease: "power3.out" })
            // The click: a short recoil as the plug seats itself.
            .to(slide, { x: -3, duration: 0.07, ease: "power2.out" })
            .to(slide, { x: 0, duration: 0.32, ease: "back.out(3)" })
            .add(() => ignite(true), "-=0.26");
          spawned.push(tl);
          // From here on the cord only re-places itself; it never replays.
          ro = new ResizeObserver(() => placeWire());
          ro.observe(root);
        };

        const play = () => {
          gsap.set([headline, subline], { autoAlpha: 1 });
          // Split for the reveal, then revert once landed: the masks exist
          // only for the 1.2s they are needed, so the resting DOM is plain
          // text again (clean reflow, clean measurement for the cord).
          split = SplitText.create([...lines, subline], {
            type: "lines",
            mask: "lines",
          });
          const tl = gsap.timeline();
          tl.from(
            split.lines,
            { yPercent: 110, duration: 0.9, stagger: 0.08, ease: "power3.out" },
            0
          )
            .to(markInner, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.05)
            .to(card, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.55)
            .to(cue, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06 }, 0.75)
            .add(() => {
              split?.revert();
              split = null;
              plugIn();
            });
          spawned.push(tl);
        };

        let timeoutId = 0;
        let started = false;
        const startNow = () => {
          // The relay can arrive twice (safety timeout fires, then the
          // overture finishes late) — the cover only ever opens once.
          if (started) return;
          started = true;
          window.clearTimeout(timeoutId);
          play();
        };
        if (sessionStorage.getItem(OVERTURE_SEEN_KEY)) {
          startNow();
        } else {
          window.addEventListener(OVERTURE_DONE_EVENT, startNow, { once: true });
          timeoutId = window.setTimeout(startNow, RELAY_TIMEOUT);
        }

        return () => {
          window.clearTimeout(timeoutId);
          window.removeEventListener(OVERTURE_DONE_EVENT, startNow);
          ro?.disconnect();
          split?.revert();
        };
      });

      // The wordmark hands over to the dynamic island: as the cover scrolls
      // away the big name shrinks toward its top-left corner and dissolves,
      // right where the island badge already sits. A scrubbed approximation
      // of the Flip morph — no cross-component state, nothing to desync.
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (!markOuter) return;
        const tween = gsap.to(markOuter, {
          scale: 0.42,
          autoAlpha: 0,
          transformOrigin: "left top",
          ease: "none",
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: "+=260",
            scrub: true,
          },
        });
        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
        };
      });

      return () => {
        spawned.forEach((tl) => tl.kill());
      };
    },
    { scope: container }
  );

  return (
    <section
      ref={container}
      data-act="cover"
      className="relative mx-auto w-full max-w-[920px] px-6 pt-[calc(env(safe-area-inset-top)+7rem)] pb-16 md:pt-[calc(env(safe-area-inset-top)+9rem)] md:pb-24"
    >
      {/* Component-private states: the keyword and the cord warm to amber the
          moment the plug seats. Amber alone is too dark after hours, so the
          lit state mixes in the warm glow token (same trick as prose links). */}
      <style>{`
        .hero-kinetic { transition: color .6s ease, text-shadow .6s ease; }
        .hero-kinetic[data-lit="true"] {
          color: var(--accent);
          text-shadow: 0 0 28px color-mix(in srgb, var(--accent) 35%, transparent);
        }
        .hero-wire { color: var(--fg-tertiary); transition: color .6s ease; }
        .hero-wire[data-lit="true"] { color: var(--accent); }
        :root[data-theme="dark"] .hero-kinetic[data-lit="true"],
        :root[data-theme="dark"] .hero-wire[data-lit="true"] {
          color: color-mix(in srgb, var(--accent) 45%, var(--glow-warm) 55%);
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-kinetic, .hero-wire { transition: none; }
        }
      `}</style>

      {/* Masthead — the name, set quietly, on its way to the island badge. */}
      <span
        ref={markOuterRef}
        className="inline-block will-change-transform"
      >
        <span
          ref={markInnerRef}
          className="block font-mono text-[clamp(2rem,5vw,3rem)] font-semibold lowercase tracking-[-0.02em] text-fg"
        >
          {site.signName}
        </span>
      </span>

      <h1 className="hero-headline mt-9 text-display leading-[1.14] md:mt-12">
        {/* leading is a hair looser than the display token: the reveal masks
            clip at the line box, and 1.05 would shave descenders off. */}
        <span className="hero-line block">
          <Line text={line1} word={host === line1 ? keyword : null} />
        </span>
        <span className="hero-line block">
          <Line text={line2} word={host === line2 ? keyword : null} />
        </span>
      </h1>

      {/* The subtitle is always the other language — tag it so the CJK
          tracking guard in globals.css picks the right rule. */}
      <p
        className="hero-sub mt-6 max-w-[46ch] text-body text-fg-secondary"
        lang={locale === "zh" ? "en" : "zh-CN"}
      >
        <Line text={sub} word={host === sub ? keyword : null} />
      </p>

      {/* The cord. Absolutely placed against the keyword's own box (so the
          line masks never clip it), overflow visible so the tail can trail
          off past the viewport edge, decorative for assistive tech. */}
      <svg
        ref={wireRef}
        className="hero-wire pointer-events-none absolute left-0"
        data-lit="false"
        aria-hidden="true"
        role="presentation"
        width={1}
        height={WIRE_H}
        style={{ overflow: "visible", opacity: 0, top: 0 }}
      >
        <defs>
          <linearGradient
            id="hero-cord-fade"
            gradientUnits="userSpaceOnUse"
            x1={-CORD_TAIL}
            x2={-CORD_TAIL / 3}
          >
            <stop offset="0" stopColor="currentColor" stopOpacity="0" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0.75" />
          </linearGradient>
        </defs>
        <g ref={slideRef} className="will-change-transform">
          <g ref={placeRef}>
            <path
              d={`M ${-CORD_TAIL} ${CORD_MID} H -14`}
              stroke="url(#hero-cord-fade)"
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
            />
            {/* plug body + two prongs entering the keyword */}
            <rect
              x={-16}
              y={CORD_MID - 5}
              width={12}
              height={10}
              rx={3}
              fill="currentColor"
            />
            <rect
              x={-5}
              y={CORD_MID - 3.4}
              width={6}
              height={2}
              rx={1}
              fill="currentColor"
            />
            <rect
              x={-5}
              y={CORD_MID + 1.4}
              width={6}
              height={2}
              rx={1}
              fill="currentColor"
            />
          </g>
        </g>
      </svg>
      <span className="sr-only">{t("kineticAria")}</span>

      {/* Colophon card — the only glass on the cover. Its edge is what the
          plug powers (A1 specular ring). */}
      <div
        ref={cardRef}
        className="glass-thin relative mt-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-panel px-5 py-4 md:mt-14"
      >
        <svg aria-hidden="true" focusable="false" className="absolute h-0 w-0">
          <defs>
            <filter id="hero-glint" x="-20%" y="-20%" width="140%" height="140%">
              <feSpecularLighting
                in="SourceAlpha"
                surfaceScale={1.4}
                specularConstant={1.1}
                specularExponent={34}
                lightingColor="#ffe9cf"
                result="spec"
              >
                <fePointLight ref={lightRef} x={-200} y={22} z={64} />
              </feSpecularLighting>
              <feComposite in="spec" in2="SourceAlpha" operator="in" />
            </filter>
          </defs>
        </svg>
        <span
          ref={ringRef}
          aria-hidden="true"
          className="pointer-events-none absolute -inset-px rounded-panel opacity-0"
          style={{
            border: "1.5px solid rgba(255,255,255,0.9)",
            filter: "url(#hero-glint)",
          }}
        />

        <span className="relative flex items-center gap-3">
          <span aria-hidden="true" className="relative block size-2.5">
            <span className="absolute inset-0 rounded-full bg-fg-tertiary" />
            {/* Lit layer crossfades over the dim one — no shadow tweening. */}
            <span
              ref={lampRef}
              className="absolute -inset-2 rounded-full opacity-0"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,184,107,0.95) 12%, rgba(255,184,107,0.45) 34%, rgba(255,184,107,0) 72%)",
              }}
            />
          </span>
          <span className="vibrancy font-mono text-meta uppercase tracking-meta text-fg-secondary">
            {t("issueLabel")}
          </span>
        </span>

        <Magnetic className="relative">
          <Link
            href="/blog"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-fg px-5 text-caption font-medium text-bg"
          >
            {t("heroCta")}
            <span aria-hidden="true">→</span>
          </Link>
        </Magnetic>
      </div>

      <div className="hero-cue mt-14 flex items-center gap-3 md:mt-20">
        <span className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {t("scrollCue")}
        </span>
        <span
          aria-hidden="true"
          className="h-px w-12 bg-gradient-to-r from-line to-transparent"
        />
      </div>
    </section>
  );
}
