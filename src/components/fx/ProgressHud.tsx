"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { gsap, useGSAP } from "@/lib/gsap";

/**
 * Reading-progress HUD — a small liquid-chip glass capsule pinned to the
 * bottom-left corner, showing a hairline progress track plus a tabular
 * percentage. It exists only where "how far into this am I?" is a real
 * question: blog article routes. Everywhere else it renders nothing, so the
 * rest of the site carries no per-scroll work from this component.
 */
export function ProgressHud() {
  // usePathname (from @/i18n/navigation) is locale-stripped, so the three
  // blog routes read as "/blog" (list), "/blog/<slug>" (article) and
  // "/blog/tags/<tag>" (tag list). Anchor both ends: without the trailing $,
  // "[^/]+" swallows "tags" and every tag listing grows a reading-progress
  // chip plus its role="progressbar" live region — a percentage for a page
  // that is not an article and has nothing to read through.
  const pathname = usePathname();
  if (!/^\/blog\/[^/]+$/.test(pathname)) return null;
  // Remount per article so progress/entrance state never leaks across posts.
  return <ReadingChip key={pathname} />;
}

function ReadingChip() {
  const t = useTranslations("blog");
  const rootRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);

  /* Scroll → progress. Input-driven, rAF-throttled, and writes only
   * transform/textContent — no layout mutations, no React re-renders per
   * scroll tick. */
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      const pct = Math.round(p * 100);
      if (fillRef.current) {
        fillRef.current.style.transform = `scaleX(${p})`;
      }
      if (pctRef.current) {
        pctRef.current.textContent = `${pct}%`;
      }
      rootRef.current?.setAttribute("aria-valuenow", String(pct));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* Entrance: one small float-in, then the chip never animates again —
   * only the fill's scaleX follows scroll. */
  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      gsap.fromTo(
        root,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.35, overwrite: "auto" }
      );
    },
    { scope: rootRef }
  );

  return (
    <div
      ref={rootRef}
      role="progressbar"
      aria-label={t("progressAria")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      className="liquid-chip pointer-events-none fixed bottom-5 left-5 z-40 flex select-none items-center gap-2.5 rounded-full px-3.5 py-2 opacity-0"
    >
      {/* Hairline track + solid amber fill (brand color stays a solid layer;
          only the glass chip beneath it is translucent). */}
      <span
        aria-hidden
        className="relative block h-0.5 w-9 overflow-hidden rounded-full bg-fg/15"
      >
        <span
          ref={fillRef}
          className="absolute inset-0 origin-left scale-x-0 rounded-full bg-accent will-change-transform"
        />
      </span>
      <span
        aria-hidden
        className="vibrancy min-w-[4ch] text-right font-mono text-[10.5px] tracking-[0.08em] [font-variant-numeric:tabular-nums]"
      >
        0%
      </span>
    </div>
  );
}
