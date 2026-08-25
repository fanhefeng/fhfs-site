"use client";

import { useRef } from "react";
import { gsap, useGSAP, SplitText, EASE } from "@/lib/gsap";
// Registers ScrambleTextPlugin, which the `scrambleText:` tween below needs.
import "@/lib/gsap-extras";
// Any CJK ideograph/kana in the headline means "do not scramble".
import { HAS_CJK } from "@/lib/reading";

/**
 * The article headline, entering once.
 *
 * Latin titles decode: a single 0.9s ScrambleText pass with a lowercase
 * character set — a typewriter finding the words, not a hacker terminal.
 * Chinese titles get a line-level mask reveal instead: scrambling CJK swaps
 * glyph widths every frame, which reads as noise rather than typing.
 *
 * The real text is always in the DOM (SSR/SEO), so a failed hydration or a
 * stalled font simply leaves a normal headline.
 */
export function PostTitle({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      if (HAS_CJK.test(title)) {
        // SplitText's `mask: "lines"` brings its own clip wrappers: the line
        // slides out from behind a clip, implying it was always there.
        const split = SplitText.create(el, { type: "lines", mask: "lines" });
        gsap.from(split.lines, {
          yPercent: 110,
          duration: 0.7,
          stagger: 0.08,
          ease: EASE.default,
          overwrite: "auto",
        });
        // useGSAP runs this inside a gsap.context, so a returned function is
        // the context's cleanup — but only `revertOnUpdate` below makes it run
        // on a title change rather than just at unmount.
        return () => split.revert();
      }

      gsap.to(el, {
        duration: 0.9,
        ease: "none",
        overwrite: "auto",
        scrambleText: {
          text: title,
          chars: "lowerCase",
          speed: 0.6,
          revealDelay: 0.15,
        },
      });
    },
    // revertOnUpdate is load-bearing, not decoration: without it useGSAP sets
    // `deferCleanup` (deps present, no revertOnUpdate) and skips the revert on
    // a dependency change, re-running the body against the same context. A
    // soft-nav between two CJK posts reuses this instance, so the second
    // SplitText would wrap lines that the first one had already wrapped —
    // nested masks, mismeasured lines, and a headline that can stay clipped.
    { scope: ref, dependencies: [title], revertOnUpdate: true }
  );

  return (
    <h1 ref={ref} className={className}>
      {title}
    </h1>
  );
}
