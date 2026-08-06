"use client";

import { useRef, useState } from "react";
import { gsap, useGSAP, Draggable, EASE } from "@/lib/gsap";
import { Magnetic } from "@/components/fx/Magnetic";

/**
 * Fold geometry for the peel-off sticker.
 *
 * The sticker is a square, so clip-path percentages are isotropic and the
 * crease can stay a true 45°. `p` is how far the bottom-right corner has been
 * pulled: at p=1 the crease runs corner to corner and half the sticker is
 * lifted.
 *
 * `stuck` is the part still glued down (a pentagon losing its corner);
 * `flap` is that corner mirrored across the crease — reflecting (100,100)
 * over the line x+y = a+100 lands exactly on (a,a).
 */
function fold(p: number) {
  const t = gsap.utils.clamp(0, 1, p);
  const a = 100 - t * 100;
  return {
    stuck: `polygon(0% 0%, 100% 0%, 100% ${a}%, ${a}% 100%, 0% 100%)`,
    flap: `polygon(${a}% 100%, 100% ${a}%, ${a}% ${a}%)`,
  };
}

const REST = fold(0);

/** One language's way out of the page. */
type NotFoundBlock = {
  /** BCP-47 tag, so the CJK type guards in globals.css apply per block. */
  lang: string;
  title: string;
  description: string;
  homeHref: string;
  homeLabel: string;
  blogHref: string;
  blogLabel: string;
};

type Props = {
  /** One block per language offered. Two blocks sit side by side. */
  blocks: NotFoundBlock[];
  sticker: { lang: string; hint: string; aria: string; secret: string };
};

/**
 * The 404 stage: a scrambling number, the ways out, and a corner sticker you
 * can actually tear off.
 *
 * Copy arrives as props rather than from `useTranslations` because this also
 * renders from `app/global-not-found.tsx`, which is served for unmatched URLs
 * outside the [locale] tree — there is no locale, and no intl provider, there.
 * Plain <a> for the same reason; on routed pages RouteTransition still picks
 * those clicks up.
 */
export function NotFoundStage({ blocks, sticker }: Props) {
  const numberRef = useRef<HTMLDivElement>(null);
  const stickerRef = useRef<HTMLDivElement>(null);
  /** Imperative handle shared with the button — set once GSAP is wired. */
  const peelApi = useRef<((to?: number) => void) | null>(null);
  const [peeled, setPeeled] = useState(false);

  /* The number decodes itself: 0.8s of digits settling into 404 — the one
   * scramble on the page, and the only place digits ever churn. */
  useGSAP(
    () => {
      const el = numberRef.current;
      if (!el) return;
      gsap.to(el, {
        duration: 0.8,
        ease: "none",
        scrambleText: {
          text: "404",
          chars: "0123456789",
          speed: 0.6,
          revealDelay: 0.15,
        },
      });
    },
    { scope: numberRef }
  );

  /* The corner sticker: drag it off (pointer or touch) or activate the
   * corner button. Only clip-path + opacity change — no layout, no
   * box-shadow tween (the two shadow layers cross-fade instead). */
  useGSAP(
    () => {
      const root = stickerRef.current;
      if (!root) return;

      const stuckEls = gsap.utils.toArray<HTMLElement>("[data-stuck]", root);
      const flapEl = root.querySelector<HTMLElement>("[data-flap]");
      const tight = root.querySelector<HTMLElement>('[data-shadow="tight"]');
      const soft = root.querySelector<HTMLElement>('[data-shadow="soft"]');
      const secret = root.querySelector<HTMLElement>("[data-secret]");
      if (!flapEl || !tight || !soft || !secret) return;

      const state = { p: 0 };

      const render = () => {
        const { stuck, flap } = fold(state.p);
        for (const el of stuckEls) el.style.clipPath = stuck;
        flapEl.style.clipPath = flap;
        // Contact shadow gives way to a soft, larger one as the corner lifts.
        const lift = gsap.utils.clamp(0, 1, state.p / 0.55);
        tight.style.opacity = String(1 - lift);
        soft.style.opacity = String(lift);
        // The hidden line only resolves once there is room to read it.
        secret.style.opacity = String(
          gsap.utils.clamp(0, 1, (state.p - 0.25) / 0.45)
        );
      };

      const settle = (to: number) => {
        gsap.to(state, {
          p: to,
          // Peeling open is the reward; re-sticking is a departure, so it
          // travels the same distance in a little over half the time.
          duration: to > state.p ? 0.5 : 0.3,
          ease: EASE.default,
          overwrite: true,
          onUpdate: render,
          onComplete: () => setPeeled(to > 0.5),
        });
      };

      render();
      peelApi.current = (to) => settle(to ?? (state.p > 0.5 ? 0 : 1));

      // Draggable needs a real element; a detached proxy keeps the
      // sticker's own transforms free (the GSAP proxy pattern).
      const proxy = document.createElement("div");
      const handle = root.querySelector<HTMLElement>("[data-handle]");
      let startP = 0;
      let startX = 0;
      let startY = 0;
      // Pulling roughly one sticker-width up-left peels it fully.
      let pull = 1;

      let dragger: Draggable | undefined;
      dragger = Draggable.create(proxy, {
        trigger: handle ?? root,
        type: "x,y",
        // The handle is a <button>; without this Draggable would refuse to
        // start a drag on a clickable element.
        dragClickables: true,
        // Below this the gesture stays a click, so tapping still peels.
        minimumMovement: 6,
        allowContextMenu: true,
        cursor: "grab",
        activeCursor: "grabbing",
        onPress() {
          if (!dragger) return;
          gsap.killTweensOf(state);
          startP = state.p;
          startX = dragger.x;
          startY = dragger.y;
          pull = root.getBoundingClientRect().width * 1.05 || 1;
        },
        onDrag() {
          if (!dragger) return;
          // Up and to the left both peel; their sum is the pull distance.
          const pulled = startX - dragger.x + (startY - dragger.y);
          state.p = gsap.utils.clamp(0, 1, startP + pulled / pull);
          render();
        },
        onDragEnd() {
          settle(state.p > 0.5 ? 1 : 0);
        },
      })[0];

      return () => {
        dragger?.kill();
        peelApi.current = null;
      };
    },
    { scope: stickerRef }
  );

  const bilingual = blocks.length > 1;

  return (
    <main className="flex flex-1 flex-col justify-center px-6 py-24 sm:py-32">
      <div className="mx-auto w-full max-w-[680px]">
        {/* Decorative — the accessible name of this page is the h1 below. */}
        <div
          ref={numberRef}
          aria-hidden="true"
          lang="en"
          className="font-display text-display leading-none text-fg"
        >
          404
        </div>

        {/* One column per language: an unmatched URL can't tell us which one
            the reader wants, so both stay on offer. */}
        <div
          className={
            bilingual
              ? "mt-8 grid gap-10 sm:grid-cols-2 sm:gap-8"
              : "mt-8 max-w-[46ch]"
          }
        >
          {blocks.map((b, i) => (
            <section key={b.lang} lang={b.lang}>
              {i === 0 ? (
                <h1 className="text-title font-display text-fg">{b.title}</h1>
              ) : (
                <h2 className="text-title font-display text-fg">{b.title}</h2>
              )}
              <p className="mt-4 text-body text-fg-secondary">
                {b.description}
              </p>

              {/* Two ways out — home, or straight into the writing. */}
              <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
                <Magnetic strength={0.3}>
                  <a
                    href={b.homeHref}
                    className="inline-flex min-h-11 items-center rounded-chip bg-fg px-5 text-sm font-medium text-bg"
                  >
                    {b.homeLabel}
                  </a>
                </Magnetic>
                <a
                  href={b.blogHref}
                  className="inline-flex min-h-11 items-center text-sm text-fg-secondary underline decoration-accent/50 decoration-1 underline-offset-4 transition-colors hover:text-fg hover:decoration-accent"
                >
                  {b.blogLabel}
                </a>
              </div>
            </section>
          ))}
        </div>

        {/* The corner easter egg. Sticker = content material, so it stays
            paper-white in both themes; only what it hides is themed. */}
        <div className="mt-16 flex justify-end sm:mt-24">
          <div
            ref={stickerRef}
            className="relative size-56 rotate-[-3deg] md:size-64"
          >
            {/* Underneath: the line you only get to read by tearing. */}
            {/* Sized and parked so the whole line clears the crease at
                full peel: everything below the corner-to-corner diagonal. */}
            <div className="absolute inset-0 flex items-end justify-end rounded-[14px] border border-dashed border-line bg-surface p-3">
              <p
                data-secret
                lang={sticker.lang}
                className="no-cjk-oblique max-w-[76%] text-right font-serif text-[12px] italic leading-snug text-fg-secondary"
              >
                {sticker.secret}
              </p>
            </div>

            {/* Two shadow layers, cross-faded by opacity: tight contact
                shadow at rest, soft and wide once the corner lifts. The
                white silhouettes inside are hidden by the face on top —
                only the shadows they cast are ever seen. */}
            <div
              data-shadow="soft"
              aria-hidden="true"
              className="absolute inset-0 opacity-0 [filter:drop-shadow(0_18px_28px_var(--sticker-shadow-color))]"
            >
              <div
                data-stuck
                style={{ clipPath: REST.stuck }}
                className="size-full rounded-[14px] bg-white"
              />
            </div>
            <div
              data-shadow="tight"
              aria-hidden="true"
              className="absolute inset-0 [filter:drop-shadow(0_2px_6px_var(--sticker-shadow-color))]"
            >
              <div
                data-stuck
                style={{ clipPath: REST.stuck }}
                className="size-full rounded-[14px] bg-white"
              />
            </div>

            {/* Face — the part still glued down. */}
            <div
              data-stuck
              style={{ clipPath: REST.stuck }}
              className="absolute inset-0 flex flex-col gap-3 rounded-[14px] border border-black/10 bg-white p-4"
            >
              <span className="block size-2 rounded-full bg-accent" />
              <span
                lang={sticker.lang}
                className="font-mono text-[11px] tracking-meta text-[#1a1a1a]"
              >
                {sticker.hint}
              </span>
              {/* Dog-ear affordance; it is clipped away as you peel. */}
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="absolute bottom-2.5 right-2.5 size-4 fill-black/15"
              >
                <path d="M16 16H0L16 0z" />
              </svg>
            </div>

            {/* Flap — the folded-back corner, adhesive side up. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 [filter:drop-shadow(-3px_-3px_8px_var(--sticker-shadow-color))]"
            >
              <div
                data-flap
                style={{
                  clipPath: REST.flap,
                  backgroundImage:
                    "linear-gradient(315deg, #cfc9bb 0%, #e9e5dc 62%, #f8f6f1 100%)",
                }}
                className="size-full rounded-[14px]"
              />
            </div>

            {/* Grab handle: 56px hit area in the corner, also a button so
                the egg is reachable by tap and by keyboard. */}
            <button
              type="button"
              data-handle
              aria-label={sticker.aria}
              aria-expanded={peeled}
              onClick={() => peelApi.current?.()}
              className="absolute bottom-0 right-0 size-14 cursor-grab rounded-[14px] active:cursor-grabbing"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
