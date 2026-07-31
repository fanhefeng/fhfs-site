"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { site } from "@/config/site";
import { gsap, useGSAP, Flip } from "@/lib/gsap";
import { LightSwitch } from "@/components/ui/LightSwitch";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { FullNav } from "./FullNav";

const NAV_ITEMS = [
  { href: "/blog", key: "blog" },
  { href: "/about", key: "about" },
  { href: "/portfolio", key: "portfolio" },
  { href: "/software", key: "software" },
] as const;

/** Hamburger line geometry: three resting rows and the two X diagonals. */
const LINES = [
  { rest: { x1: 3, y1: 6.5, x2: 21, y2: 6.5 }, cross: { x1: 5, y1: 5, x2: 19, y2: 19 } },
  { rest: { x1: 3, y1: 12, x2: 21, y2: 12 }, cross: null },
  { rest: { x1: 3, y1: 17.5, x2: 21, y2: 17.5 }, cross: { x1: 5, y1: 19, x2: 19, y2: 5 } },
] as const;

/** Desktop = the island expands inline; below this the burger opens FullNav. */
const DESKTOP = "(min-width: 768px)";
const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * The dynamic-island masthead (after the JoRMPLg pattern): a floating
 * glass-thick capsule, top center. Collapsed it holds only the wordmark and
 * the burger; on desktop a click stretches it open with back.out(2) and the
 * tray reveals the four nav links, the zh/en toggle and the light switch.
 * Closing rides the same timeline backwards at 2.5x, with per-tween
 * easeReverse (GSAP 3.15) so the exit is crisp power easing, never a
 * replayed bounce. On mobile the burger opens the FullNav sheet instead.
 *
 * Extras per spec: a cursor-following fePointLight glint on the capsule
 * edge (static border under reduced motion), a Flip-translated capsule
 * indicator under the aria-current page, and a scroll-edge scrim that fades
 * in under the island once the page scrolls (mask-image gradient).
 */
export function Header() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const locale = useLocale();

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
    const active = nav.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!active) {
      gsap.to(ind, { autoAlpha: 0, duration: 0.15, overwrite: "auto" });
      return;
    }
    if (instant || window.matchMedia(REDUCED).matches) {
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
    if (!island || !tray) return null;

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
    return tl;
  }, [fitIndicator]);

  // Open/close choreography. Mid-flight toggles reuse the live timeline so
  // the capsule reverses from wherever it is — it never jumps.
  useGSAP(
    () => {
      const tray = trayRef.current;
      if (!tray) return;

      if (expanded) {
        if (window.matchMedia(REDUCED).matches) {
          gsap.set(tray, { visibility: "visible", width: "auto" });
          gsap.set(gsap.utils.toArray<HTMLElement>(".isl-item", tray), {
            autoAlpha: 1,
            y: 0,
          });
          fitIndicator(true);
          return;
        }
        const tl = tlRef.current;
        if (tl && tl.progress() > 0) {
          tl.timeScale(1).play();
          return;
        }
        tl?.kill();
        const fresh = buildOpenTimeline();
        tlRef.current = fresh;
        fresh?.timeScale(1).play(0);
      } else {
        if (window.matchMedia(REDUCED).matches) {
          gsap.set(tray, { width: 0, visibility: "hidden" });
          if (indicatorRef.current) gsap.set(indicatorRef.current, { autoAlpha: 0 });
          return;
        }
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
      const d = window.matchMedia(REDUCED).matches ? 0 : 0.35;
      const ease = "power2.inOut";
      if (glyphOpen) {
        gsap.to(l1, { attr: LINES[0].cross, duration: d, ease, overwrite: "auto" });
        gsap.to(l2, { opacity: 0, duration: d * 0.55, ease, overwrite: "auto" });
        gsap.to(l3, { attr: LINES[2].cross, duration: d, ease, overwrite: "auto" });
      } else {
        gsap.to(l1, { attr: LINES[0].rest, duration: d, ease, overwrite: "auto" });
        gsap.to(l2, { opacity: 1, duration: d, ease, overwrite: "auto" });
        gsap.to(l3, { attr: LINES[2].rest, duration: d, ease, overwrite: "auto" });
      }
    },
    { dependencies: [glyphOpen], scope: rootRef }
  );

  // Cursor-following specular glint: a fePointLight rides the pointer and
  // lights up the thin white ring hugging the capsule edge ("a torch swept
  // across the glass"). Fine pointers only; reduced motion keeps the static
  // glass border and never attaches a listener.
  useGSAP(
    () => {
      const island = islandRef.current;
      const ring = ringRef.current;
      const light = lightRef.current;
      if (!island || !ring || !light) return;

      const mm = gsap.matchMedia();
      mm.add(
        "(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)",
        () => {
          const onMove = (e: PointerEvent) => {
            // Event-driven read; fePointLight x/y live in the ring's own
            // user space, so the island rect maps clientX/Y directly.
            const r = island.getBoundingClientRect();
            gsap.to(light, {
              attr: { x: e.clientX - r.left, y: e.clientY - r.top },
              duration: 0.25,
              ease: "power2.out",
              overwrite: "auto",
            });
            gsap.to(ring, { opacity: 1, duration: 0.25, ease: "power2.out", overwrite: "auto" });
          };
          const onLeave = () => {
            gsap.to(ring, { opacity: 0, duration: 0.5, ease: "power2.out", overwrite: "auto" });
          };
          island.addEventListener("pointermove", onMove);
          island.addEventListener("pointerleave", onLeave);
          return () => {
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
      burgerRef.current?.focus({ preventScroll: true });
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!islandRef.current?.contains(e.target as Node)) setExpanded(false);
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

  // Route change while the tray is open (browser Back, etc.): the capsule
  // indicator Flips across to the new aria-current link.
  useEffect(() => {
    if (expandedRef.current) fitIndicator(false);
  }, [pathname, fitIndicator]);

  // Locale switch changes every label width; if the tray is open, rebuild
  // the timeline at its settled end state with fresh measurements so the
  // next close still reverses cleanly.
  useEffect(() => {
    if (!expandedRef.current) return;
    tlRef.current?.kill();
    const rebuilt = buildOpenTimeline();
    tlRef.current = rebuilt;
    rebuilt?.progress(1);
    fitIndicator(true);
  }, [locale, buildOpenTimeline, fitIndicator]);

  const onBurger = () => {
    if (window.matchMedia(DESKTOP).matches) setExpanded((v) => !v);
    else setNavOpen((v) => !v);
  };

  return (
    <>
      <header ref={rootRef} className="pointer-events-none fixed inset-x-0 top-0 z-[80]">
        {/* Specular-lighting filter for the edge glint (A1: feSpecularLighting
            + fePointLight, composited into the ring's own alpha). */}
        <svg aria-hidden="true" focusable="false" className="absolute h-0 w-0">
          <defs>
            <filter id="isl-glint" x="-20%" y="-20%" width="140%" height="140%">
              <feSpecularLighting
                in="SourceAlpha"
                surfaceScale={1.4}
                specularConstant={1.1}
                specularExponent={36}
                lightingColor="#ffe9cf"
                result="spec"
              >
                <fePointLight ref={lightRef} x={-200} y={-200} z={70} />
              </feSpecularLighting>
              <feComposite in="spec" in2="SourceAlpha" operator="in" />
            </filter>
          </defs>
        </svg>

        {/* Scroll-edge scrim: paper gradient + mask so content fades out
            before it slides under the island. Hidden while FullNav owns
            the screen. */}
        <div
          aria-hidden="true"
          className={`absolute inset-x-0 top-0 h-24 transition-opacity duration-500 ${
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
            <span
              ref={ringRef}
              aria-hidden="true"
              className="pointer-events-none absolute -inset-px rounded-full opacity-0"
              style={{
                border: "1.5px solid rgba(255,255,255,0.9)",
                filter: "url(#isl-glint)",
              }}
            />

            {/* Wordmark badge. data-flip-id is the landing target for the
                home hero's shared logo morph (Flip, home page only). */}
            <Link
              href="/"
              aria-label={site.signName}
              data-flip-id="masthead-logo"
              className="hit-ext relative z-[1] flex h-11 items-center rounded-full px-2.5 font-mono text-[13px] font-semibold lowercase tracking-[0.02em] text-fg"
            >
              {site.signName}
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
                  {NAV_ITEMS.map((item) => {
                    const active = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        // Collapse first, then RouteTransition takes over.
                        onClick={() => setExpanded(false)}
                        className={`isl-item relative z-[1] rounded-full px-2.5 py-2 text-[13px] font-medium tracking-[0.01em] transition-colors ${
                          active ? "text-accent" : "text-fg-secondary hover:text-fg"
                        }`}
                      >
                        {t(item.key)}
                      </Link>
                    );
                  })}
                </nav>
                <span className="isl-item mx-1.5 h-4 w-px bg-line" aria-hidden="true" />
                <LocaleSwitcher className="isl-item relative z-[1]" />
                <LightSwitch className="isl-item relative z-[1]" />
              </div>
            </div>

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

      <FullNav open={navOpen} onClose={() => setNavOpen(false)} triggerRef={burgerRef} />
    </>
  );
}

export default Header;
