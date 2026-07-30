"use client";

import { useRef } from "react";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";

// Referenced so bundlers keep the plugin; registration lives in @/lib/gsap.
void ScrollTrigger;

export type PoemInterludeProps = {
  kicker: string;
  title: string;
  lines: string[];
  finale: string[];
  attribution: string;
};

/**
 * "TRACK 03 · 诗" — a quiet poem interlude between the louder acts.
 *
 * On md+ the poem is typeset the traditional Chinese way: vertical columns
 * read right to left (writing-mode: vertical-rl), the title as the rightmost
 * column, and a red name seal pressed at the lower-left — the reading end.
 * Each column hangs down out of an overflow mask like a scroll unrolling.
 * On small screens the original horizontal line-by-line layout remains.
 */
export function PoemInterlude({
  kicker,
  title,
  lines,
  finale,
  attribution,
}: PoemInterludeProps) {
  const container = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(container);
      const mm = gsap.matchMedia();

      // Desktop: vertical columns drop down from their masks, right first.
      mm.add(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        () => {
          const kickerInner = q(".poem-kicker .split-inner");
          const colInners = q(".poem-vertical .poem-col-inner");
          const sealGroup = q(".poem-seal-group");
          const seal = q(".poem-seal");
          const finaleInners = q(".poem-finale .split-inner");

          // Hide via JS only, so no-JS visitors still read the poem.
          gsap.set(kickerInner, { yPercent: 110 });
          gsap.set(colInners, { yPercent: -108 });
          gsap.set(finaleInners, { yPercent: 118, letterSpacing: "0.4em" });
          gsap.set(sealGroup, { opacity: 0 });
          gsap.set(seal, { scale: 1.4 });

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: container.current,
              start: "top 65%",
              toggleActions: "play none none none",
            },
            defaults: { ease: "expo.out" },
          });

          // 1. Kicker rises out of its mask.
          tl.to(kickerInner, { yPercent: 0, duration: 0.8 });

          // 2. Columns hang down one by one. DOM order is row-reversed, so
          //    from: "start" begins with the rightmost column (the title) —
          //    exactly the traditional reading order.
          tl.to(
            colInners,
            {
              yPercent: 0,
              duration: 1.15,
              stagger: { each: 0.12, from: "start" },
            },
            "-=0.4"
          );

          // 3. The three heavy words land below, tracking tightening.
          tl.to(
            finaleInners,
            {
              yPercent: 0,
              letterSpacing: "0.15em",
              duration: 1.2,
              stagger: 0.22,
            },
            "-=0.35"
          );

          // 4. The seal is pressed on — a quick scale settle, like a stamp.
          tl.to(
            sealGroup,
            { opacity: 1, duration: 0.35, ease: "power2.out" },
            "-=1.0"
          );
          tl.to(seal, { scale: 1, duration: 0.5, ease: "power4.out" }, "<");
        }
      );

      // Mobile: the original horizontal line-by-line reveal.
      mm.add(
        "(max-width: 767.98px) and (prefers-reduced-motion: no-preference)",
        () => {
          const headInners = q(
            ".poem-kicker .split-inner, .poem-title-m .split-inner"
          );
          const lineInners = q(".poem-lines .split-inner");
          const finaleInners = q(".poem-finale .split-inner");
          const attributionEl = q(".poem-attribution");

          gsap.set([headInners, lineInners], { yPercent: 110 });
          gsap.set(finaleInners, { yPercent: 118, letterSpacing: "0.4em" });
          gsap.set(attributionEl, { opacity: 0, y: 12 });

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: container.current,
              start: "top 65%",
              toggleActions: "play none none none",
            },
            defaults: { ease: "expo.out" },
          });

          tl.to(headInners, { yPercent: 0, duration: 0.9, stagger: 0.12 });
          tl.to(
            lineInners,
            { yPercent: 0, duration: 1.05, stagger: 0.09 },
            "-=0.55"
          );
          tl.to(
            finaleInners,
            {
              yPercent: 0,
              letterSpacing: "0.15em",
              duration: 1.2,
              stagger: 0.22,
            },
            "-=0.2"
          );
          tl.to(
            attributionEl,
            { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" },
            "-=0.4"
          );
        }
      );
    },
    { scope: container }
  );

  return (
    <section
      ref={container}
      data-act="poem"
      // Background spotlight now comes from the site-wide Atmosphere layer.
      className="flex min-h-[85svh] flex-col items-center justify-center px-6 py-24 text-center"
    >
      <div className="poem-kicker">
        <p className="split-line">
          <span className="split-inner track-kicker">{kicker}</span>
        </p>
      </div>

      {/* Mobile-only title, part of the original horizontal head.
          Wrapper div carries md:hidden — .split-line's own display:block
          (unlayered CSS) would beat the layered md:hidden utility. */}
      <div className="poem-title-m md:hidden">
        <h2 className="split-line mt-4">
          <span className="split-inner font-deco text-xl tracking-widest text-gold [text-shadow:var(--glow-gold)]">
            《{title}》
          </span>
        </h2>
      </div>

      {/* md+: traditional vertical typesetting, columns read right → left.
          flex-row-reverse puts the DOM-first title column on the right. */}
      <div className="poem-vertical mt-12 hidden w-full flex-row-reverse items-start justify-center gap-x-[clamp(0.9rem,2vw,1.75rem)] md:flex">
        <div className="overflow-hidden [writing-mode:vertical-rl]">
          <h2 className="poem-col-inner font-deco text-2xl tracking-[0.24em] text-gold [text-shadow:var(--glow-gold)] lg:text-3xl">
            《{title}》
          </h2>
        </div>
        {lines.map((line, i) => (
          <div key={i} className="overflow-hidden [writing-mode:vertical-rl]">
            <p className="poem-col-inner text-lg tracking-[0.18em] text-fg/90 lg:text-xl">
              {line}
            </p>
          </div>
        ))}
        {/* The seal — leftmost, bottom-aligned: where the reading ends. */}
        <div className="poem-seal-group flex flex-col items-center gap-2 self-end pl-1 [writing-mode:horizontal-tb]">
          <span className="poem-seal grid h-[1.9rem] w-[1.9rem] rotate-3 place-items-center border-2 border-neon-red/85 text-base leading-none text-neon-red opacity-90">
            凡
          </span>
          <span className="max-w-[8.5rem] text-center font-mono text-[10px] leading-relaxed text-muted-fg">
            {attribution}
          </span>
        </div>
      </div>

      {/* Mobile-only poem lines, the original horizontal layout */}
      <div className="poem-lines mt-10 md:hidden">
        {lines.map((line, i) => (
          <p key={i} className="split-line">
            <span className="split-inner text-lg leading-loose text-fg/90">
              {line}
            </span>
          </p>
        ))}
      </div>

      <div className="poem-finale mt-14 flex flex-wrap items-baseline justify-center gap-x-10 gap-y-4 md:gap-x-16">
        {finale.map((word, i) => (
          <span key={i} className="split-line">
            <span className="split-inner font-deco text-4xl text-gold md:text-6xl">
              {word}
            </span>
          </span>
        ))}
      </div>

      {/* Mobile-only attribution; on md+ it lives beside the seal */}
      <p className="poem-attribution mt-12 text-sm italic text-muted-fg md:hidden">
        {attribution}
      </p>
    </section>
  );
}
