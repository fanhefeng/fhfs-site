"use client";

import {
  INTRO_STICKERS,
  STICKER_BY_ID,
  type IntroCopy,
  type IntroLink,
  type IntroSticker,
  type IntroText,
} from "@/lib/intro/stickers";
import { useIntroStore } from "@/lib/intro/store";

type Props = {
  text: IntroText;
  copy: IntroCopy[];
  links: IntroLink[];
};

/**
 * The same sticker block at the two densities it is ever needed in. Both live
 * in one table because they were copy-pasted apart once and immediately began
 * to drift: a spacing tweak landed on the card and never reached the page.
 *
 * The heading element is part of the density rather than a separate knob. The
 * card renders inside the aria-hidden layer below, where a real <h2> would add
 * a second document outline on top of the one `IntroResume` owns — the static
 * HTML carries exactly one <h1> and one <h2> per section, and that is what a
 * crawler grades the page on. Welding the tag to the density makes "an <h2>
 * floating over the canvas" unrepresentable rather than merely discouraged.
 */
const COPY_DENSITY = {
  /** The glass card floating over the 3D stage: tighter, one step smaller. */
  card: {
    heading: "p",
    title:
      "vibrancy mt-4 flex items-baseline gap-3 text-heading text-fg sm:text-title",
    body: "mt-3 text-caption leading-relaxed text-fg-secondary sm:text-body",
    bullet: "flex gap-2.5 text-caption leading-relaxed text-fg-secondary",
    /** The dot is optically centred on the first line, so its offset is a
     *  fraction of the text size it sits beside — not a fixed length. */
    dot: "mt-[0.5em] h-1.5 w-1.5 shrink-0 rounded-full",
  },
  /** The résumé document itself, at the site's reading size. */
  page: {
    heading: "h2",
    title: "mt-4 flex items-baseline gap-3 text-title text-fg",
    body: "mt-3 text-body text-fg-secondary",
    bullet: "flex gap-2.5 text-body leading-relaxed text-fg-secondary",
    dot: "mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full",
  },
} as const;

/**
 * One sticker's words: kicker chip, title/period row, body, bullets.
 *
 * Lives here rather than in a file of its own because `IntroResume` already
 * imports from this module and nothing here imports back — one direction, no
 * cycle.
 */
export function StickerCopy({
  node,
  sticker,
  density,
}: {
  node: IntroCopy;
  sticker: IntroSticker;
  density: keyof typeof COPY_DENSITY;
}) {
  const d = COPY_DENSITY[density];
  const Title = d.heading;

  return (
    <>
      {/* Inline colours on purpose: this chip is the decal on the model said
          again in words, so it takes the sticker's own palette, not a design
          token. `lib/intro/stickers.ts` is the single source for both. */}
      <div
        className="inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-meta"
        style={{ background: sticker.colors.bg, color: sticker.colors.ink }}
      >
        <span aria-hidden>{sticker.icon}</span>
        {node.kicker}
      </div>

      <Title className={d.title}>
        {node.title}
        {node.period && (
          <span className="font-mono text-[11px] font-normal tracking-meta text-fg-tertiary">
            {node.period}
          </span>
        )}
      </Title>

      <p className={d.body}>{node.body}</p>

      {node.bullets.length > 0 && (
        <ul className="mt-4 space-y-2">
          {node.bullets.map((b) => (
            <li key={b} className={d.bullet}>
              <span
                aria-hidden
                className={d.dot}
                style={{ background: sticker.colors.bg }}
              />
              {b}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * The words, floating over the 3D stage. It only ever switches things on and
 * off by `activeIndex` — the camera move belongs to AvatarScene and is not
 * touched from here.
 *
 * The whole layer is aria-hidden: it is the visual half of a canvas
 * experience, and the accessible copy of exactly this content is rendered
 * once, in `IntroResume` further down the DOM. Two live copies would read the
 * résumé twice to a screen reader, so the visible links here are taken out of
 * the tab order and their accessible twins live in that block — which unhides
 * itself the moment focus lands in it, so tabbing past the canvas arrives at a
 * readable page instead of at nothing.
 *
 * There is no masthead row in here on purpose: the site's own header island
 * floats at top centre with a scroll scrim behind it, and anything parked in
 * the top corners gets washed out by it.
 */
export function Narrative({ text, copy, links }: Props) {
  const active = useIntroStore((s) => s.activeIndex);
  const isHero = active < 0;
  const isOutro = active >= INTRO_STICKERS.length;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 select-none"
    >
      {/* The portrait fills the frame, and words laid straight over a face do
          not read. This lifts the paper back up under them — the avatar
          appears to rise out of it. On a narrow screen the card also lives
          down here, so the wash stays on permanently. */}
      <div
        className={`absolute inset-x-0 bottom-0 h-[50%] bg-gradient-to-t from-bg via-bg/85 to-transparent transition-opacity duration-500 ${
          isHero || isOutro ? "opacity-100" : "opacity-100 sm:opacity-0"
        }`}
      />

      {/* Opening frame */}
      <div
        className={`absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-12 text-center transition-all duration-700 sm:pb-16 ${
          isHero
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-6 opacity-0"
        }`}
      >
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {text.meta}
        </p>
        <p className="mt-3 text-display-sm text-fg">{text.name}</p>
        <p className="no-cjk-oblique mt-3 max-w-md font-serif text-heading italic leading-snug text-fg-secondary">
          {text.tagline}
        </p>
        <div className="mt-8 flex flex-col items-center gap-2 font-mono text-[11px] uppercase tracking-meta text-fg-tertiary">
          <span>{text.scrollHint}</span>
          {/* The opening frame fades out on opacity but stays mounted, so the
              class has to come off explicitly — otherwise the line keeps
              breathing, and keeps the page compositing, where nobody can see
              it. See .pulse-stepped in globals.css. */}
          <span
            className={`h-8 w-px bg-fg-tertiary ${isHero ? "pulse-stepped" : ""}`}
          />
        </div>
      </div>

      {/* One card per sticker. All of them stay in the DOM — only the active
          one is visible — so the page still reads as a whole document. */}
      {copy.map((node) => {
        const hit = STICKER_BY_ID.get(node.id);
        if (!hit) return null;
        const on = active === hit.index;
        return (
          <article
            key={node.id}
            className={`absolute right-0 bottom-0 left-0 p-5 transition-all duration-500 sm:top-1/2 sm:bottom-auto sm:left-auto sm:w-[26rem] sm:-translate-y-1/2 sm:p-10 ${
              on
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-4 opacity-0"
            }`}
          >
            <div className="glass-thin rounded-card p-6 sm:p-8">
              <StickerCopy node={node} sticker={hit.sticker} density="card" />
            </div>
          </article>
        );
      })}

      {/* Closing frame */}
      <div
        className={`absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-14 text-center transition-all duration-700 sm:pb-20 ${
          isOutro
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-6 opacity-0"
        }`}
      >
        <p className="text-display-sm text-fg">{text.outroTitle}</p>
        <p className="mt-3 max-w-sm text-caption text-fg-secondary sm:text-body">
          {text.outroBody}
        </p>
        <nav className="pointer-events-auto mt-7 flex flex-wrap items-center justify-center gap-3">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              tabIndex={-1}
              // `tabIndex` only takes these out of the keyboard order; a mouse
              // click still focuses them, and focus landing inside an
              // aria-hidden subtree makes Chrome refuse the attribute for the
              // whole layer. That hands a screen reader a second live copy of
              // the résumé — the exact duplicate this layer exists to avoid.
              // Dropping the focus on mousedown leaves the click, and the
              // navigation it triggers, untouched.
              onMouseDown={(e) => e.preventDefault()}
              {...(l.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="liquid-chip rounded-full px-5 py-2.5 text-caption font-medium text-fg transition-colors hover:text-accent"
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>

      {/* Progress: one tick per stop, the opening and closing frames included */}
      <div className="absolute bottom-4 left-1/2 hidden -translate-x-1/2 gap-1.5 sm:flex">
        {Array.from({ length: INTRO_STICKERS.length + 2 }).map((_, i) => (
          <span
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === active + 1 ? "w-6 bg-fg" : "w-1.5 bg-fg-tertiary/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
