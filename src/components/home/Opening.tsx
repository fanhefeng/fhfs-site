"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LiquidPill } from "@/components/grove/LiquidPill";
import { OVERTURE_DONE_EVENT, overtureSeen } from "@/lib/overture";
import { splashDue } from "@/lib/splash";

export type OpeningMeta = { label: string; value: string };

/** A place the author can be found — GitHub, RSS, mail. */
export type ContactLink = {
  label: string;
  href: string;
  /** External links open in a new tab; file routes and mailto don't need to. */
  external?: boolean;
};

/** The primary control's height, and the halo its canvas leaves around it —
 *  `pad` defaults to 1.744 button heights inside LiquidPill. */
const PILL_H = "52px";
const PILL_PAD = "90.7px";

type Props = {
  /** The manifesto, one line per element. */
  headline: string[];
  /** One sentence on who is saying it. */
  lede: string;
  cta: { label: string; href: string };
  /** The mono line under the fold: where the author is. */
  meta: OpeningMeta[];
  /** Where to find them, on the same line. */
  contactTitle: string;
  contacts: ContactLink[];
  /** The quiet door to /about at the line's end. */
  aboutLink: { label: string };
  /** The person themself, drawn. Rendered by the page and handed in, so the
   *  drawing's paths stay a server component and out of this bundle. */
  avatar?: ReactNode;
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
    const seen = overtureSeen();
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
 * The cover: paper, and one screen that says who this is.
 *
 * The sentence, the person saying it in one line, the person themself drawn
 * beside it, the single primary control on the site, and one mono line saying
 * where the author is and where to find them. Nothing else competes with the
 * masthead — no dock, no cards, no scene; the grove that used to open under
 * this screen now lives in the lab (/lab/approach, /lab/grove).
 *
 * It sits on the issue's own 720px measure. The cover used to be 1080 wide
 * while three viewports of grove stood between it and the issue; with the
 * two now a hairline apart, a wider cover read as the page suddenly
 * narrowing. One left edge from the masthead to the footer, like every
 * other page's header; the headline may still run past the measure on the
 * right (it is held on one line), which is the one break-out the cover keeps.
 */
export function Opening({
  headline,
  lede,
  cta,
  meta,
  contactTitle,
  contacts,
  aboutLink,
  avatar,
}: Props) {
  const locale = useLocale();
  const entered = useEntrance();
  // Chinese display type is not tracked in (docs/DESIGN.md §1.2); the Latin
  // scale's -0.03em would close up the counters.
  const zh = locale === "zh";

  return (
    <section
      className="op relative flex min-h-svh flex-col justify-center pt-32 pb-24"
      data-in={entered || undefined}
    >
      <style href="home-opening" precedence="medium">
        {CSS}
      </style>

      {/* The same box as the issue's (`#issue` on page.tsx): 720 wide with
          the gutter inside it, so the words here and the words there share
          one left edge at every width. */}
      <div className="mx-auto w-full max-w-[720px] px-6">
        {/* Each line of the manifesto is a line the writer chose, so none of
            them may wrap: the type is sized off the viewport and held on one
            line at every width. `ch` would have been the obvious measure and
            is the wrong one here — it is the width of a "0", about half an em,
            so a CJK line of nine characters overflows a 13ch box.
            That holds from the md breakpoint up, where min() — not clamp() —
            keeps the size purely proportional, so no width can push the
            longest line off the screen; the measure is narrower than the
            screen, and a long line is allowed past its right edge.
            Below md it stops being worth it: a line held on one line at
            320px lands at about 20px, which is not a masthead any more.
            There the lines are allowed to wrap and the type goes back up to
            a size worth reading, balanced so the halves come out even. */}
        <h1
          className={`font-display text-fg text-[clamp(1.9rem,8.4vw,3rem)] leading-[1.12] font-[650] text-balance whitespace-normal md:text-[min(5.4rem,6.4vw)] md:leading-[1.08] md:whitespace-nowrap ${
            zh ? "tracking-[0]" : "tracking-[-0.03em]"
          }`}
        >
          {/* A line left empty in the copy is not a blank line — the
              manifesto is simply shorter. */}
          {headline.filter(Boolean).map((line, i) => (
            <span
              key={line}
              className="op-line"
              style={{ "--d": `${i * 110}ms` } as React.CSSProperties}
            >
              <i>{line}</i>
            </span>
          ))}
        </h1>

        {/* Under the headline, the words on the left and the drawing on the
            right, his feet on the button's baseline. On a phone he stands
            between the headline and the words instead (column-reverse keeps
            the words first in the DOM, so the tab order reaches the button
            before him). */}
        <div className="mt-9 flex flex-col-reverse gap-8 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
          <div className="min-w-0 flex-1">
            <p
              className="op-fade max-w-[46ch] text-body text-fg-secondary"
              style={{ "--d": "300ms" } as React.CSSProperties}
            >
              {lede}
            </p>

            {/* The pill's canvas IS its bloom pad — a 90px halo of empty room
                on every side that the flow would otherwise read as a gap the
                size of a paragraph. The negative margins take the pad back
                out of the layout so the spacing above and below is the
                spacing that was asked for. */}
            <div
              className="op-fade"
              style={
                {
                  "--d": "420ms",
                  marginTop: `calc(2.75rem - ${PILL_PAD})`,
                  marginBottom: `calc(-1 * ${PILL_PAD})`,
                  // Left too, or the button hangs a pad's width inside the
                  // measure and stops lining up with the type above it.
                  marginLeft: `calc(-1 * ${PILL_PAD})`,
                } as React.CSSProperties
              }
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
          </div>

          {avatar ? (
            <div
              className="op-fade w-28 shrink-0 sm:w-36 md:w-44"
              style={{ "--d": "200ms" } as React.CSSProperties}
            >
              {avatar}
            </div>
          ) : null}
        </div>

        {/* One mono line: where he is, where to find him, and the door to
            the rest of him. The dl holds the facts; the link stands beside
            it, pushed to the line's end where there is room. */}
        <div
          className="op-fade mt-[4.5rem] flex flex-wrap items-baseline gap-x-10 gap-y-3 border-t border-line pt-5 font-mono text-meta uppercase tracking-meta text-fg-tertiary"
          style={{ "--d": "540ms" } as React.CSSProperties}
        >
          <dl className="flex flex-wrap items-baseline gap-x-10 gap-y-3">
            {meta.map((item) => (
              <div key={item.label} className="flex items-baseline gap-2">
                <dt>{item.label}</dt>
                <dd className="text-fg-secondary tabular-nums">{item.value}</dd>
              </div>
            ))}
            {contacts.length > 0 ? (
              <div className="flex flex-wrap items-baseline gap-x-4">
                <dt>{contactTitle}</dt>
                {contacts.map((contact) => (
                  <dd key={contact.href}>
                    <a
                      href={contact.href}
                      {...(contact.external
                        ? { target: "_blank", rel: "noreferrer" }
                        : { "data-no-transition": "" })}
                      className="hit-ext text-fg-secondary transition-colors hover:text-accent"
                    >
                      {contact.label}
                      <span aria-hidden="true"> ↗</span>
                    </a>
                  </dd>
                ))}
              </div>
            ) : null}
          </dl>
          <Link
            href="/about"
            className="hit-ext text-fg-secondary underline decoration-accent/60 decoration-1 underline-offset-4 transition-colors hover:text-accent sm:ml-auto"
          >
            {aboutLink.label}
            <span aria-hidden="true"> →</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
