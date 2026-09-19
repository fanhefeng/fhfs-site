"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { gsap, useGSAP, EASE, prefersReducedMotion } from "@/lib/gsap";
import { toggleTheme } from "@/lib/theme";

/** Quarter-circle sweep: 180° (due left) → 270° (straight up). */
const START_ANGLE = 180;
const END_ANGLE = 270;
const RADIUS = 104;

type Action = { key: string; label: string; onClick?: () => void; href?: string };

/**
 * Quick-actions FAB for article pages, mobile only (the dynamic island covers
 * the same ground on desktop, and two menus competing is worse than none).
 *
 * Four glass buttons (three where there is no feed to offer) fan out along a 90° arc with `elastic.out(1, 0.5)` and a
 * 0.05s stagger — the demo-verified polar layout — while the "+" rotates 135°
 * into a "×". Closing reverses the same timeline with a firm `easeReverse`
 * ease at 2.2× speed: entrances may be showy, exits are crisp. The timeline is
 * built once and toggled with play()/reverse(), so a mid-flight tap turns the
 * menu around instead of queueing.
 */
export function RadialFab({
  shareTitle,
  always = false,
  feed = true,
}: {
  shareTitle: string;
  /** Mount at every width — the lab's study, which has no island to defer to. */
  always?: boolean;
  /** Offer the RSS feed. The feed is the blog's; a page that is not the blog
   *  (/moments) leaves it out rather than subscribe the reader to something
   *  other than what they are reading. The arc spreads what is left. */
  feed?: boolean;
}) {
  const t = useTranslations("blog");
  const locale = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const iconRef = useRef<SVGSVGElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  /** The "copied" confirmation's timer — one at a time, and none after
   *  unmount. */
  const copiedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  /* --- actions ---------------------------------------------------------- */

  const share = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Cancelled share / denied clipboard — nothing to recover from. */
    }
  }, [shareTitle]);

  const toTop = useCallback(() => {
    // Lenis owns the scroll position when it is running; bypassing it would
    // fight the smoothing loop.
    if (window.__lenis) {
      window.__lenis.scrollTo(0, { force: true });
      return;
    }
    // No lenis means reduce-motion (SmoothScroll never built one) — the native
    // fallback is not neutral here: `smooth` sweeps the whole article past the
    // eye, a longer travel than the inertia the guard was there to refuse.
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, []);

  /** Same flip LightSwitch does, minus the click sound — see lib/theme. */
  const flipTheme = useCallback(() => {
    navigator.vibrate?.(10);
    toggleTheme();
  }, []);

  const actions: Action[] = [
    { key: "share", label: copied ? t("fabShareDone") : t("fabShare"), onClick: share },
    { key: "top", label: t("fabTop"), onClick: toTop },
    ...(feed ? [{ key: "rss", label: t("fabRss"), href: `/${locale}/rss.xml` }] : []),
    { key: "theme", label: t("fabTheme"), onClick: flipTheme },
  ];

  /* --- motion ----------------------------------------------------------- */

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      const items = gsap.utils.toArray<HTMLElement>(".fab-item", root);
      if (items.length === 0) return;
      const step = (END_ANGLE - START_ANGLE) / (items.length - 1);
      const pos = items.map((_, i) => {
        const a = ((START_ANGLE + step * i) * Math.PI) / 180;
        return { x: Math.cos(a) * RADIUS, y: Math.sin(a) * RADIUS };
      });

      // Collapsed rest state: stacked under the FAB, hidden (visibility:hidden
      // also takes them out of the tab order while closed).
      gsap.set(items, { x: 0, y: 0, scale: 0.4, autoAlpha: 0 });

      const tl = gsap.timeline({ paused: true });
      items.forEach((el, i) => {
        tl.to(
          el,
          {
            x: pos[i]!.x,
            y: pos[i]!.y,
            scale: 1,
            autoAlpha: 1,
            duration: 0.6,
            ease: EASE.spring,
            easeReverse: EASE.depart,
            overwrite: "auto",
          },
          i * 0.05,
        );
      });
      if (iconRef.current) {
        tl.to(
          iconRef.current,
          {
            rotation: 135,
            duration: 0.5,
            ease: EASE.pop,
            easeReverse: EASE.exit,
            overwrite: "auto",
          },
          0,
        );
      }
      tlRef.current = tl;
      return () => {
        tlRef.current = null;
      };
    },
    { scope: rootRef },
  );

  // Drive the one timeline from React state — exits run at 2.2× on the
  // reversed ease, per the site-wide "entrances arrive, exits leave" rule.
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (open) tl.timeScale(1).play();
    else tl.timeScale(2.2).reverse();
  }, [open]);

  /**
   * Fold the fan, and hand the focus back to the "+" if it was on one of the
   * four: they go `visibility: hidden` at the end of the reverse, and a focus
   * left on a hidden button falls to <body> — a keyboard reader would be sent
   * back to the top of the page for having pressed Escape.
   */
  const close = useCallback(() => {
    const root = rootRef.current;
    const focused = document.activeElement;
    if (root?.contains(focused) && focused !== triggerRef.current) {
      triggerRef.current?.focus({ preventScroll: true });
    }
    setOpen(false);
  }, []);

  // Esc closes; so does a tap anywhere outside the cluster.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  const itemClass =
    // `invisible opacity-0` is the pre-hydration rest state: without it the
    // four buttons would sit stacked on the FAB until GSAP's first set().
    "fab-item glass-thin invisible absolute bottom-1.5 right-1.5 z-[1] grid size-11 place-items-center rounded-full text-fg-secondary opacity-0";

  return (
    <div
      ref={rootRef}
      className={`fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-6 z-50 size-14 print:hidden ${
        always ? "" : "md:hidden"
      }`}
    >
      {/* The trigger comes first in the DOM so tabbing continues *into* the
          items it just revealed, instead of stepping backwards past them.
          Position is absolute/relative, so paint order is unaffected. */}
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-label={t("fabAria")}
        onClick={() => setOpen((v) => !v)}
        className="glass-thick relative z-[2] grid size-14 cursor-pointer place-items-center rounded-full text-fg"
      >
        <svg
          ref={iconRef}
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {actions.map((action) =>
        action.href ? (
          <a
            key={action.key}
            href={action.href}
            // Not a Next route — let the browser own it, and keep the page
            // curtain out of the way (RouteTransition escape hatch).
            data-no-transition=""
            aria-label={action.label}
            title={action.label}
            className={itemClass}
            onClick={close}
          >
            <ActionIcon name={action.key} />
          </a>
        ) : (
          <button
            key={action.key}
            type="button"
            aria-label={action.label}
            title={action.label}
            className={`${itemClass} cursor-pointer`}
            onClick={() => {
              action.onClick?.();
              close();
            }}
          >
            <ActionIcon name={action.key} />
          </button>
        ),
      )}

      {/* Copy confirmation, said twice. The live region tells a screen reader;
          the chip tells everyone else — the share button has already folded
          away by the time the clipboard answers, so without it a sighted
          reader pressed "share" and watched nothing happen. One chip, and one
          timer behind it: copying again restarts the two seconds rather than
          stacking a second notice. The words stay in it while it fades, so it
          leaves as a label and not as an emptying box. */}
      <span aria-live="polite" className="sr-only">
        {copied ? t("fabShareDone") : ""}
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2"
      >
        <span
          className={`glass-thin block whitespace-nowrap rounded-chip px-3 py-1.5 text-caption text-fg transition-[opacity,translate] duration-300 ease-out ${
            copied ? "opacity-100" : "translate-y-1 opacity-0"
          }`}
        >
          {t("fabShareDone")}
        </span>
      </span>
    </div>
  );
}

function ActionIcon({ name }: { name: string }) {
  const common = {
    "aria-hidden": "true" as const,
    viewBox: "0 0 24 24",
    className: "size-[18px]",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "share":
      return (
        <svg {...common}>
          <path d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5" />
          <path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" />
        </svg>
      );
    case "top":
      return (
        <svg {...common}>
          <path d="M12 20V6m0 0-5 5m5-5 5 5" />
          <path d="M5 4h14" />
        </svg>
      );
    case "rss":
      return (
        <svg {...common}>
          <circle cx="5.5" cy="18.5" r="1.3" fill="currentColor" stroke="none" />
          <path d="M5 12a7 7 0 0 1 7 7M5 6a13 13 0 0 1 13 13" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10-1.4 1.4" />
        </svg>
      );
  }
}
