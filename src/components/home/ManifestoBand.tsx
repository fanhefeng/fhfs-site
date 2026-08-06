"use client";

import { useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { gsap, useGSAP, ScrollTrigger, SplitText } from "@/lib/gsap";

// Referenced so bundlers keep the plugins; registration lives in @/lib/gsap.
void ScrollTrigger;

/** The band only takes over the screen where a pin is comfortable. The two
 *  queries have to partition the range with nothing between them, so the
 *  second is the negation of the first rather than a hand-picked bound: any
 *  `max-width` twin leaves a sliver — 767.98px still misses (767.98, 768) —
 *  and a fractional viewport is ordinary (browser zoom, non-integer DPR).
 *  A width that matched neither would drop the band into no branch at all:
 *  no pin, not even the calm fade-up, just inert SSR markup while the rest of
 *  the page animates around it. */
const PINNED = "(min-width: 768px)";
const CALM = `not all and ${PINNED}`;

/**
 * The one pinned section of the whole site (after the GSAP demo MYyBrZw).
 *
 * On a desktop pointer the section pins for one screen and vertical scroll is
 * mapped 1:1 onto the horizontal travel of an oversized slogan; every
 * character rides its own ScrollTrigger — with `containerAnimation` set to
 * the horizontal tween, so "left 100% → left 40%" means *horizontal* progress
 * — and tumbles back from a random height and angle as it crosses the stage.
 * The sentence assembles itself as you read it.
 *
 * Everything that makes it a band (full-height stage, max-content track, the
 * 100vw run-up) is written by GSAP inside the matchMedia branch, so the SSR
 * markup — and every mobile visitor — gets a plain centered statement that
 * simply fades up. matchMedia reverts those inline styles when
 * the query stops matching, and `revertOnUpdate` re-splits after a locale
 * switch, where every glyph changes.
 */
export function ManifestoBand() {
  const t = useTranslations("home");
  const locale = useLocale();
  const container = useRef<HTMLElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = container.current;
      const wrapper = wrapperRef.current;
      if (!root || !wrapper) return;
      const q = gsap.utils.selector(container);
      const stage = q<HTMLDivElement>(".band-stage")[0];
      const track = q<HTMLDivElement>(".band-track")[0];
      const texts = q<HTMLElement>(".band-text");
      if (!stage || !track || texts.length === 0) return;

      const mm = gsap.matchMedia();

      // Small screens: the site-wide reveal, nothing else. A pinned sideways
      // run is miserable on a phone.
      mm.add(CALM, () => {
        gsap.from(texts, {
          y: 24,
          autoAlpha: 0,
          duration: 0.6,
          stagger: 0.1,
          ease: "power2.out",
          clearProps: "transform,opacity,visibility",
          scrollTrigger: { trigger: root, start: "top 80%", once: true },
        });
      });

      mm.add(PINNED, () => {
        // Band layout — inline styles only, reverted with the query.
        gsap.set(stage, {
          height: "100svh",
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          paddingTop: 0,
          paddingBottom: 0,
          paddingLeft: 0,
          paddingRight: 0,
        });
        gsap.set(track, {
          display: "flex",
          alignItems: "baseline",
          gap: "4vw",
          width: "max-content",
          maxWidth: "none",
          marginLeft: 0,
          marginRight: 0,
          paddingLeft: "100vw",
          paddingRight: "22vw",
          whiteSpace: "nowrap",
        });
        gsap.set(texts, { marginTop: 0 });

        // Horizontal overflow becomes the pin distance, so travel speed
        // equals scroll speed (ease "none" is required for that).
        const dist = () => Math.max(1, track.scrollWidth - stage.clientWidth);
        const scrollTween = gsap.to(track, {
          x: () => -dist(),
          ease: "none",
          scrollTrigger: {
            trigger: wrapper,
            start: "top top",
            end: () => "+=" + dist(),
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        // Split words as well as chars: words keep the line unbreakable for
        // CJK and latin alike, chars are what tumble.
        const split = SplitText.create(texts, { type: "chars,words" });
        split.chars.forEach((char) => {
          gsap.from(char, {
            yPercent: "random(-200,200)",
            rotation: "random(-20,20)",
            ease: "back.out(1.2)",
            scrollTrigger: {
              trigger: char,
              containerAnimation: scrollTween,
              start: "left 100%",
              end: "left 40%",
              scrub: 1,
            },
          });
        });

        return () => split.revert();
      });
    },
    { dependencies: [locale], scope: container, revertOnUpdate: true }
  );

  return (
    <section ref={container} data-act="manifesto" className="relative">
      {/* Pin wrapper — no transform of its own, so pinning stays exact. */}
      <div ref={wrapperRef}>
        <div className="band-stage px-6 py-24 md:py-32">
          <div className="band-track mx-auto w-full max-w-[680px]">
            <p className="band-text block text-display-sm md:text-[clamp(3rem,8vw,7rem)] md:leading-[1.08] md:font-[650] md:tracking-[-0.03em]">
              {t("slogan")}
            </p>
            {/* The echo is always the other language — tagged so the CJK
                tracking guard in globals.css picks the right rule. */}
            <p
              lang={locale === "zh" ? "en" : "zh-CN"}
              className="band-text no-cjk-oblique mt-4 block font-serif text-title italic text-fg-secondary md:text-[clamp(1.5rem,3vw,2.75rem)]"
            >
              {t("sloganEcho")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
