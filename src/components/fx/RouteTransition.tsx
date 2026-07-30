"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { gsap, useGSAP, ScrollTrigger, CustomEase } from "@/lib/gsap";
import { site } from "@/config/site";

/** Diagonal offset between the cut's left and right edges, in % (same as CinematicLoader). */
const SKEW = 16;
/** Blade sweeping in over the outgoing page. */
const COVER_DURATION = 0.55;
/** Blade slicing away off the incoming page. */
const REVEAL_DURATION = 0.75;
/**
 * Hard ceiling on how long the curtain may hang while we wait for the new
 * route to commit. A navigation that stalls, redirects to the same path, or
 * never lands must never leave an opaque overlay on top of the site.
 */
const NAV_TIMEOUT_MS = 1500;

type Phase = "idle" | "covering" | "covered" | "revealing";
/** Which side of the moving edge the curtain lives on. */
type Shape = "cover" | "reveal";

export type RouteTransitionProps = {
  /** Tiny mono word printed on the curtain. Defaults to the site wordmark. */
  label?: string;
};

/**
 * Cinematic blade wipe between routes.
 *
 * Same visual language as the opening CinematicLoader: a glowing gold line
 * rides a diagonal four-point clip-path cut, driven by the "blade" CustomEase.
 * Clicks on in-site links are caught in the capture phase, the curtain sweeps
 * down over the old page, and only then do we actually navigate. When the new
 * pathname commits the same edge keeps travelling down and slices the curtain
 * away, revealing the new page from the top.
 *
 * Design rules baked in here:
 * - One coverage value `prog.p` drives both halves, so a reveal that gets
 *   interrupted by another click simply runs backwards — the edge never jumps.
 * - clip-path is rebuilt per frame from a number (GSAP cannot tween polygon
 *   strings whose point counts differ), and the blade moves via a transform
 *   quickSetter — no per-frame layout writes.
 * - Every abnormal path (killed tween, double click, failed push, unmount)
 *   funnels into forceClear(), plus a timeout net, so the site can never be
 *   left uninteractive behind the curtain.
 * - prefers-reduced-motion: reduce means we never preventDefault at all, so
 *   navigation stays completely native.
 */
export function RouteTransition({
  label = site.signName,
}: RouteTransitionProps) {
  const container = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const bladeRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  // Raw pathname (locale prefix included) — the reveal is gated on the phase,
  // not on the path shape, so a locale switch that changes /zh/x to /en/x
  // while no curtain is up is simply ignored.
  const pathname = usePathname();
  const router = useRouter();

  const phaseRef = useRef<Phase>("idle");
  const revealRef = useRef<(() => void) | null>(null);
  const lastPathRef = useRef<string | null>(null);

  useGSAP(
    () => {
      const curtain = curtainRef.current;
      const blade = bladeRef.current;
      const wordmark = labelRef.current;
      if (!curtain || !blade || !wordmark) return;

      // Slow wind-up, violent mid-swing, soft landing — the whole "blade"
      // feel. Re-created here so this component does not depend on the
      // loader having mounted first (CustomEase.create is idempotent).
      CustomEase.create(
        "blade",
        "M0,0 C0.16,0 0.2,0.06 0.34,0.36 0.5,0.72 0.62,1 1,1"
      );

      const setBladeY = gsap.quickSetter(blade, "y", "vh");
      gsap.set(blade, { rotate: -3.6 });

      const prog = { p: 0 };
      let shape: Shape = "cover";
      let tween: gsap.core.Tween | null = null;
      let timer: number | undefined;
      let locked = false;

      /**
       * p = 0 is a bare page, p = 1 is a fully covered one. In "cover" the
       * curtain sits above the moving edge, in "reveal" below it — so in both
       * halves the edge (and the blade riding it) travels top to bottom, and
       * at p = 1 both shapes cover the viewport identically.
       */
      const applyCut = (p: number) => {
        const yl = (shape === "cover" ? p : 1 - p) * (100 + SKEW);
        const yr = yl - SKEW;
        curtain.style.clipPath =
          shape === "cover"
            ? `polygon(0% 0%, 100% 0%, 100% ${yr}%, 0% ${yl}%)`
            : `polygon(0% ${yl}%, 100% ${yr}%, 100% 100%, 0% 100%)`;
        setBladeY((yl + yr) / 2);
      };

      const lock = () => {
        if (locked) return;
        locked = true;
        window.__lenis?.stop();
        document.documentElement.style.overflow = "hidden";
      };

      const unlock = () => {
        if (!locked) return;
        locked = false;
        document.documentElement.style.overflow = "";
        // Re-sync before resuming, otherwise Lenis snaps back to whatever
        // offset it held when we stopped it.
        window.__lenis?.scrollTo(window.scrollY, {
          immediate: true,
          force: true,
        });
        window.__lenis?.start();
      };

      const clearTimer = () => {
        if (timer !== undefined) {
          window.clearTimeout(timer);
          timer = undefined;
        }
      };

      /** Last resort: whatever went wrong, the page must be usable again. */
      const forceClear = () => {
        clearTimer();
        tween?.kill();
        tween = null;
        shape = "cover";
        prog.p = 0;
        applyCut(0);
        gsap.set(curtain, { autoAlpha: 0, pointerEvents: "none" });
        gsap.set(blade, { autoAlpha: 0 });
        gsap.set(wordmark, { autoAlpha: 0 });
        phaseRef.current = "idle";
        unlock();
      };

      const reveal = () => {
        if (phaseRef.current !== "covered") return;
        clearTimer();
        tween?.kill();
        phaseRef.current = "revealing";

        // New route, new top. Lenis is stopped right now, hence `force`.
        const lenis = window.__lenis;
        if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
        else window.scrollTo(0, 0);

        gsap.to(wordmark, {
          autoAlpha: 0,
          duration: 0.22,
          ease: "power1.out",
          overwrite: true,
        });

        shape = "reveal";
        prog.p = 1;
        gsap.set(blade, { autoAlpha: 1 });
        applyCut(1);

        tween = gsap.to(prog, {
          p: 0,
          duration: REVEAL_DURATION,
          ease: "blade",
          onUpdate: () => applyCut(prog.p),
          onComplete: () => {
            clearTimer();
            tween = null;
            shape = "cover";
            prog.p = 0;
            applyCut(0);
            gsap.set(curtain, { autoAlpha: 0, pointerEvents: "none" });
            gsap.set(blade, { autoAlpha: 0 });
            phaseRef.current = "idle";
            unlock();
            // The incoming page built its pins while scrolling was locked and
            // the layout was still settling — remeasure against the final one.
            ScrollTrigger.refresh();
          },
        });

        // Net in case something else kills the tween mid-flight.
        timer = window.setTimeout(
          forceClear,
          REVEAL_DURATION * 1000 + 400
        );
      };
      revealRef.current = reveal;

      const cover = (go: () => void) => {
        clearTimer();
        tween?.kill();
        lock();

        // A fresh cover sweeps a new blade down the page. Interrupting a
        // reveal instead runs that same cut backwards, so the edge stays
        // continuous rather than flipping to the other half of the screen.
        const resuming = phaseRef.current === "revealing";
        if (!resuming) {
          shape = "cover";
          prog.p = 0;
        }
        phaseRef.current = "covering";

        gsap.set(curtain, { autoAlpha: 1, pointerEvents: "auto" });
        gsap.set(blade, { autoAlpha: 1 });
        gsap.to(wordmark, {
          autoAlpha: 1,
          duration: 0.34,
          ease: "power1.out",
          overwrite: true,
        });
        applyCut(prog.p);

        tween = gsap.to(prog, {
          p: 1,
          duration: Math.max(0.12, COVER_DURATION * (1 - prog.p)),
          ease: resuming ? "power2.inOut" : "blade",
          onUpdate: () => applyCut(prog.p),
          onComplete: () => {
            tween = null;
            phaseRef.current = "covered";
            // Nothing is allowed to leave the curtain up forever.
            timer = window.setTimeout(forceClear, NAV_TIMEOUT_MS);
            go();
          },
        });
      };

      const prefersReduced = () =>
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const onClick = (e: MouseEvent) => {
        // Modifier clicks, middle/right buttons and already-handled events
        // keep the browser's own behaviour (new tab, new window, menu).
        if (e.defaultPrevented || e.button !== 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (prefersReduced()) return;

        const from = e.target instanceof Element ? e.target : null;
        const anchor = from?.closest("a[href]");
        // Also filters out SVG <a>, which is not an HTMLAnchorElement.
        if (!(anchor instanceof HTMLAnchorElement)) return;
        if (anchor.target && anchor.target !== "_self") return;
        if (anchor.hasAttribute("download")) return;
        if (anchor.dataset.noTransition !== undefined) return;
        const rel = anchor.getAttribute("rel");
        if (rel && rel.split(/\s+/).includes("external")) return;

        let url: URL;
        try {
          url = new URL(anchor.href, window.location.href);
        } catch {
          return;
        }
        // Cross-origin, mailto:/tel: (origin "null"), same-page hash jumps and
        // query-only changes all fall through to the default behaviour —
        // none of them would produce a pathname change to uncover on.
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname) return;

        e.preventDefault();
        // Already mid-transition: swallow the click instead of stacking a
        // second curtain on top of the first.
        if (phaseRef.current === "covering" || phaseRef.current === "covered") {
          return;
        }

        const href = `${url.pathname}${url.search}${url.hash}`;
        cover(() => {
          try {
            router.push(href);
          } catch {
            forceClear();
          }
        });
      };

      // The curtain is opaque, so anything focusable behind it would take an
      // invisible focus ring — and Enter would activate an unseen link.
      const onFocusIn = (e: FocusEvent) => {
        if (phaseRef.current === "idle") return;
        const target = e.target;
        if (
          target instanceof HTMLElement &&
          target !== document.body &&
          !container.current?.contains(target)
        ) {
          target.blur();
        }
      };

      document.addEventListener("click", onClick, true);
      window.addEventListener("focusin", onFocusIn);

      return () => {
        document.removeEventListener("click", onClick, true);
        window.removeEventListener("focusin", onFocusIn);
        revealRef.current = null;
        forceClear();
      };
    },
    { scope: container }
  );

  useEffect(() => {
    // First mount belongs to CinematicLoader's opening curtain, not to us.
    if (lastPathRef.current === null) {
      lastPathRef.current = pathname;
      return;
    }
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;

    // Only a navigation we covered gets uncovered. A locale switch (which
    // replaces the route with scroll: false) or a browser Back never raised a
    // curtain, so it must not be scrolled to top or animated here.
    if (phaseRef.current !== "covered") return;

    // Let the incoming route paint one frame behind the curtain first.
    const raf = requestAnimationFrame(() => revealRef.current?.());
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return (
    <div ref={container} className="contents">
      {/* Curtain palette: midnight stage at night, warm paper after hours.
          Component-private tokens — do not move these into globals.css. */}
      <style>{`
        :root {
          --curtain-bg: #0a0a18;
          --curtain-blade-core: #fff;
          --curtain-ink: var(--fg);
          --curtain-glow-rgb: 232, 180, 79;
        }
        :root[data-theme="light"] {
          --curtain-bg: #f0ead9;
          --curtain-blade-core: #fff;
          --curtain-glow-rgb: 168, 116, 31;
        }
      `}</style>
      <div
        ref={curtainRef}
        aria-hidden="true"
        className="invisible pointer-events-none fixed inset-0 z-[95] grid place-items-center opacity-0"
        // Must match applyCut(0) in "cover" shape or the first frame flashes.
        style={{
          background: "var(--curtain-bg)",
          clipPath: "polygon(0% 0%, 100% 0%, 100% -16%, 0% 0%)",
        }}
      >
        <div
          ref={labelRef}
          className="invisible font-mono text-[11px] tracking-[0.42em] text-muted-fg opacity-0"
        >
          {label}
        </div>
      </div>
      {/* The blade: a glowing diagonal line riding the mouth of the cut. */}
      <div
        ref={bladeRef}
        aria-hidden="true"
        className="invisible pointer-events-none fixed top-0 left-[-10%] z-[96] h-[2px] w-[120%] opacity-0 will-change-transform"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--gold) 18%, var(--curtain-blade-core) 50%, var(--gold) 82%, transparent)",
          boxShadow: "0 0 24px 4px rgba(var(--curtain-glow-rgb), 0.5)",
        }}
      />
    </div>
  );
}
