"use client";

import { useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { gsap, useGSAP, ScrollTrigger, SplitText } from "@/lib/gsap";

// Referenced so bundlers keep the plugins; registration lives in @/lib/gsap.
void ScrollTrigger;

/**
 * The manifesto, standing on its own screen inside /about.
 *
 * It used to be the site's one pinned passage: vertical scroll mapped onto the
 * horizontal travel of an oversized slogan, each character tumbling in as it
 * crossed the stage. That pin has moved to the cover, where the approach into
 * the grove earns it — and a second pinned passage on a page the reader is
 * *reading* only breaks the column's rhythm. So the sentence stays where the
 * eye already is and assembles itself in place: same tumbling characters, same
 * back.out landing, played once as the section comes into view.
 */
export function ManifestoBand() {
  const t = useTranslations("home");
  const locale = useLocale();
  const container = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = container.current;
      if (!root) return;
      const texts = gsap.utils.selector(container)<HTMLElement>(".band-text");
      if (texts.length === 0) return;

      // Words as well as chars: words keep the line unbreakable for CJK and
      // latin alike, chars are what tumble.
      const split = SplitText.create(texts, { type: "chars,words" });
      const tween = gsap.from(split.chars, {
        yPercent: "random(-140,140)",
        rotation: "random(-16,16)",
        autoAlpha: 0,
        duration: 0.9,
        ease: "back.out(1.2)",
        stagger: { each: 0.012, from: "start" },
        scrollTrigger: { trigger: root, start: "top 72%", once: true },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
        split.revert();
      };
    },
    { dependencies: [locale], scope: container, revertOnUpdate: true }
  );

  return (
    <section ref={container} data-act="manifesto" className="relative px-6 py-24 md:py-32">
      <div className="mx-auto w-full max-w-[680px]">
        <p className="band-text block text-display-sm md:text-[clamp(2.5rem,5.4vw,4.25rem)] md:leading-[1.1] md:font-[650] md:tracking-[-0.03em]">
          {t("slogan")}
        </p>
        {/* The echo is always the other language — tagged so the CJK tracking
            guard in globals.css picks the right rule. */}
        <p
          lang={locale === "zh" ? "en" : "zh-CN"}
          className="band-text no-cjk-oblique mt-4 block font-serif text-title italic text-fg-secondary md:text-[clamp(1.375rem,2.4vw,2rem)]"
        >
          {t("sloganEcho")}
        </p>
      </div>
    </section>
  );
}
