"use client";

import { useRef } from "react";
import type { ElementType, ReactNode, Ref } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

type Props = {
  children: ReactNode;
  /** Wrapper element — keep it semantic (section/ul/…), default div. */
  as?: "div" | "section" | "span" | "ul" | "ol" | "li" | "footer" | "aside";
  className?: string;
  /** Travel distance in px (the site-wide reveal is y:24 → 0). */
  y?: number;
  /** Extra delay in seconds once the trigger fires. */
  delay?: number;
  /**
   * When set, the wrapper's direct children animate in sequence with this
   * gap (seconds) instead of the wrapper moving as one block.
   */
  stagger?: number;
};

/**
 * The one scroll entrance of the site: y:24 / opacity:0 → 0.6s power2.out,
 * fired once at "top 85%". Content is always in the DOM (SSR/SEO safe) —
 * GSAP hides it only on the client just before the from-tween runs, and
 * reduced-motion users simply never see it move.
 */
export function Reveal({
  children,
  as = "div",
  className,
  y = 24,
  delay = 0,
  stagger,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const Tag = as as ElementType;

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      // Reveals are pure flourish — under reduced motion the content is
      // simply there. matchMedia registrations are reverted by useGSAP.
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const targets: gsap.TweenTarget =
          stagger != null ? Array.from(el.children) : el;
        gsap.from(targets, {
          y,
          autoAlpha: 0,
          duration: 0.6,
          ease: "power2.out",
          delay,
          stagger: stagger ?? 0,
          // Leave no inline residue once landed, so hover tweens and Flip
          // reads elsewhere see clean elements.
          clearProps: "transform,opacity,visibility",
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
        });
      });
    },
    { scope: ref }
  );

  return (
    <Tag ref={ref as Ref<never>} className={className}>
      {children}
    </Tag>
  );
}
