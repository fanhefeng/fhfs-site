"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";

/**
 * The five stage boards. Numbers and mono captions are deliberately
 * untranslated set-list jargon — same register as the TRACK kickers.
 */
const ITEMS = [
  { href: "/", key: "home", note: "DOORS · OPEN ALL NIGHT" },
  { href: "/blog", key: "blog", note: "SET 01 · AFTER-HOURS NOTES" },
  { href: "/about", key: "about", note: "SET 02 · THE MAN AT THE BAR" },
  { href: "/portfolio", key: "portfolio", note: "SET 03 · SELECTED WORKS" },
  { href: "/software", key: "software", note: "SET 04 · HOUSE SPECIALS" },
] as const;

export type FullNavProps = {
  /** Whether the curtain-call menu is shown. Owned by the Header. */
  open: boolean;
  /**
   * Ask the owner to flip `open` to false. Fired on Escape, on clicking the
   * item for the page we are already on, and on route commits.
   */
  onClose: () => void;
  /**
   * The Header's hamburger button. Focus returns to it when the menu closes,
   * and Tab cycles through it (it stays visible above the boards).
   */
  triggerRef: RefObject<HTMLButtonElement | null>;
};

/**
 * Full-screen "curtain call" navigation.
 *
 * Opening: vertical stage boards slam in from the right (back.out overshoot,
 * staggered), their poster text rising just behind. Closing is deliberately
 * asymmetric — the boards drop off the bottom of the stage with a random
 * tilt, last board first, like scenery being struck after the show. Both
 * sequences are built on ONE timeline via tl.clear(), so a re-toggle mid-
 * flight simply rebuilds from wherever the boards currently are.
 *
 * Scroll is locked while open (Lenis stop + overflow hidden, restored with a
 * forced re-sync — same contract as CinematicLoader). Reduced motion swaps
 * both directions for a plain 0.2s fade. On a route commit the layer resets
 * instantly with no animation: RouteTransition's blade is already covering
 * the screen, so animating here would play to nobody.
 */
export function FullNav({ open, onClose, triggerRef }: FullNavProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const lockedRef = useRef(false);
  const openRef = useRef(open);
  const prevOpenRef = useRef(false);
  const lastPathRef = useRef<string | null>(null);

  const t = useTranslations("nav");
  const pathname = usePathname();

  const lock = useCallback(() => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    window.__lenis?.stop();
    document.documentElement.style.overflow = "hidden";
  }, []);

  const unlock = useCallback(() => {
    if (!lockedRef.current) return;
    lockedRef.current = false;
    document.documentElement.style.overflow = "";
    // Re-sync before resuming, otherwise Lenis snaps back to the offset it
    // held when it was stopped (same contract as CinematicLoader's unlock).
    window.__lenis?.scrollTo(window.scrollY, { immediate: true, force: true });
    window.__lenis?.start();
    // Pins may have been measured without a scrollbar; remeasure once.
    ScrollTrigger.refresh();
  }, []);

  // One persistent timeline; open/close sequences are rebuilt onto it with
  // tl.clear() so the two directions never have to mirror each other.
  useGSAP(
    () => {
      tlRef.current = gsap.timeline({ paused: true });
    },
    { scope: rootRef }
  );

  useEffect(() => {
    openRef.current = open;
    const root = rootRef.current;
    const tl = tlRef.current;
    if (!root || !tl) return;
    // Initial mount in the closed state: nothing to animate, nothing to lock.
    if (!prevOpenRef.current && !open) return;
    prevOpenRef.current = open;

    const boards = gsap.utils.toArray<HTMLElement>(".fn-board", root);
    const texts = gsap.utils.toArray<HTMLElement>(".fn-text", root);
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    tl.clear();

    if (open) {
      lock();
      gsap.set(root, { autoAlpha: 1, pointerEvents: "auto" });

      if (reduced) {
        // Reduced motion: no slam, no fall — a quiet fade both ways.
        gsap.set(boards, { xPercent: 0, y: 0, rotation: 0 });
        gsap.set(texts, { y: 0, autoAlpha: 1 });
        tl.fromTo(
          root,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.2, ease: "none" }
        );
      } else {
        // Boards may still be lying at the bottom from the last curtain
        // call — stand them back up before they re-enter from the wings.
        gsap.set(boards, { y: 0, rotation: 0 });
        tl.fromTo(
          boards,
          { xPercent: 101 },
          {
            xPercent: 0,
            duration: 0.7,
            ease: "back.out(1.4)",
            stagger: 0.12,
          },
          0
        ).fromTo(
          texts,
          { y: 26, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 0.7,
            ease: "expo.out",
            stagger: 0.03,
          },
          0.2
        );
      }
      tl.play(0);

      // Focus moves into the dialog immediately so Escape/Tab work even
      // while the boards are still flying in.
      root.querySelector<HTMLElement>("a[href]")?.focus({
        preventScroll: true,
      });
    } else {
      // Closing: boards must not swallow clicks while they fall.
      gsap.set(root, { pointerEvents: "none" });

      if (reduced) {
        tl.to(root, { autoAlpha: 0, duration: 0.2, ease: "none" });
      } else {
        // The curtain-call drop: whole boards tumble off the bottom of the
        // stage with a random tilt, last one first.
        tl.to(
          boards,
          {
            y: "160vh",
            rotation: "random(-15, 15)",
            duration: 0.85,
            ease: "power3.in",
            stagger: { from: "end", each: 0.05 },
          },
          0
        ).set(root, { autoAlpha: 0 });
      }
      tl.add(() => {
        unlock();
        triggerRef.current?.focus({ preventScroll: true });
      });
      tl.play(0);
    }
  }, [open, lock, unlock, triggerRef]);

  // Escape closes; Tab is trapped in a fixed cycle: the five board links,
  // then the header toggle button (still visible above the boards).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = rootRef.current;
      if (!root) return;
      const links = Array.from(root.querySelectorAll<HTMLElement>("a[href]"));
      const trigger = triggerRef.current;
      const cycle = trigger ? [...links, trigger] : links;
      if (cycle.length === 0) return;
      e.preventDefault();
      const idx = cycle.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey
        ? idx <= 0
          ? cycle.length - 1
          : idx - 1
        : idx === -1 || idx === cycle.length - 1
          ? 0
          : idx + 1;
      cycle[next].focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, triggerRef]);

  // Route commit while the layer is up (or mid-fall): reset instantly.
  // RouteTransition's blade already owns the screen at this point — the
  // menu must simply not exist on the incoming page.
  useEffect(() => {
    if (lastPathRef.current === null) {
      lastPathRef.current = pathname;
      return;
    }
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;

    tlRef.current?.clear();
    const root = rootRef.current;
    if (root) gsap.set(root, { autoAlpha: 0, pointerEvents: "none" });
    unlock();
    if (openRef.current) onClose();
  }, [pathname, unlock, onClose]);

  // Whatever happens, an unmount must never leave the page unscrollable.
  useEffect(() => unlock, [unlock]);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("menu")}
      className="invisible pointer-events-none fixed inset-0 z-[70] overflow-hidden opacity-0"
    >
      {/* Board palette: private tokens so no raw colors leak into markup.
          The gradient rides on an opaque --bg base because the matinee
          --surface is translucent white — boards must never see through. */}
      <style>{`
        .fn-board {
          background-color: var(--bg);
          background-image: linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%);
          box-shadow: -14px 0 36px var(--fn-shadow), 0 -10px 30px var(--fn-shadow);
        }
        :root { --fn-shadow: rgba(0, 0, 0, 0.4); }
        :root[data-theme="light"] { --fn-shadow: rgba(33, 28, 49, 0.14); }
      `}</style>
      <nav className="flex h-full w-full flex-col md:flex-row">
        {ITEMS.map((item, i) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <div
              key={item.href}
              // The -mt/-ml pixel overlaps close subpixel seams between
              // adjacent boards (flex rounding lets the page glint through).
              className="fn-board relative -mt-px min-h-0 flex-1 border-t border-line will-change-transform first:mt-0 first:border-t-0 md:-ml-px md:mt-0 md:border-t-0 md:border-l md:first:ml-0 md:first:border-l-0"
            >
              <Link
                href={item.href}
                onClick={() => {
                  // Already on this page: nothing will navigate, so the
                  // click just takes a bow and closes the curtain.
                  if (item.href === pathname) onClose();
                }}
                // First stripe / all columns start below the glass header bar
                // (the header stays visible above the boards for the X button).
                className={`group flex h-full w-full items-center justify-between gap-4 px-7 outline-none focus-visible:-outline-offset-4 focus-visible:outline-2 focus-visible:outline-gold md:flex-col md:items-stretch md:px-6 md:pt-24 md:pb-8 ${
                  i === 0 ? "pt-16" : ""
                }`}
              >
                <span className="fn-text font-mono text-[11px] tracking-[0.3em] text-gold md:self-start">
                  {String(i).padStart(2, "0")}
                </span>
                <span
                  className={`fn-text flex flex-1 items-center justify-center text-center font-deco text-[clamp(1.7rem,7vw,3.4rem)] leading-none transition-[text-shadow,color] duration-300 ${
                    active
                      ? "text-gold [text-shadow:var(--glow-gold)]"
                      : "text-fg group-hover:text-gold group-hover:[text-shadow:var(--glow-gold)]"
                  }`}
                >
                  {t(item.key)}
                </span>
                <span className="fn-text hidden font-mono text-[10px] tracking-[0.22em] text-muted-fg md:block md:self-center md:text-center">
                  {item.note}
                </span>
              </Link>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
