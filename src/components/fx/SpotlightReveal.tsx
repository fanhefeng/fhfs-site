"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

/**
 * Wraps a section so it fades in like a stage light warming up
 * when scrolled into view. Content stays in static HTML for SEO;
 * the hidden state is only applied once JS runs.
 */
export function SpotlightReveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(container.current, { opacity: 0, y: 32 });
        gsap.to(container.current, {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: {
            trigger: container.current,
            start: "top 82%",
            once: true,
          },
        });
      });
    },
    { scope: container }
  );

  return (
    <div ref={container} className={className}>
      {children}
    </div>
  );
}
