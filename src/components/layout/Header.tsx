"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { site } from "@/config/site";
import { gsap, useGSAP, Flip } from "@/lib/gsap";
import { attachMembers, isActiveDoor, isActivePath, type NavLink } from "@/lib/nav";
import { useJukebox } from "@/lib/jukebox";
import { LightSwitch } from "@/components/ui/LightSwitch";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { GlintDefs, GlintRing } from "@/components/fx/SpecularGlint";
import { JukeboxSwitch } from "@/components/fx/JukeboxSwitch";
import { SignRing } from "@/components/neon/SignRing";
import { FullNav } from "./FullNav";

type Props = {
  /** The desktop row's links: the doors. */
  links: NavLink[];
  /** The full-screen menu's links — a longer list, home and the rooms
   *  included. */
  menuLinks: NavLink[];
  /** The whole table, so the tray knows which pages hang under which door
   *  and 生活 lights while the reader is in a room — whatever surfaces the
   *  room is ticked for. */
  allLinks: NavLink[];
};

/** Hamburger line geometry: three resting rows and the two X diagonals. */
const LINES = [
  { rest: { x1: 3, y1: 6.5, x2: 21, y2: 6.5 }, cross: { x1: 5, y1: 5, x2: 19, y2: 19 } },
  { rest: { x1: 3, y1: 12, x2: 21, y2: 12 }, cross: null },
  { rest: { x1: 3, y1: 17.5, x2: 21, y2: 17.5 }, cross: { x1: 5, y1: 19, x2: 19, y2: 5 } },
] as const;

/** Desktop = the island expands inline; below this the burger opens FullNav. */
const DESKTOP = "(min-width: 768px)";

/**
 * From here up the island stands open by itself: the doors are on the page
 * without a press. A site whose whole map sits behind a burger has no map —
 * this was the one thing every "simple" personal site did that this one did
 * not. Narrower desktops keep the press: between 768 and 1023px an open
 * island and the page's own layout start competing for the same width.
 */
const WIDE = "(min-width: 1024px)";
/** Scroll travel that folds the open island (down) or unfolds it (up). */
const FOLD_TRAVEL = 48;
/** Above this scroll position the island is always open on a wide screen. */
const FOLD_TOP = 64;

/** Hamburger ⇄ X morph, in seconds. */
const GLYPH_DURATION = 0.35;

/**
 * Edge glint geometry. The light parks just *outside* the top rim and rides
 * low over the surface, and only its x follows the pointer.
 *
 * fePointLight has no distance falloff — all a point on the ring gets to
 * decide by is the angle between the light and its own surface normal. On the
 * long flat runs that normal tilts straight out of the capsule, so a light
 * placed inside it (the old y, which tracked the pointer) leaves the top and
 * bottom edges facing away from their own light: they never lit at all, and
 * the only thing that ever caught anything was the pair of end caps, whose
 * normals splay sideways. That is the "two brackets blinking" the effect used
 * to read as. Lighting from above the edge instead gives one hotspot that
 * slides along the whole rim, which is the torch the design asks for.
 */
const GLINT = { y: -8, z: 14, exponent: 20 } as const;

/**
 * The dynamic-island masthead (after the JoRMPLg pattern): a floating
 * glass-thick capsule, top center. Collapsed it holds only the wordmark and
 * the burger; on desktop a click stretches it open with back.out(2) and the
 * tray reveals the nav table's header links, the zh/en toggle and the light
 * switch.
 * Closing rides the same timeline backwards at 2.5x, with per-tween
 * easeReverse (GSAP 3.15) so the exit is crisp power easing, never a
 * replayed bounce. On mobile the burger opens the FullNav sheet instead.
 *
 * Extras per spec: a cursor-following fePointLight glint on the capsule
 * edge, a Flip-translated capsule
 * indicator under the aria-current page, and a scroll-edge scrim that fades
 * in under the island once the page scrolls (mask-image gradient).
 */
export function Header({ links, menuLinks, allLinks }: Props) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const locale = useLocale();
  /** The ring around the wordmark lights with the music, like the note. */
  const { wanted } = useJukebox();
  /** Which rows hang under each door — by group, off the whole table. */
  const membersOf = new Map(attachMembers(allLinks).map((b) => [b.door.href, b.members]));

  /** Desktop island tray expanded. */
  const [expanded, setExpanded] = useState(false);
  /** Mobile full-screen nav sheet. */
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const rootRef = useRef<HTMLElement>(null);
  const islandRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const navRowRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const lightRef = useRef<SVGFEPointLightElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const expandedRef = useRef(false);
  /** The next open lands at its end state without playing — the wide
   *  screen's default open, on mount and when the viewport widens into it. */
  const instantRef = useRef(false);
  /** Escape closed the tray: hand focus to the burger once it is back. */
  const returnFocusRef = useRef(false);

  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  /**
   * Slide the capsule indicator under the aria-current link. Flip.fit
   * translates + resizes it from wherever it currently sits — the "island
   * remembers which page you are on" moment.
   */
  const fitIndicator = useCallback((instant: boolean) => {
    const nav = navRowRef.current;
    const ind = indicatorRef.current;
    if (!nav || !ind) return;
    // "page" on the page's own door, "true" on the door of the room the
    // reader is in — the capsule sits under either.
    const active = nav.querySelector<HTMLElement>("a[aria-current]");
    if (!active) {
      gsap.to(ind, { autoAlpha: 0, duration: 0.15, overwrite: "auto" });
      return;
    }
    if (instant) {
      Flip.fit(ind, active, { scale: false });
      gsap.set(ind, { autoAlpha: 1 });
    } else {
      Flip.fit(ind, active, { scale: false, duration: 0.45, ease: "power3.out" });
      gsap.to(ind, { autoAlpha: 1, duration: 0.2, overwrite: "auto" });
    }
  }, []);

  /**
   * Build the open timeline fresh each time the island opens from rest:
   * the tray's natural width depends on the locale's labels, so it is
   * measured on the spot (and clamped so a narrow desktop keeps the capsule
   * inside the viewport). One paused timeline serves both directions —
   * play() to open, timeScale(2.5).reverse() to close, with easeReverse
   * swapping the bouncy entrance eases for crisp power exits.
   */
  const buildOpenTimeline = useCallback(() => {
    const island = islandRef.current;
    const tray = trayRef.current;
    const ind = indicatorRef.current;
    const burger = burgerRef.current;
    if (!island || !tray) return null;

    // A rebuild can start with the burger already folded away (a locale
    // switch while open, below); it must be measured and tweened from rest,
    // or the reverse would "restore" it to nothing.
    if (burger) gsap.set(burger, { clearProps: "width,opacity,visibility" });
    gsap.set(tray, { visibility: "visible", width: "auto" });
    const trayW = Math.ceil(tray.getBoundingClientRect().width);
    const baseW = Math.ceil(island.getBoundingClientRect().width) - trayW;
    const w = Math.min(trayW, Math.max(120, window.innerWidth - 32 - baseW));
    gsap.set(tray, { width: 0 });

    const items = gsap.utils.toArray<HTMLElement>(".isl-item", tray);
    gsap.set(items, { autoAlpha: 0, y: 6 });
    if (ind) gsap.set(ind, { autoAlpha: 0 });

    const tl = gsap.timeline({
      paused: true,
      onComplete: () => fitIndicator(true),
      onReverseComplete: () => {
        gsap.set(tray, { visibility: "hidden" });
        if (ind) gsap.set(ind, { autoAlpha: 0 });
        if (burger) {
          gsap.set(burger, { clearProps: "width,opacity,visibility" });
          if (returnFocusRef.current) {
            returnFocusRef.current = false;
            burger.focus({ preventScroll: true });
          }
        }
      },
    });
    tl.to(
      tray,
      { width: w, duration: 0.8, ease: "back.out(2)", easeReverse: "power2.out" },
      0
    ).to(
      items,
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.3,
        ease: "power2.out",
        easeReverse: "power1.out",
        stagger: 0.05,
      },
      0.14
    );
    // On a wide screen the open island has no X. The doors are simply there,
    // and a close control at rest would ask "close what?" — so the burger
    // folds away with the open and is back the moment the island folds.
    if (burger && window.matchMedia(WIDE).matches) {
      tl.to(
        burger,
        { width: 0, autoAlpha: 0, duration: 0.3, ease: "power2.out", easeReverse: "power1.out" },
        0
      );
    }
    return tl;
  }, [fitIndicator]);

  /**
   * Re-measure an open tray in place: rebuild the timeline at its settled
   * end state with fresh label widths (and, on a wide screen, the burger
   * folded), so the next close still reverses cleanly and nothing is clipped.
   */
  const refit = useCallback(() => {
    if (!expandedRef.current) return;
    tlRef.current?.kill();
    const rebuilt = buildOpenTimeline();
    tlRef.current = rebuilt;
    rebuilt?.progress(1);
    fitIndicator(true);
  }, [buildOpenTimeline, fitIndicator]);

  // Open/close choreography. Mid-flight toggles reuse the live timeline so
  // the capsule reverses from wherever it is — it never jumps.
  useGSAP(
    () => {
      const tray = trayRef.current;
      if (!tray) return;

      if (expanded) {
        const tl = tlRef.current;
        if (tl && tl.progress() > 0) {
          tl.timeScale(1).play();
          return;
        }
        tl?.kill();
        const fresh = buildOpenTimeline();
        tlRef.current = fresh;
        if (instantRef.current) {
          // The wide screen's own open: already there, not arriving.
          instantRef.current = false;
          fresh?.progress(1);
        } else {
          fresh?.timeScale(1).play(0);
        }
      } else {
        const tl = tlRef.current;
        if (!tl || tl.progress() === 0) return;
        if (indicatorRef.current) {
          gsap.to(indicatorRef.current, { autoAlpha: 0, duration: 0.12, overwrite: "auto" });
        }
        tl.timeScale(2.5).reverse();
      }
    },
    { dependencies: [expanded], scope: rootRef }
  );

  // Hamburger ⇄ X: tween the SVG line endpoint *attributes* into the
  // diagonals (not transforms) so the stroke caps stay crisp at every angle.
  const glyphOpen = expanded || navOpen;
  useGSAP(
    () => {
      const [l1, l2, l3] = lineRefs.current;
      if (!l1 || !l2 || !l3) return;
      const ease = "power2.inOut";
      const [top, bottom] = glyphOpen
        ? [LINES[0].cross, LINES[2].cross]
        : [LINES[0].rest, LINES[2].rest];
      gsap.to(l1, { attr: top, duration: GLYPH_DURATION, ease, overwrite: "auto" });
      gsap.to(l3, { attr: bottom, duration: GLYPH_DURATION, ease, overwrite: "auto" });
      // The middle line only fades, and it leaves quicker than it comes back.
      gsap.to(l2, {
        opacity: glyphOpen ? 0 : 1,
        duration: GLYPH_DURATION * (glyphOpen ? 0.55 : 1),
        ease,
        overwrite: "auto",
      });
    },
    { dependencies: [glyphOpen], scope: rootRef }
  );

  // Cursor-following specular glint: a fePointLight rides the pointer and
  // lights up the thin white ring hugging the capsule edge ("a torch swept
  // across the glass"). Fine pointers only — a touch device keeps the static
  // glass border and never attaches a listener.
  useGSAP(
    () => {
      const island = islandRef.current;
      const ring = ringRef.current;
      const light = lightRef.current;
      if (!island || !ring || !light) return;

      const mm = gsap.matchMedia();
      mm.add(
        "(hover: hover) and (pointer: fine)",
        () => {
          // One tween reused for every move, rather than a fresh gsap.to per
          // pointermove event. quickTo cannot address `attr.x` directly, so it
          // drives a plain object and writes the attribute on update.
          const pos = { x: -200 };
          const xTo = gsap.quickTo(pos, "x", {
            duration: 0.25,
            ease: "power2.out",
            onUpdate: () => light.setAttribute("x", String(pos.x)),
          });
          // Event-driven read; fePointLight's x lives in the ring's own user
          // space, so the island rect maps clientX directly. y stays at
          // GLINT.y — see the constant.
          const localX = (e: PointerEvent) =>
            e.clientX - island.getBoundingClientRect().left;

          const onEnter = (e: PointerEvent) => {
            // Land lit under the pointer. Easing in from wherever the last
            // exit left the light is what made the glint swipe across the
            // capsule on every re-entry.
            pos.x = localX(e);
            light.setAttribute("x", String(pos.x));
            gsap.to(ring, { opacity: 1, duration: 0.25, ease: "power2.out", overwrite: "auto" });
          };
          const onMove = (e: PointerEvent) => xTo(localX(e));
          const onLeave = () => {
            gsap.to(ring, { opacity: 0, duration: 0.5, ease: "power2.out", overwrite: "auto" });
          };
          island.addEventListener("pointerenter", onEnter);
          island.addEventListener("pointermove", onMove);
          island.addEventListener("pointerleave", onLeave);
          return () => {
            island.removeEventListener("pointerenter", onEnter);
            island.removeEventListener("pointermove", onMove);
            island.removeEventListener("pointerleave", onLeave);
          };
        }
      );
      return () => mm.revert();
    },
    { scope: rootRef }
  );

  // Scroll-edge: once the page scrolls, a paper gradient fades in under the
  // island so content dissolves before sliding beneath it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Escape closes the tray and hands focus back; a click anywhere off the
  // island collapses it (it is a toolbar, not a modal — no focus trap).
  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setExpanded(false);
      // On a wide screen the burger is folded away while the tray is open
      // and focus() on a hidden button is a no-op; the close timeline hands
      // focus over once it is back.
      returnFocusRef.current = true;
      burgerRef.current?.focus({ preventScroll: true });
    };
    const onPointerDown = (e: PointerEvent) => {
      if (islandRef.current?.contains(e.target as Node)) return;
      // A pointer closed it: the pointer is where focus should stay.
      returnFocusRef.current = false;
      setExpanded(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [expanded]);

  // Crossing the breakpoint closes whichever menu belongs to the other side.
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const onChange = () => {
      if (mq.matches) setNavOpen(false);
      else setExpanded(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // On a wide screen the island stands open by itself. Scrolling down folds
  // it back to the wordmark — the page is being read and the island is
  // chrome — and scrolling up unfolds it; near the top it is always open.
  // The fold only ever reacts to travel, never to position alone, so a
  // reader who pressed it shut stays shut until they scroll back up, and a
  // long page never flickers around a threshold.
  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    let lastY = window.scrollY;
    let travel = 0;
    const settle = () => {
      if (!mq.matches) return;
      if (window.scrollY < FOLD_TOP && !expandedRef.current) {
        instantRef.current = true;
        setExpanded(true);
      }
    };
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      if (!mq.matches) return;
      if (y < FOLD_TOP) {
        travel = 0;
        if (!expandedRef.current) setExpanded(true);
        return;
      }
      travel = Math.sign(dy) === Math.sign(travel) ? travel + dy : dy;
      if (travel > FOLD_TRAVEL && expandedRef.current) {
        travel = 0;
        // Not out from under a keyboard reader: the keys that scroll the page
        // are pressed while the focus sits on a door in the tray, and folding
        // sets the tray `visibility: hidden` — which cannot hold focus, so it
        // would drop to the body mid-read. The island stays open until they
        // tab out of it, the same courtesy the pressed-shut island gets.
        if (!trayRef.current?.contains(document.activeElement)) setExpanded(false);
      } else if (travel < -FOLD_TRAVEL && !expandedRef.current) {
        travel = 0;
        setExpanded(true);
      }
    };
    const onChange = () => {
      if (!mq.matches) {
        setExpanded(false);
        return;
      }
      // Widened into wide with the tray already open (pressed open on a
      // narrower desktop): its timeline was built without the burger's fold
      // and measured for the old width — rebuild it in place.
      if (expandedRef.current) refit();
      else settle();
    };
    settle();
    window.addEventListener("scroll", onScroll, { passive: true });
    mq.addEventListener("change", onChange);
    return () => {
      window.removeEventListener("scroll", onScroll);
      mq.removeEventListener("change", onChange);
    };
  }, [refit]);

  // Route change while the tray is open (browser Back, etc.): the capsule
  // indicator Flips across to the new aria-current link.
  useEffect(() => {
    if (expandedRef.current) fitIndicator(false);
  }, [pathname, fitIndicator]);

  // Locale switch changes every label width.
  useEffect(refit, [locale, refit]);

  // So does the web fonts' arrival: the wide screen's default open measures
  // the tray at mount, which can be before Yozai and Geist Mono have landed,
  // and a width taken in the fallback faces can clip the last item by a few
  // pixels once the real ones swap in. Effects run once more than they need
  // to on a locale switch; a rebuild at progress(1) is invisible.
  useEffect(() => {
    let live = true;
    document.fonts.ready.then(() => {
      if (live) refit();
    });
    return () => {
      live = false;
    };
  }, [refit]);

  const onBurger = () => {
    if (window.matchMedia(DESKTOP).matches) setExpanded((v) => !v);
    else setNavOpen((v) => !v);
  };

  return (
    <>
      <header ref={rootRef} className="pointer-events-none fixed inset-x-0 top-0 z-[80]">
        {/* Specular-lighting filter for the edge glint. */}
        <GlintDefs
          id="isl-glint"
          exponent={GLINT.exponent}
          x={-200}
          y={GLINT.y}
          z={GLINT.z}
          lightRef={lightRef}
        />

        {/* Scroll-edge scrim: paper gradient + mask so content fades out
            before it slides under the island. Hidden while FullNav owns
            the screen. */}
        <div
          aria-hidden="true"
          className={`hd-scrim absolute inset-x-0 top-0 h-24 transition-opacity duration-500 ${
            scrolled && !navOpen ? "opacity-100" : "opacity-0"
          }`}
          style={{
            background:
              "linear-gradient(to bottom, var(--bg) 0%, color-mix(in srgb, var(--bg) 65%, transparent) 55%, transparent 100%)",
            maskImage: "linear-gradient(to bottom, black 30%, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, black 30%, transparent)",
          }}
        />

        <div className="relative flex justify-center px-4 pt-[max(0.875rem,env(safe-area-inset-top))]">
          <div
            ref={islandRef}
            // While FullNav (also glass-thick) is up, the island "melts" into
            // it — glass must never stack on glass, so the capsule surface
            // goes transparent and only the wordmark + X remain.
            className={`glass-thick pointer-events-auto relative flex items-center rounded-full py-1 pr-1 pl-1.5 transition-[background-color,border-color,box-shadow] duration-300 ${
              navOpen
                ? "border-transparent bg-transparent shadow-none [-webkit-backdrop-filter:none] [backdrop-filter:none]"
                : ""
            }`}
          >
            {/* Glint ring: lit by the fePointLight, invisible at rest. */}
            <GlintRing
              filterId="isl-glint"
              className="rounded-full"
              ringRef={ringRef}
            />

            {/* Wordmark badge: the name inside the ring off the sign, with
                the note beside it as the music's switch — the island wears
                the sign's parts. The ring lights with the note. */}
            <Link
              href="/"
              aria-label={site.signName}
              className="hit-ext relative z-[1] flex h-11 items-center rounded-full px-1"
            >
              <SignRing id="isl" lit={wanted} className="size-9 text-fg">
                <span className="font-mono text-[12px] font-semibold lowercase tracking-[0.02em] text-fg">
                  {site.signName}
                </span>
              </SignRing>
            </Link>

            {/* Tray: width-animated between the wordmark and the burger.
                w-max on the inner row keeps its natural width while the
                tray clips it during the stretch. */}
            <div
              ref={trayRef}
              id="island-tray"
              className="overflow-hidden"
              style={{ width: 0, visibility: "hidden" }}
            >
              <div className="flex w-max items-center whitespace-nowrap pl-0.5">
                <nav
                  ref={navRowRef}
                  aria-label={t("ariaLabel")}
                  className="relative flex items-center"
                >
                  {/* Flip-translated capsule under the aria-current page. */}
                  <span
                    ref={indicatorRef}
                    aria-hidden="true"
                    className="invisible absolute top-0 left-0 rounded-full bg-fg/[0.05] opacity-0 dark:bg-white/10"
                  />
                  {links.map((item) => {
                    const active = isActiveDoor(pathname, item, membersOf.get(item.href) ?? []);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={
                          isActivePath(pathname, item.href) ? "page" : active ? "true" : undefined
                        }
                        // Collapse first, then RouteTransition takes over.
                        onClick={() => setExpanded(false)}
                        className={`isl-item relative z-[1] rounded-full px-2.5 py-2 text-[13px] font-medium tracking-[0.01em] transition-colors ${
                          active ? "text-accent" : "text-fg-secondary hover:text-fg"
                        }`}
                      >
                        {t(item.labelKey)}
                      </Link>
                    );
                  })}
                </nav>
                <span className="isl-item mx-1.5 h-4 w-px bg-line" aria-hidden="true" />
                <LocaleSwitcher className="isl-item relative z-[1]" />
                <LightSwitch className="isl-item relative z-[1]" />
              </div>
            </div>

            {/* The note off the front door's sign: the background music's
                switch, in the island's collapsed state on every page. */}
            <JukeboxSwitch className="relative z-[1]" />

            <button
              ref={burgerRef}
              type="button"
              onClick={onBurger}
              aria-label={glyphOpen ? t("close") : t("menu")}
              aria-expanded={glyphOpen}
              aria-controls="island-tray fullnav"
              className="relative z-[1] grid size-11 cursor-pointer place-items-center rounded-full text-fg-secondary transition-colors hover:text-fg"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-[18px] w-[18px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden="true"
              >
                {LINES.map((line, i) => (
                  <line
                    key={i}
                    ref={(el) => {
                      lineRefs.current[i] = el;
                    }}
                    x1={line.rest.x1}
                    y1={line.rest.y1}
                    x2={line.rest.x2}
                    y2={line.rest.y2}
                  />
                ))}
              </svg>
            </button>
          </div>
        </div>
      </header>

      <FullNav links={menuLinks} open={navOpen} onClose={() => setNavOpen(false)} triggerRef={burgerRef} />
    </>
  );
}
