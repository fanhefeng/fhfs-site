"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

const BULBS = 11;

/** A strip of little marquee bulbs that chase like a theater sign. */
export function MarqueeLights({ className = "" }: { className?: string }) {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.to(".bulb", {
          opacity: 1,
          boxShadow: "0 0 8px rgba(232,180,79,0.9)",
          duration: 0.3,
          stagger: { each: 0.12, repeat: -1, yoyo: true },
          ease: "sine.inOut",
        });
      });
    },
    { scope: container }
  );

  return (
    <div
      ref={container}
      aria-hidden
      className={`flex items-center justify-center gap-3 ${className}`}
    >
      {Array.from({ length: BULBS }, (_, i) => (
        <span
          key={i}
          className="bulb h-1.5 w-1.5 rounded-full bg-gold opacity-40"
        />
      ))}
    </div>
  );
}
