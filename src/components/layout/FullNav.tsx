"use client";

import { Fragment, useCallback, useEffect, useRef, type RefObject } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { gsap, useGSAP } from "@/lib/gsap";
import { attachMembers, isActiveDoor, isActivePath, type NavLink } from "@/lib/nav";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import { site } from "@/config/site";
import { LightSwitch } from "@/components/ui/LightSwitch";
import { LocaleSwitcher } from "./LocaleSwitcher";


export type FullNavProps = {
  /**
   * The menu's links, in order, from the site's one nav table. Named `links`
   * rather than `items` because the open/close effect already binds `items`
   * to the DOM nodes it animates.
   */
  links: NavLink[];
  /** Whether the sheet is shown. Owned by the Header. */
  open: boolean;
  /**
   * Ask the owner to flip `open` to false. Fired on Escape, on clicking the
   * item for the page we are already on, and on route commits.
   */
  onClose: () => void;
  /**
   * The Header's burger button. Focus returns to it when the sheet is
   * dismissed — but never when a navigation closed it, since by then the
   * reader is on the new page. Tab also cycles through it (it stays visible
   * above the glass).
   */
  triggerRef: RefObject<HTMLButtonElement | null>;
};

/**
 * Full-screen glass navigation (mobile-first). A glass-thick shade draws
 * down from the top with a light back.out(1.2) settle while the nav words
 * cascade up; behind it the page recedes (main scale .98 + 2px blur).
 * Two levels: the doors (the rows on the header surface) as the numbered
 * display words, and under each the rows of its group in small type — the
 * rooms under 生活, the craft page under 软件, the 3D intro under 关于 —
 * so a phone gets every page in one press without eleven display rows.
 * Closing is deliberately asymmetric — the whole sheet sinks and dissolves
 * into blur, built from to() tweens so a mid-flight toggle simply takes
 * over from wherever things are (raMQBVQ's clear() + rebuild pattern:
 * entrances are fromTo, exits are to).
 *
 * Scroll is locked while open via the shared contract in lib/scrollLock,
 * unlocking with a ScrollTrigger refresh. On a route commit the layer
 * resets instantly — RouteTransition already owns the screen, so animating
 * here would play to nobody.
 */
export function FullNav({ links, open, onClose, triggerRef }: FullNavProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const lockedRef = useRef(false);
  const openRef = useRef(open);
  const prevOpenRef = useRef(false);
  const lastPathRef = useRef<string | null>(null);
  /** True once a close (or reset) has fully settled — the next open may
   *  safely use fromTo without yanking a mid-flight panel back to the top. */
  const settledClosedRef = useRef(true);
  /** The <main> we actually pushed. Pages own their own <main>, so by the time
   *  a close unwinds, re-querying would hand back the INCOMING page's element:
   *  never pushed, yet stamped with an inline filter/transform that turns it
   *  into the containing block its fixed/sticky children are positioned
   *  against — plus a delayed clearProps landing mid-materialize. */
  const pushedMainRef = useRef<HTMLElement | null>(null);
  /** Set when the close was ordered by a route commit, not by a dismiss. */
  const closedByRouteRef = useRef(false);

  const t = useTranslations("nav");
  const tf = useTranslations("footer");
  const locale = useLocale();
  const pathname = usePathname();

  const lock = useCallback(() => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    lockScroll();
  }, []);

  const unlock = useCallback(() => {
    if (!lockedRef.current) return;
    lockedRef.current = false;
    unlockScroll({ refresh: true });
  }, []);

  /** Push the page back while the sheet is up (scale + blur on <main>). */
  const pushMain = useCallback((show: boolean) => {
    if (show) {
      const main = document.querySelector<HTMLElement>("main");
      if (!main) return;
      pushedMainRef.current = main;
      gsap.to(main, {
        scale: 0.98,
        filter: "blur(2px)",
        transformOrigin: "50% 20%",
        duration: 0.5,
        ease: "power3.out",
        overwrite: "auto",
      });
      return;
    }
    const main = pushedMainRef.current;
    pushedMainRef.current = null;
    // Gone with its page: the styles left with the element, and whatever
    // <main> is on screen now is not ours.
    if (!main?.isConnected) return;
    gsap.to(main, {
      scale: 1,
      filter: "blur(0px)",
      duration: 0.4,
      ease: "power2.out",
      overwrite: "auto",
      // A transformed <main> breaks fixed/sticky descendants — clean up.
      onComplete: () => gsap.set(main, { clearProps: "transform,filter,transformOrigin" }),
    });
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
    // Read on every run, so a verdict can never survive into a later close.
    const byRoute = closedByRouteRef.current;
    closedByRouteRef.current = false;
    const root = rootRef.current;
    const panel = panelRef.current;
    const tl = tlRef.current;
    if (!root || !panel || !tl) return;
    // Initial mount in the closed state: nothing to animate, nothing to lock.
    if (!prevOpenRef.current && !open) return;
    prevOpenRef.current = open;

    const items = gsap.utils.toArray<HTMLElement>(".fn-item", root);

    tl.clear();

    if (open) {
      lock();
      gsap.set(root, { autoAlpha: 1, pointerEvents: "auto" });
      pushMain(true);

      if (settledClosedRef.current) {
        // Fresh open: the shade draws down ("closing time" — the gallery
        // blind), links cascade up behind it.
        tl.fromTo(
          panel,
          { yPercent: -103, y: 0, autoAlpha: 1, filter: "blur(0px)" },
          { yPercent: 0, duration: 0.65, ease: "back.out(1.2)" },
          0
        ).fromTo(
          items,
          { y: 28, autoAlpha: 0 },
          // 0.04, not 0.06: the member rows are items too, and the tail of
          // the cascade should not drag past a second.
          { y: 0, autoAlpha: 1, duration: 0.5, ease: "power3.out", stagger: 0.04 },
          0.18
        );
      } else {
        // Reopened mid-close: recover from current positions — no restart.
        tl.to(
          panel,
          { yPercent: 0, y: 0, autoAlpha: 1, filter: "blur(0px)", duration: 0.35, ease: "power3.out" },
          0
        ).to(
          items,
          { y: 0, autoAlpha: 1, duration: 0.3, ease: "power3.out", stagger: 0.03 },
          0.05
        );
      }
      settledClosedRef.current = false;
      // Focus moves into the dialog as soon as the first word is visible —
      // not before: the items start at autoAlpha 0 (visibility hidden), and
      // focus() on a hidden link is a no-op that would leave focus on the
      // burger outside the aria-modal dialog.
      tl.add(() => root.querySelector<HTMLElement>("a[href]")?.focus({ preventScroll: true }), 0.3);
      tl.play(0);
    } else {
      // A route commit already tore the layer down instantly (see the pathname
      // effect below) and RouteTransition owns the screen from here. Replaying
      // the sink would animate nothing anyone can see, re-dirty the incoming
      // <main>, and — 0.4s after the reader landed on the new page — drag
      // their focus off it and back onto the burger.
      if (byRoute) return;

      // Closing: the sheet must not swallow clicks while it sinks.
      gsap.set(root, { pointerEvents: "none" });
      pushMain(false);

      // The quiet exit: everything sinks together and dissolves into
      // blur — no tumbling scenery in this issue.
      tl.to(
        items,
        { y: 14, autoAlpha: 0, duration: 0.28, ease: "power2.in", stagger: { each: 0.02, from: "end" } },
        0
      ).to(
        panel,
        { y: 48, autoAlpha: 0, filter: "blur(10px)", duration: 0.38, ease: "power2.in" },
        0.05
      );
      tl.add(() => {
        gsap.set(root, { autoAlpha: 0, pointerEvents: "none" });
        gsap.set(panel, { clearProps: "transform,opacity,visibility,filter" });
        settledClosedRef.current = true;
        unlock();
        triggerRef.current?.focus({ preventScroll: true });
      });
      tl.play(0);
    }
  }, [open, lock, unlock, pushMain, triggerRef]);

  // Escape closes; Tab is trapped in a fixed cycle: the sheet's links and
  // controls, then the header burger (still visible above the glass).
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
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")
      );
      const trigger = triggerRef.current;
      const cycle = trigger ? [...focusables, trigger] : focusables;
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
      const target = cycle[next];
      // The nav is its own scroll box now: bring a row folded below the
      // fold into view before focusing it, or the focus ring lands on a
      // link nobody can see. The burger is outside the box — leave it be.
      if (target !== trigger) target.scrollIntoView({ block: "nearest" });
      target.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, triggerRef]);

  // Route commit while the layer is up (or mid-sink): reset instantly.
  // RouteTransition already owns the screen at this point — the sheet must
  // simply not exist on the incoming page.
  useEffect(() => {
    if (lastPathRef.current === null) {
      lastPathRef.current = pathname;
      return;
    }
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;

    tlRef.current?.clear();
    const root = rootRef.current;
    const panel = panelRef.current;
    if (root) gsap.set(root, { autoAlpha: 0, pointerEvents: "none" });
    if (panel) gsap.set(panel, { clearProps: "transform,opacity,visibility,filter" });
    // Only the <main> we pushed gets reset. The one on screen now belongs to
    // the incoming page and is RouteTransition's to animate; if the outgoing
    // one is already detached there is nothing left to clean.
    const pushedMain = pushedMainRef.current;
    pushedMainRef.current = null;
    if (pushedMain?.isConnected)
      gsap.set(pushedMain, { clearProps: "transform,filter,transformOrigin" });
    settledClosedRef.current = true;
    unlock();
    if (openRef.current) {
      // Tell the close path this was a navigation: no exit animation, and no
      // focus handoff back to the burger.
      closedByRouteRef.current = true;
      onClose();
    }
  }, [pathname, unlock, onClose]);

  // Whatever happens, an unmount must never leave the page unscrollable.
  useEffect(() => unlock, [unlock]);

  return (
    <div
      ref={rootRef}
      id="fullnav"
      role="dialog"
      aria-modal="true"
      aria-label={t("menu")}
      className="invisible pointer-events-none fixed inset-0 z-[70] overflow-hidden opacity-0"
    >
      {/* The shade: one full-bleed glass-thick surface (its blur is the
          scrim). Border/radius zeroed — a sheet, not a card. */}
      <div
        ref={panelRef}
        className="glass-thick absolute inset-0 flex flex-col rounded-none border-0 will-change-transform"
      >
        {/* The visible toggle lives in the island, outside this dialog — and
            aria-modal hides everything outside it. Without a close control in
            here, a screen reader user has no way out but Escape. */}
        <button
          type="button"
          onClick={onClose}
          className="liquid-chip absolute left-1/2 top-6 z-10 -translate-x-1/2 rounded-chip px-4 py-2 font-mono text-meta uppercase tracking-meta text-fg-secondary opacity-0 focus-visible:opacity-100"
        >
          {t("close")}
        </button>

        {/* min-h-0 + overflow: the sheet's own scroll, for a short phone —
            body scrolling is locked while the sheet is up, and the stopped
            Lenis would swallow the wheel too without `data-lenis-prevent`
            (the repo's contract, see IntroResume). `safe` centring: a list
            taller than the sheet starts at the top instead of losing its
            first rows above the fold; scroll-padding keeps a row that Tab
            scrolls up from stopping under the island. */}
        <nav
          aria-label={t("ariaLabel")}
          data-lenis-prevent
          className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col justify-center-safe gap-1 overflow-y-auto overscroll-contain scroll-pt-20 px-8 pt-20"
        >
          {attachMembers(links).map(({ door, members }, i) => {
            // A door lights for its own pages and for the rooms behind it;
            // the room itself lights in the small row, so both show. Same
            // aria-current rule as the island: "page" here, "true" for the
            // door of the room the reader is in.
            const here = isActivePath(pathname, door.href);
            const active = isActiveDoor(pathname, door, members);
            const doorId = `fn-door-${i}`;
            return (
              <Fragment key={door.href}>
                <Link
                  href={door.href}
                  aria-current={here ? "page" : active ? "true" : undefined}
                  onClick={() => {
                    // Already on this page: nothing will navigate, so the
                    // click just lowers the shade again.
                    if (door.href === pathname) onClose();
                  }}
                  className="fn-item group flex min-h-11 w-full items-baseline gap-4 py-1"
                >
                  <span className="font-mono text-[11px] tracking-meta text-fg-tertiary">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    id={doorId}
                    className={`text-display-sm transition-colors ${
                      active ? "text-accent" : "text-fg group-hover:text-accent"
                    }`}
                  >
                    {t(door.labelKey)}
                  </span>
                </Link>
                {members.length > 0 && (
                  <ul
                    // Named after its door — these are the pages behind
                    // 生活, not the whole 房间 wing.
                    aria-labelledby={doorId}
                    className="fn-item -mt-1 mb-1 flex flex-wrap gap-x-4 gap-y-0 pl-8"
                  >
                    {members.map((member) => {
                      const current = isActivePath(pathname, member.href);
                      return (
                        <li key={member.href}>
                          <Link
                            href={member.href}
                            aria-current={current ? "page" : undefined}
                            onClick={() => {
                              if (member.href === pathname) onClose();
                            }}
                            className={`hit-ext inline-flex min-h-8 items-center py-1 text-caption transition-colors ${
                              current ? "text-accent" : "text-fg-secondary hover:text-accent"
                            }`}
                          >
                            {t(member.labelKey)}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Fragment>
            );
          })}
        </nav>

        {/* Secondary row: quiet mono links. RSS is a file route, so it must
            bypass both the i18n Link and the route transition. */}
        <div className="fn-item mx-auto flex w-full max-w-xl items-center gap-6 px-8 pb-5">
          <a
            href={`/${locale}/rss.xml`}
            data-no-transition=""
            className="hit-ext font-mono text-meta uppercase text-fg-secondary transition-colors hover:text-fg"
          >
            {tf("rss")}
          </a>
          <a
            href={site.social.github}
            target="_blank"
            rel="noopener noreferrer"
            className="hit-ext font-mono text-meta uppercase text-fg-secondary transition-colors hover:text-fg"
          >
            GitHub
          </a>
        </div>

        {/* Utility row: language + the lights. */}
        <div className="fn-item mx-auto flex w-full max-w-xl items-center justify-between px-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <LocaleSwitcher />
          <LightSwitch />
        </div>
      </div>
    </div>
  );
}


