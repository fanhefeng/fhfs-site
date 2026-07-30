"use client";

import { useRef } from "react";
import { Link } from "@/i18n/navigation";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";

export type DeckCard = {
  title: string;
  href: string;
  tags: string[];
  date: string;
  summary: string;
};

type Props = {
  cards: DeckCard[];
  kicker: string;
  heading: string;
  subline: string;
};

/* Card face themes cycle by index — pure CSS gradients, no images. */
const THEMES = [
  "radial-gradient(120% 90% at 20% 0%, rgba(232,180,79,.22), transparent 55%)",
  "radial-gradient(120% 90% at 20% 0%, rgba(255,77,109,.20), transparent 55%)",
  "radial-gradient(120% 90% at 20% 0%, rgba(76,201,240,.18), transparent 55%)",
];

const pad = (n: number) => String(n).padStart(2, "0");

/* Hand-dealt imperfection: nobody stacks cards perfectly straight. Each
 * card keeps a fixed sub-degree twist, cycled by index so it's stable
 * across renders — enough to feel placed by hand, not generated. */
const DEAL_JITTER = [-0.55, 0.4, -0.3, 0.6, -0.45, 0.25];

/**
 * "TRACK 02" — the notes deck. One pinned ScrollTrigger drives the whole
 * stack: every frame the scroll progress becomes a floating-point position
 * on the deck, and each card derives its pose from its distance d to that
 * position (d>0 future: stacked behind, shrinking, blurring; d<0 past:
 * flipping up and away). No keyframes — any card count, any fractional
 * scroll position, always a valid pose.
 */
export function NotesDeck({ cards, kicker, heading, subline }: Props) {
  const container = useRef<HTMLElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const N = cards.length;

  useGSAP(
    () => {
      const q = gsap.utils.selector(container);
      const stage = q<HTMLDivElement>(".deck-stage")[0];
      const cardsWrap = q<HTMLDivElement>(".deck-cards")[0];
      const cardEls = q<HTMLAnchorElement>(".deck-card");
      const edges = q<HTMLSpanElement>(".deck-edge");
      const idxItems = q<HTMLDivElement>(".deck-idx");
      const cnum = q<HTMLSpanElement>(".deck-cnum")[0];
      if (!stage || !cardsWrap || cardEls.length === 0) return;

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        // Static fallback: flatten the deck into a plain vertical list.
        // Every card fully visible, no transforms, no pinning — information
        // stays complete, only the choreography is gone.
        gsap.set(stage, { height: "auto", display: "block", padding: "14vh 0 10vh" });
        gsap.set(q(".deck-head"), { position: "static", xPercent: 0, marginBottom: 48 });
        gsap.set(cardsWrap, { position: "static", aspectRatio: "auto", margin: "0 auto" });
        cardEls.forEach((c) =>
          gsap.set(c, {
            position: "relative",
            inset: "auto",
            transform: "none",
            opacity: 1,
            filter: "none",
            visibility: "visible",
            marginBottom: 24,
          })
        );
        gsap.set([q(".deck-index"), q(".deck-count")], { display: "none" });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Heading slides out of its slice mask as the act comes into view.
        gsap.from(q(".deck-heading .split-inner"), {
          yPercent: 110,
          duration: 1,
          ease: "expo.out",
          scrollTrigger: { trigger: wrapperRef.current, start: "top 75%", once: true },
        });

        // quickSetter skips the per-call parsing overhead of gsap.set —
        // this runs for every card on every scrolled frame.
        const setters = cardEls.map((c) => gsap.quickSetter(c, "css"));
        const hidden = cardEls.map(() => false);
        const clamp01 = gsap.utils.clamp(0, 1);
        let lastActive = -1;

        const render = (progress: number) => {
          const pos = progress * (N - 1);

          cardEls.forEach((_, i) => {
            const d = i - pos; // d<0 past · d≈0 now · d>0 future
            let z: number, y: number, rot: number, scale: number, blur: number, op: number;

            if (d >= 0) {
              // Future: stacked behind, drifting up, shrinking, blurring.
              z = -d * 190;
              y = -d * 26;
              rot = -d * 3.2;
              scale = 1 - d * 0.055;
              blur = Math.min(7, d * 2.2);
              op = clamp01(1 - d * 0.26);
            } else {
              // Past: flipping up and flying off the top of the stage.
              const a = -d;
              z = a * 320;
              y = -a * 460;
              rot = a * 24;
              scale = 1 + a * 0.12;
              blur = a * 5;
              op = clamp01(1 - a * 1.15);
            }

            // Fully faded past cards would still hover over the stack and
            // steal clicks — drop them out of hit-testing entirely.
            hidden[i] = op < 0.02;
            setters[i]({
              transform: `translate3d(0,${y}px,${z}px) rotateX(${rot}deg) rotateZ(${DEAL_JITTER[i % DEAL_JITTER.length]}deg) scale(${scale})`,
              opacity: op,
              filter: blur > 0.05 ? `blur(${blur}px)` : "none",
              visibility: hidden[i] ? "hidden" : "visible",
            });

            // The "now" card's top edge lights up, fullest at dead center.
            const near = clamp01(1 - Math.abs(d) * 1.6);
            edges[i].style.transform = `scaleX(${near})`;
          });

          const active = Math.round(pos);
          if (active !== lastActive) {
            lastActive = active;
            idxItems.forEach((el, i) => {
              el.dataset.active = String(i === active);
            });
            if (cnum) cnum.textContent = pad(active + 1);
          }
        };

        const st = ScrollTrigger.create({
          trigger: wrapperRef.current,
          start: "top top",
          end: "+=" + N * 90 + "%",
          pin: true,
          scrub: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          // Snap settles the deck on the nearest card after release —
          // this is what makes the interaction feel "finished".
          snap:
            N > 1
              ? {
                  snapTo: 1 / (N - 1),
                  duration: { min: 0.15, max: 0.45 },
                  delay: 0.04,
                  ease: "power2.inOut",
                }
              : undefined,
          onUpdate: (self) => render(self.progress),
        });

        render(0);

        // The stage is pinned, so the browser cannot scroll a focused card
        // into view — tabbing would land on a card buried under the stack.
        // Deal the focused card to the front instead. Keyboard focus only:
        // a mouse click also fires focusin, and dealing the card mid-click
        // would move it out from under the cursor.
        const onFocusIn = (e: FocusEvent) => {
          const el = e.target as HTMLElement | null;
          if (!el || !el.matches(":focus-visible")) return;
          const card = el.closest(".deck-card");
          if (!card) return;
          const i = cardEls.indexOf(card as HTMLAnchorElement);
          if (i < 0 || N < 2) return;
          const to = st.start + (i / (N - 1)) * (st.end - st.start);
          if (window.__lenis) {
            window.__lenis.scrollTo(to, { immediate: true, force: true });
          } else {
            st.scroll(to);
          }
          render((to - st.start) / (st.end - st.start));
        };
        cardsWrap.addEventListener("focusin", onFocusIn);

        return () => {
          cardsWrap.removeEventListener("focusin", onFocusIn);
        };
      });
    },
    { scope: container }
  );

  return (
    <section ref={container} data-act="setlist">
      <div ref={wrapperRef}>
        <div className="deck-stage relative grid h-svh place-items-center overflow-hidden [perspective:1500px]">
          {/* Act header — pinned to the top of the stage */}
          <div className="deck-head pointer-events-none absolute left-1/2 top-[10vh] z-[12] w-[min(90vw,700px)] -translate-x-1/2 text-center">
            <span className="track-kicker">{kicker}</span>
            <h2 className="deck-heading mt-3 font-deco text-3xl text-gold md:text-5xl">
              <span className="split-line">
                <span className="split-inner">{heading}</span>
              </span>
            </h2>
            <p className="mt-3 text-sm text-muted-fg">{subline}</p>
          </div>

          {/* The deck — one absolutely-stacked Link per note */}
          {/* Height-led sizing: the deck must fit under the header and the
              act title, so bound it by the viewport and let 4:5 give width. */}
          <div className="deck-cards relative mt-[8svh] aspect-[4/5] h-[min(58svh,560px)] max-w-[86vw] [transform-style:preserve-3d]">
            {cards.map((card, i) => (
              <Link
                key={card.href}
                href={card.href}
                className="deck-card glass absolute inset-0 overflow-hidden rounded-xl shadow-[inset_0_1px_0_var(--glass-highlight),0_40px_80px_-30px_rgba(0,0,0,0.55)] will-change-transform [transform-origin:50%_100%]"
                style={{ zIndex: N - i, backgroundImage: THEMES[i % 3] }}
              >
                {/* Top edge lights up on the "now" card */}
                <span
                  aria-hidden
                  className="deck-edge absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gold"
                />
                <span className="relative flex h-full flex-col p-6 md:p-8">
                  <span className="font-mono text-3xl tabular-nums text-gold/35 md:text-4xl">
                    {pad(i + 1)}
                  </span>
                  <span className="my-auto font-deco text-3xl leading-snug text-fg md:text-4xl">
                    {card.title}
                  </span>
                  <span className="flex flex-col gap-3">
                    <span className="line-clamp-3 text-sm text-muted-fg">
                      {card.summary}
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {card.tags.map((tag) => (
                        <span
                          key={tag}
                          className="border border-line px-2 py-0.5 font-mono text-[10px] tracking-[0.07em] text-muted-fg"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                    <span className="font-mono text-[10px] text-muted-fg">
                      {card.date}
                    </span>
                  </span>
                </span>
              </Link>
            ))}
          </div>

          {/* Index rail — strictly synced with the deck (desktop only).
              Decorative readout: the titles it mirrors are already on the
              cards, so keep it out of the accessibility tree. */}
          <div
            aria-hidden="true"
            className="deck-index pointer-events-none absolute left-6 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-0.5 font-mono text-[11px] lg:flex"
          >
            {cards.map((card, i) => (
              <div
                key={card.href}
                data-active={i === 0}
                className="deck-idx group grid h-[26px] grid-cols-[26px_34px_1fr] items-center gap-3 text-muted-fg transition-colors duration-300 data-[active=true]:text-gold"
              >
                <span>{pad(i + 1)}</span>
                <span className="h-px w-[34px] bg-line transition-all duration-300 group-data-[active=true]:w-[52px] group-data-[active=true]:bg-gold" />
                <span className="-translate-x-1.5 whitespace-nowrap text-[10.5px] tracking-[0.06em] opacity-0 transition-all duration-300 group-data-[active=true]:translate-x-0 group-data-[active=true]:opacity-100">
                  {card.title}
                </span>
              </div>
            ))}
          </div>

          {/* Big counter, bottom right */}
          <div
            aria-hidden="true"
            className="deck-count pointer-events-none absolute bottom-6 right-6 z-20 text-right font-mono tabular-nums"
          >
            <span className="deck-cnum block text-[clamp(34px,6vw,62px)] leading-none tracking-[-0.04em] text-fg">
              01
            </span>
            <span className="text-xs text-muted-fg">/ {pad(N)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
