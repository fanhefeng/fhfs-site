"use client";

import { useRef } from "react";
import type { ReactNode, Ref } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

type Props = {
  children: ReactNode;
  /** Wrapper element — keep it semantic (section/ul/…), default div. */
  as?: "div" | "section" | "span" | "ul" | "ol" | "li" | "footer" | "aside";
  className?: string;
  /**
   * When set, the wrapper's direct children animate in sequence with this
   * gap (seconds) instead of the wrapper moving as one block.
   */
  stagger?: number;
};

/**
 * The site-wide entrance values (DESIGN.md §1.5), exported for the places
 * that cannot use the component — nested targets, matchMedia gates — yet
 * must stay on the same motion grammar.
 */
export const REVEAL_VARS = {
  y: 24,
  autoAlpha: 0,
  duration: 0.6,
  ease: "power2.out",
} as const;

/** Where the entrance fires: once, when the trigger's top clears 85%. */
export const REVEAL_START = "top 85%";

/**
 * The one scroll entrance of the site: y:24 / opacity:0 → 0.6s power2.out,
 * fired once at "top 85%". Content is always in the DOM (SSR/SEO safe) —
 * GSAP hides it only on the client just before the from-tween runs.
 */
export function Reveal({ children, as = "div", className, stagger }: Props) {
  const ref = useRef<HTMLElement>(null);
  // Pinned to one concrete tag rather than ElementType: @react-three/fiber
  // merges every three.js element into the global JSX.IntrinsicElements, so
  // the props of an open-ended element union intersect down to `never` and
  // even `children` stops type-checking. Every tag `as` allows is a plain
  // HTML element, so the props are interchangeable and only the ref needs
  // restating.
  const Tag = as as "div";

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const targets: gsap.TweenTarget =
        stagger != null ? Array.from(el.children) : el;
      gsap.from(targets, {
        ...REVEAL_VARS,
        stagger: stagger ?? 0,
        // Leave no inline residue once landed, so hover tweens and Flip
        // reads elsewhere see clean elements.
        clearProps: "transform,opacity,visibility",
        scrollTrigger: { trigger: el, start: REVEAL_START, once: true },
      });
    },
    { scope: ref }
  );

  return (
    <Tag ref={ref as Ref<HTMLDivElement>} className={className}>
      {children}
    </Tag>
  );
}
