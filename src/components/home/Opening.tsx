"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { LiquidPill } from "@/components/grove/LiquidPill";
import { OVERTURE_DONE_EVENT, OVERTURE_SEEN_KEY } from "@/components/fx/OvertureLight";
import { splashDue } from "@/lib/splash";

export type OpeningMeta = { label: string; value: string };

/** The primary control's height, and the halo its canvas leaves around it —
 *  `pad` defaults to 1.744 button heights inside LiquidPill. */
const PILL_H = "52px";
const PILL_PAD = "90.7px";

type Props = {
  /** The manifesto, one line per element. */
  headline: string[];
  lede: string;
  cta: { label: string; href: string };
  /** The mono line under the fold: place, craft, and what the database holds. */
  meta: OpeningMeta[];
};

/**
 * The masthead's own stylesheet — five rules, so it travels inline rather than
 * through the global sheet.
 *
 * The reveal's resting state is gated on `html[data-js]` (stamped before first
 * paint by themeInit.ts): with no JS the lines are simply where they belong,
 * and nothing waits for a class that will never arrive.
 */
const CSS = `
.op-line { display: block; overflow: hidden; padding-bottom: 0.06em; }
.op-line > i { display: block; font-style: inherit; }
[data-js] .op-line > i { transform: translateY(112%); }
[data-js] .op[data-in] .op-line > i {
  transform: none;
  transition: transform 1.05s cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0ms);
}
[data-js] .op-fade { opacity: 0; transform: translateY(12px); }
[data-js] .op[data-in] .op-fade {
  opacity: 1;
  transform: none;
  transition: opacity 0.9s cubic-bezier(0.22, 0.61, 0.36, 1) var(--d, 0ms),
              transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0ms);
}
`;

/**
 * True once the page is the reader's to look at: immediately if the overture
 * has already been spent this session, otherwise on its done event. The 2s
 * fallback is the same safety net the rest of the site keeps — a curtain that
 * never lifts must not take the masthead down with it.
 *
 * Behind the front door (NeonSplash) there is no net: the door opens when the
 * reader chooses, minutes later if they like, and the masthead is behind an
 * opaque wall until then — rising early would only mean arriving settled.
 */
function useEntrance() {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    let seen = true;
    try {
      seen = !!sessionStorage.getItem(OVERTURE_SEEN_KEY);
    } catch {
      seen = true;
    }
    if (seen && !splashDue()) {
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    const done = () => setEntered(true);
    window.addEventListener(OVERTURE_DONE_EVENT, done);
    const t = splashDue() ? undefined : setTimeout(done, 2000);
    return () => {
      window.removeEventListener(OVERTURE_DONE_EVENT, done);
      clearTimeout(t);
    };
  }, []);
  return entered;
}

/**
 * The cover, first act: paper, and one thing said on it.
 *
 * Everything that used to compete with the manifesto — the dock, the two
 * floating cards, the stat pair, the play button — is gone from this screen.
 * What is left is the sentence, who is saying it, the single primary control
 * on the site, and one mono line of facts that are true because the database
 * says so.
 */
export function Opening({ headline, lede, cta, meta }: Props) {
  const locale = useLocale();
  const entered = useEntrance();
  // Chinese display type is not tracked in (docs/DESIGN.md §1.2); the Latin
  // scale's -0.03em would close up the counters.
  const zh = locale === "zh";

  return (
    <section
      className="op relative flex min-h-svh flex-col justify-center px-6 pt-32 pb-24"
      data-in={entered || undefined}
    >
      <style href="home-opening" precedence="medium">{CSS}</style>

      <div className="mx-auto w-full max-w-[1080px]">
        {/* Each line of the manifesto is a line the writer chose, so none of
            them may wrap: the type is sized off the viewport and held on one
            line at every width. `ch` would have been the obvious measure and
            is the wrong one here — it is the width of a "0", about half an em,
            so a CJK line of nine characters overflows a 13ch box.
            That holds from the md breakpoint up, where min() — not clamp() —
            keeps the size purely proportional, so no width can push the
            longest line off the screen. Below md it stops being worth it: a
            line held on one line at 320px lands at about 20px, which is not a
            masthead any more. There the lines are allowed to wrap and the type
            goes back up to a size worth reading, balanced so the halves come
            out even. */}
        <h1
          className={`font-display text-fg text-[clamp(1.9rem,8.4vw,3rem)] leading-[1.12] font-[650] text-balance whitespace-normal md:text-[min(5.4rem,6.4vw)] md:leading-[1.08] md:whitespace-nowrap ${
            zh ? "tracking-[0]" : "tracking-[-0.03em]"
          }`}
        >
          {headline.map((line, i) => (
            <span key={line} className="op-line" style={{ "--d": `${i * 110}ms` } as React.CSSProperties}>
              <i>{line}</i>
            </span>
          ))}
        </h1>

        <p
          className="op-fade mt-9 max-w-[46ch] text-body text-fg-secondary"
          style={{ "--d": "300ms" } as React.CSSProperties}
        >
          {lede}
        </p>

        {/* The pill's canvas IS its bloom pad — a 90px halo of empty room on
            every side that the flow would otherwise read as a gap the size of
            a paragraph. The negative margins take the pad back out of the
            layout so the spacing above and below is the spacing that was
            asked for. */}
        <div
          className="op-fade"
          style={{
            "--d": "420ms",
            marginTop: `calc(2.75rem - ${PILL_PAD})`,
            marginBottom: `calc(-1 * ${PILL_PAD})`,
            // Left too, or the button hangs a pad's width inside the measure
            // and stops lining up with the type above it.
            marginLeft: `calc(-1 * ${PILL_PAD})`,
          } as React.CSSProperties}
        >
          <LiquidPill height={PILL_H} base={0} href={cta.href} label={cta.label}>
            <svg className="lp-ico" viewBox="0 0 115 115" aria-hidden="true">
              <g stroke="currentColor" strokeWidth="11" strokeLinecap="round">
                <path d="M14 34.5 H101" />
                <path d="M14 57.5 H101" />
                <path d="M14 80.5 H68" />
              </g>
            </svg>
            <span className="lp-lbl">{cta.label}</span>
          </LiquidPill>
        </div>

        <dl
          className="op-fade mt-[4.5rem] flex flex-wrap gap-x-10 gap-y-3 border-t border-line pt-5 font-mono text-meta uppercase tracking-meta text-fg-tertiary"
          style={{ "--d": "540ms" } as React.CSSProperties}
        >
          {meta.map((item) => (
            <div key={item.label} className="flex items-baseline gap-2">
              <dt>{item.label}</dt>
              <dd className="text-fg-secondary tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
