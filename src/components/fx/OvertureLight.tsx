"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { gsap, useGSAP, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

/** Handshake contract (unchanged since the first-load loader shipped): once the
 * ritual ends — or is skipped — 'fhfs:overture-done' fires so the hero can
 * start its own entrance, and the session key stops replays. */
const SEEN_KEY = "fhfs-overture-seen";
const DONE_EVENT = "fhfs:overture-done";

/** Where the lamp hangs — cord length, glow flood and circle reveal all
 * share this origin so the light reads as one source. */
const LAMP_X = "50%";
const LAMP_Y = "42%";

/** Timeline landmarks (s). Total runtime 0.9s. */
const FLOOD_AT = 0.38;
const DONE_AT = 0.78;
const END_AT = 0.9;

type Phase = "pending" | "playing" | "done";

/**
 * Opening ritual for "The Quiet Issue": the gallery lights turn on.
 *
 * 0.9s, once per session: blackout → a cord drops and a small lamp warms
 * up in two steps (dim, then full) → its glow floods outward as a growing
 * clip-path circle while the black scrim dissolves — the page is unveiled
 * by light, not by a wipe — then the warm tint melts away and the masthead
 * underneath takes over (via the done event). Serves delight + safety: the
 * first thing this site ever does is turn the lights on for the reader.
 *
 * Mechanics kept from the old loader: sessionStorage + done-event handshake,
 * scroll lock under the lenis contract, "pending" phase so returning
 * visitors never see a flash, reduce-motion goes straight to the page.
 * Click or Enter/Space/Escape fast-forwards (timeScale) instead of
 * jump-cutting. Under prefers-reduced-transparency the translucent glow
 * flood is dropped and the scrim fade alone does the unveiling.
 */
export function OvertureLight() {
  const container = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const floodRef = useRef<HTMLDivElement>(null);
  const cordRef = useRef<HTMLDivElement>(null);
  const bulbRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  // Overlay starts transparent and inert so returning visitors never see
  // a flash of the blackout before the effect decides to skip it.
  const [phase, setPhase] = useState<Phase>("pending");
  const t = useTranslations("common");

  useGSAP(
    () => {
      const overlay = overlayRef.current;
      const scrim = scrimRef.current;
      const flood = floodRef.current;
      const cord = cordRef.current;
      const bulb = bulbRef.current;
      const halo = haloRef.current;
      if (!overlay || !scrim || !flood || !cord || !bulb || !halo) return;

      const finishInstant = () => {
        setPhase("done");
        window.dispatchEvent(new Event(DONE_EVENT));
      };

      /** Once shown — or deliberately skipped — the overture is spent for this
       *  session. Recording it in the timeline's last frame alone is not
       *  enough: a context revert (the [locale] layout remounts on a locale
       *  switch) skips the terminal callback, and the next mount then replays
       *  the whole opaque blackout, scroll lock included. Blocked storage never
       *  reaches here — an overture that was never shown stays owed. */
      const markSeen = () => {
        try {
          sessionStorage.setItem(SEEN_KEY, "1");
        } catch {
          /* Replaying the overture beats crashing the page. */
        }
      };

      // Blocked storage (private mode, cookie policy) must not strand the
      // page behind the curtain — treat a throw as "already seen".
      let seen = true;
      try {
        seen = !!sessionStorage.getItem(SEEN_KEY);
      } catch {
        seen = true;
      }
      // Reduce-motion: an opaque full-viewport blackout that locks the page and
      // blurs away anything the visitor tabs to is the one entrance worth
      // skipping outright. The key is spent on the way past, because HomeHero
      // reads it to learn the relay is not coming — otherwise the cover would
      // sit at opacity 0 waiting out the 8s safety timeout.
      if (prefersReducedMotion()) {
        markSeen();
        seen = true;
      }
      if (seen) {
        finishInstant();
        return;
      }

      setPhase("playing");

      // Lock scrolling while the lights are still off (lenis contract).
      window.__lenis?.stop();
      document.documentElement.style.overflow = "hidden";
      let locked = true;
      const unlock = () => {
        if (!locked) return;
        locked = false;
        document.documentElement.style.overflow = "";
        // Re-sync before resuming: anything the user spun during the
        // blackout must not teleport the page once it lifts.
        window.__lenis?.scrollTo(window.scrollY, {
          immediate: true,
          force: true,
        });
        window.__lenis?.start();
        // Pinned sections were measured while the page was locked and had
        // no scrollbar; re-measure now that the real layout is back.
        ScrollTrigger.refresh();
      };

      /** Proof the blackout actually reached the screen. Dev Strict Mode
       *  mounts, reverts and remounts inside a single commit — not one
       *  frame is painted in between, so that teardown still owes the
       *  visitor the overture, while a genuine mid-play unmount does not. */
      let shown = false;
      const shownFrame = requestAnimationFrame(() => {
        shown = true;
      });

      // The blackout is opaque, so anything focusable behind it would take
      // an invisible focus ring — and Enter would activate an unseen link.
      const onFocusIn = (e: FocusEvent) => {
        const target = e.target;
        if (locked && target instanceof HTMLElement && target !== document.body) {
          target.blur();
        }
      };
      // Mouse users click to fast-forward; keyboard gets the same way out.
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
          e.preventDefault();
          skip();
        }
      };

      // Initial states — set in JS so SSR markup stays untouched.
      gsap.set(overlay, { autoAlpha: 1 });
      gsap.set(scrim, { opacity: 1 });
      gsap.set(cord, { scaleY: 0, transformOrigin: "50% 0%" });
      gsap.set(bulb, { autoAlpha: 0 });
      gsap.set(halo, { autoAlpha: 0, scale: 0.6 });
      gsap.set(flood, {
        autoAlpha: 1,
        clipPath: `circle(0% at ${LAMP_X} ${LAMP_Y})`,
      });

      const tl = gsap.timeline();
      tl
        // 1. The cord drops from the dark.
        .to(cord, { scaleY: 1, duration: 0.2, ease: "power2.out" }, 0)
        // 2. The lamp warms up: a dim flicker first, then full.
        .to(bulb, { autoAlpha: 0.55, duration: 0.08, ease: "power1.in" }, 0.16)
        .to(bulb, { autoAlpha: 1, duration: 0.12, ease: "power1.out" }, 0.3)
        .to(halo, { autoAlpha: 1, scale: 1, duration: 0.3, ease: "power3.out" }, 0.18)
        // 3. Light floods outward (clip-path circle) and pushes the dark
        //    out — the unveiling is done by the glow, not by a wipe.
        .to(
          flood,
          {
            clipPath: `circle(135% at ${LAMP_X} ${LAMP_Y})`,
            duration: 0.5,
            ease: "power2.out",
          },
          FLOOD_AT
        )
        .to(scrim, { opacity: 0, duration: 0.44, ease: "power2.inOut" }, 0.42)
        // 4. Relay: hand over before the last of the warm tint melts, so
        //    the masthead starts rising under the fading light.
        .add(() => {
          window.dispatchEvent(new Event(DONE_EVENT));
        }, DONE_AT)
        .to(
          overlay,
          { autoAlpha: 0, duration: END_AT - 0.62, ease: "power1.inOut" },
          0.62
        )
        .add(() => {
          unlock();
          window.removeEventListener("keydown", onKeyDown);
          window.removeEventListener("focusin", onFocusIn);
          markSeen();
          setPhase("done");
        }, END_AT);

      tlRef.current = tl;
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("focusin", onFocusIn);

      // Restore scroll even if we unmount mid-play (route change).
      return () => {
        unlock();
        cancelAnimationFrame(shownFrame);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("focusin", onFocusIn);
        if (shown) markSeen();
      };
    },
    { scope: container }
  );

  // Fast-forward smoothly instead of jump-cutting — the light still spreads,
  // just three times as fast.
  const skip = () => {
    const tl = tlRef.current;
    if (tl && tl.isActive() && tl.timeScale() < 3) tl.timeScale(3);
  };

  if (phase === "done") return null;

  return (
    <div ref={container} className="contents">
      {/* Reduced transparency: no translucent glow flood — the scrim fade
          alone unveils the page. Component-private rule. */}
      <style>{`
        @media (prefers-reduced-transparency: reduce) {
          .overture-flood { display: none; }
        }
      `}</style>
      {/* Politely tell screen readers the lights are coming on; the visual
          overlay itself is pure decoration. */}
      {phase === "playing" && (
        <span role="status" className="sr-only">
          {t("loaderAria")}
        </span>
      )}
      <div
        ref={overlayRef}
        onClick={skip}
        aria-hidden="true"
        className={`fixed inset-0 z-[97] overflow-hidden ${
          phase === "pending" ? "pointer-events-none opacity-0" : ""
        }`}
      >
        {/* Blackout scrim — the gallery before opening, same in both themes. */}
        <div
          ref={scrimRef}
          className="absolute inset-0"
          style={{ background: "#0e0e11" }}
        />
        {/* Warm light flood, unveiled by a growing clip-path circle.
            Hardcoded rgba of --glow-warm (#FFB86B) — gradients cannot take
            the token with alpha steps. */}
        <div
          ref={floodRef}
          className="overture-flood absolute inset-0"
          style={{
            background: `radial-gradient(circle at ${LAMP_X} ${LAMP_Y}, rgba(255, 184, 107, 0.26), rgba(255, 184, 107, 0.07) 42%, rgba(255, 184, 107, 0) 72%)`,
            clipPath: `circle(0% at ${LAMP_X} ${LAMP_Y})`,
          }}
        />
        {/* The lamp: hairline cord from the ceiling down to a small bulb. */}
        <div
          className="absolute top-0 left-1/2 flex -translate-x-1/2 flex-col items-center"
          style={{ height: LAMP_Y }}
        >
          <div
            ref={cordRef}
            className="w-px flex-1 will-change-transform"
            style={{ background: "rgba(255, 255, 255, 0.22)" }}
          />
          <div className="relative h-0 w-0">
            <div
              ref={haloRef}
              className="absolute top-1/2 left-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full will-change-transform"
              style={{
                background:
                  "radial-gradient(closest-side, rgba(255, 184, 107, 0.35), rgba(255, 184, 107, 0) 70%)",
              }}
            />
            <div
              ref={bulbRef}
              className="absolute top-1/2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, #fff6e8 0%, #ffb86b 55%, rgba(255, 184, 107, 0) 78%)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
