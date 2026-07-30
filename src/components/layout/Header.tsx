"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { site } from "@/config/site";
import { gsap, useGSAP } from "@/lib/gsap";
import { NeonLogo } from "@/components/deco/NeonLogo";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { FullNav } from "./FullNav";

const navItems = [
  { href: "/blog", key: "blog" },
  { href: "/about", key: "about" },
  { href: "/portfolio", key: "portfolio" },
  { href: "/software", key: "software" },
] as const;

/** Hamburger line geometry: three resting lines and their X-shape targets. */
const LINES = [
  { rest: { x1: 3, y1: 6, x2: 21, y2: 6 }, cross: { x1: 5, y1: 5, x2: 19, y2: 19 } },
  { rest: { x1: 3, y1: 12, x2: 21, y2: 12 }, cross: null },
  { rest: { x1: 3, y1: 18, x2: 21, y2: 18 }, cross: { x1: 5, y1: 19, x2: 19, y2: 5 } },
] as const;

export function Header() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const headerRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);

  // Hamburger ⇄ X: the outer lines tween their endpoint attributes into the
  // diagonals while the middle line fades — and back. Attribute tweens, not
  // transforms, so the stroke caps stay crisp at every angle.
  useGSAP(
    () => {
      const [l1, l2, l3] = lineRefs.current;
      if (!l1 || !l2 || !l3) return;
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const d = reduced ? 0 : 0.35;
      const ease = "power2.inOut";
      if (menuOpen) {
        gsap.to(l1, { attr: LINES[0].cross, duration: d, ease, overwrite: "auto" });
        gsap.to(l2, { opacity: 0, duration: d * 0.55, ease, overwrite: "auto" });
        gsap.to(l3, { attr: LINES[2].cross, duration: d, ease, overwrite: "auto" });
      } else {
        gsap.to(l1, { attr: LINES[0].rest, duration: d, ease, overwrite: "auto" });
        gsap.to(l2, { opacity: 1, duration: d, ease, overwrite: "auto" });
        gsap.to(l3, { attr: LINES[2].rest, duration: d, ease, overwrite: "auto" });
      }
    },
    { dependencies: [menuOpen], scope: headerRef }
  );

  return (
    <>
      <header
        ref={headerRef}
        // While the curtain-call menu is up the header rises above its
        // boards (z-70) so the X button stays reachable; the route curtains
        // (z-90+) still cover everything.
        className={`glass sticky top-0 border-0 border-b border-line ${
          menuOpen ? "z-[80]" : "z-40"
        }`}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            aria-label={site.signName}
            className="group -my-1 block transition-[filter] duration-300 hover:[filter:drop-shadow(0_0_10px_rgba(76,201,240,0.55))]"
          >
            <NeonLogo compact className="h-12 w-12 overflow-visible" />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            {/* Inline links are the desktop shortcut row; small screens rely
                on the full-screen menu instead. */}
            <div className="hidden items-center gap-1 sm:flex sm:gap-2">
              {navItems.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded px-2 py-2 text-sm tracking-wide transition-colors sm:px-3 ${
                      active
                        ? "text-gold [text-shadow:var(--glow-gold)]"
                        : "text-muted-fg hover:text-fg"
                    }`}
                  >
                    {t(item.key)}
                  </Link>
                );
              })}
            </div>
            <LocaleSwitcher />
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? t("close") : t("menu")}
              aria-expanded={menuOpen}
              // The theme pull-cord dangles at fixed right-8 (z-55, above the
              // resting header). Below ~1120px the header's right edge reaches
              // under it, so keep the button clear of the cord's hit zone.
              className="ml-2 mr-12 grid h-9 w-9 cursor-pointer place-items-center rounded border border-line text-muted-fg transition-colors hover:border-gold/50 hover:text-gold min-[1120px]:mr-0"
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
          </nav>
        </div>
      </header>
      <FullNav
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        triggerRef={buttonRef}
      />
    </>
  );
}
