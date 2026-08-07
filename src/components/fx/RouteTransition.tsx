"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import { site } from "@/config/site";

/** Veil frosting over the outgoing page. */
const COVER_DURATION = 0.3;
/** Incoming page materializing out of the frost. */
const REVEAL_DURATION = 0.45;
/**
 * Hard ceiling on how long the veil may hang while we wait for the new
 * route to commit. A navigation that stalls, redirects to the same path, or
 * never lands must never leave a frosted overlay on top of the site.
 */
const NAV_TIMEOUT_MS = 1500;

type Phase = "idle" | "covering" | "covered" | "revealing";

/** Tiny mono word printed on the veil. */
const VEIL_LABEL = site.signName;

/**
 * Glass materialize between routes ("The Quiet Issue" curtain).
 *
 * Clicks on in-site links are caught in the capture phase; a full-screen
 * glass veil frosts over the old page (opacity in + backdrop blur 0→thick,
 * power3.out), only then do we actually navigate. When the new pathname
 * commits, the incoming page materializes: the veil's `--panel-blur` runs
 * back to 0 as it fades (power3.in — crisp exit) while <main> settles
 * scale .98→1 (power3.out). Serves understanding + safety: the reader sees
 * the page they left dissolve and the next one condense, never a hard cut.
 *
 * Mechanism:
 * - capture-phase interception; external links / hash jumps / downloads /
 *   modifier clicks / `data-no-transition` all keep native behaviour;
 * - cover → covered → revealing state machine gated on the pathname commit;
 * - every abnormal path (killed tween, failed push, unmount) funnels into
 *   forceClear(), plus a timeout net, so the site can never be left frosted;
 * - lenis contract: stop() + overflow hidden while covered, then
 *   scrollTo(immediate, force) → start() → ScrollTrigger.refresh(); the
 *   reveal only resets to top when the committed URL carries no fragment.
 *
 * The veil is pointer-events: none and the transition is interruptible — a
 * click mid-cover simply retargets the pending destination, and a click
 * mid-reveal kills the timeline and frosts again from the current
 * opacity/blur values (no jumps, no locked UI). `--panel-blur` is only ever
 * tweened at these entrance/exit instants.
 */
export function RouteTransition() {
  const container = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  // Raw pathname (locale prefix included) — the reveal is gated on the phase,
  // not on the path shape, so a locale switch that changes /zh/x to /en/x
  // while no veil is up is simply ignored (a locale swap deliberately has no
  // transition of its own — the words swap in place).
  const pathname = usePathname();
  const router = useRouter();

  const phaseRef = useRef<Phase>("idle");
  const revealRef = useRef<(() => void) | null>(null);
  const lastPathRef = useRef<string | null>(null);

  useGSAP(
    () => {
      const veil = veilRef.current;
      const wordmark = labelRef.current;
      if (!veil || !wordmark) return;

      let tl: gsap.core.Timeline | null = null;
      let timer: number | undefined;
      let locked = false;
      let pendingHref: string | null = null;

      /** The page body that materializes. Missing <main> = veil-only. */
      const page = () => document.querySelector("main");

      /* The frost target respects the responsive glass budget: --blur-thick
       * is 20px on desktop, 10px on mobile (globals.css). Read once per
       * cover — an event-driven read, never per frame. */
      const targetBlur = () =>
        getComputedStyle(veil).getPropertyValue("--blur-thick").trim() ||
        "20px";

      const lock = () => {
        if (locked) return;
        locked = true;
        lockScroll();
      };

      // No refresh here — the reveal calls ScrollTrigger.refresh() itself,
      // timed against the incoming page.
      const unlock = () => {
        if (!locked) return;
        locked = false;
        unlockScroll();
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
        tl?.kill();
        tl = null;
        pendingHref = null;
        gsap.set(veil, { autoAlpha: 0, "--panel-blur": "0px" });
        gsap.set(wordmark, { autoAlpha: 0 });
        const main = page();
        if (main) gsap.set(main, { clearProps: "transform" });
        phaseRef.current = "idle";
        unlock();
      };

      /** Push the latest pending destination and arm the stall net. */
      const commit = () => {
        clearTimer();
        // Nothing is allowed to leave the veil up forever.
        timer = window.setTimeout(forceClear, NAV_TIMEOUT_MS);
        const href = pendingHref;
        if (!href) {
          forceClear();
          return;
        }
        try {
          router.push(href);
        } catch {
          forceClear();
        }
      };

      const reveal = () => {
        if (phaseRef.current !== "covered") return;
        clearTimer();
        tl?.kill();
        phaseRef.current = "revealing";
        pendingHref = null;

        // New route, new top — but only when the committed URL has no
        // fragment. Next writes the new URL in an insertion effect and
        // scrolls the hash target into view in a layout effect, both of them
        // before the passive effect that schedules this reveal: by now
        // window.location IS the new URL, and a hash on it means the reader
        // has already been put on the section they clicked. Resetting to 0
        // here used to yank every cross-page "/page#section" link back to the
        // top of the article. unlock() re-syncs Lenis to wherever we end up.
        if (!window.location.hash) {
          // Lenis is stopped right now, hence `force`.
          const lenis = window.__lenis;
          if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
          else window.scrollTo(0, 0);
        }

        const main = page();

        tl = gsap.timeline({
          onComplete: () => {
            clearTimer();
            tl = null;
            gsap.set(veil, { autoAlpha: 0, "--panel-blur": "0px" });
            phaseRef.current = "idle";
            unlock();
            // The incoming page built its pins while scrolling was locked
            // and the layout was still settling — remeasure the final one.
            ScrollTrigger.refresh();
          },
        });

        tl.to(
          wordmark,
          { autoAlpha: 0, duration: 0.18, ease: "power1.out", overwrite: "auto" },
          0
        )
          // The veil departs power3.in — lingers a beat, then snaps clear.
          .to(
            veil,
            {
              autoAlpha: 0,
              "--panel-blur": "0px",
              duration: REVEAL_DURATION,
              ease: "power3.in",
            },
            0
          );

        if (main) {
          // The set() lands behind full frost, so the snap to .98 is unseen.
          // clearProps on arrival: a transformed <main> would otherwise turn
          // into the containing block for fixed descendants (HUD, FAB).
          gsap.set(main, { scale: 0.98, transformOrigin: "50% 38%" });
          tl.to(
            main,
            {
              scale: 1,
              duration: REVEAL_DURATION + 0.05,
              ease: "power3.out",
              clearProps: "transform",
            },
            0
          );
        }

        // Net in case something else kills the timeline mid-flight.
        timer = window.setTimeout(
          forceClear,
          (REVEAL_DURATION + 0.05) * 1000 + 400
        );
      };
      revealRef.current = reveal;

      const cover = () => {
        clearTimer();
        // Interrupting a reveal: kill it and frost again from the current
        // opacity/blur — gsap.to picks up mid-flight values, so the veil
        // never jumps.
        tl?.kill();
        lock();
        phaseRef.current = "covering";

        tl = gsap.timeline({
          onComplete: () => {
            tl = null;
            phaseRef.current = "covered";
            commit();
          },
        });

        tl.to(
          veil,
          {
            autoAlpha: 1,
            "--panel-blur": targetBlur(),
            duration: COVER_DURATION,
            ease: "power3.out",
          },
          0
        ).to(
          wordmark,
          { autoAlpha: 1, duration: 0.28, ease: "power1.out", overwrite: "auto" },
          0.05
        );
      };

      const onClick = (e: MouseEvent) => {
        // Modifier clicks, middle/right buttons and already-handled events
        // keep the browser's own behaviour (new tab, new window, menu).
        if (e.defaultPrevented || e.button !== 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

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
        pendingHref = `${url.pathname}${url.search}${url.hash}`;

        // Interruptible, never locked: mid-cover we only retarget the
        // pending destination; already covered we re-route on the spot;
        // idle or mid-reveal we (re)frost from wherever the veil is now.
        if (phaseRef.current === "covering") return;
        if (phaseRef.current === "covered") {
          commit();
          return;
        }
        cover();
      };

      document.addEventListener("click", onClick, true);

      return () => {
        document.removeEventListener("click", onClick, true);
        revealRef.current = null;
        forceClear();
      };
    },
    { scope: container }
  );

  useEffect(() => {
    // First mount belongs to OvertureLight's opening ritual, not to us.
    if (lastPathRef.current === null) {
      lastPathRef.current = pathname;
      return;
    }
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;

    // Only a navigation we covered gets uncovered. A locale switch (which
    // replaces the route with scroll: false) or a browser Back never raised
    // the veil, so it must not be scrolled to top or animated here.
    if (phaseRef.current !== "covered") return;

    // Let the incoming route paint one frame behind the frost first.
    const raf = requestAnimationFrame(() => revealRef.current?.());
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return (
    <div ref={container} className="contents">
      {/* Veil tint: warm paper by day, after-hours ink by night. Under
          prefers-reduced-transparency the frost becomes a near-solid card
          and the blur is dropped entirely (the tween then no-ops visually).
          Component-private tokens — do not move these into globals.css. */}
      <style>{`
        :root {
          --veil-bg: rgba(250, 249, 246, 0.62);
        }
        :root[data-theme="dark"] {
          --veil-bg: rgba(14, 14, 17, 0.55);
        }
        @media (prefers-reduced-transparency: reduce) {
          :root {
            --veil-bg: rgba(250, 249, 246, 0.96);
          }
          :root[data-theme="dark"] {
            --veil-bg: rgba(14, 14, 17, 0.96);
          }
          .route-veil {
            -webkit-backdrop-filter: none !important;
            backdrop-filter: none !important;
          }
        }
      `}</style>
      <div
        ref={veilRef}
        aria-hidden="true"
        className="route-veil invisible pointer-events-none fixed inset-0 z-[95] grid place-items-center opacity-0"
        style={
          {
            background: "var(--veil-bg)",
            WebkitBackdropFilter: "blur(var(--panel-blur)) saturate(140%)",
            backdropFilter: "blur(var(--panel-blur)) saturate(140%)",
            "--panel-blur": "0px",
          } as CSSProperties
        }
      >
        <div
          ref={labelRef}
          className="invisible font-mono text-meta tracking-meta uppercase text-fg-tertiary opacity-0"
        >
          {VEIL_LABEL}
        </div>
      </div>
    </div>
  );
}
