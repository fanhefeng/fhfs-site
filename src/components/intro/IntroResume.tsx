import {
  INTRO_STICKERS,
  type IntroCopy,
  type IntroLink,
  type IntroText,
} from "@/lib/intro/stickers";
import { StickerCopy } from "./Narrative";

type Props = {
  text: IntroText;
  copy: IntroCopy[];
  links: IntroLink[];
  /**
   * `seo` — visually hidden, but the only accessible copy of the résumé while
   * the 3D stage is up (nothing inside a canvas reaches a screen reader or a
   * crawler). Unhides itself when focus enters it — see the wrapper below.
   * `visible` — the page itself, when WebGL is unavailable or the visitor
   * asked to save data. Same narrow column as the rest of the site.
   */
  variant: "seo" | "visible";
};

/**
 * The résumé as a document: header, one section per sticker, contact footer.
 * One h1, one h2 per section — this is the outline the whole /intro route is
 * graded on, which is why the canvas layer never renders a heading.
 */
function ResumeDocument({ text, copy, links }: Omit<Props, "variant">) {
  return (
    <div className="mx-auto w-full max-w-[720px] px-6 pt-24 pb-24 sm:pt-32">
      <header className="border-b border-line pb-10">
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {text.meta}
        </p>
        <h1 className="mt-5 text-display-sm text-fg">{text.name}</h1>
        <p className="mt-2 font-mono text-meta uppercase tracking-meta text-fg-secondary">
          {text.role}
        </p>
        <p className="no-cjk-oblique mt-4 font-serif text-title italic leading-tight text-fg-secondary">
          {text.tagline}
        </p>
      </header>

      <div className="divide-y divide-line">
        {copy.map((node, i) => (
          <section key={node.id} className="py-9">
            <StickerCopy
              node={node}
              sticker={INTRO_STICKERS[i]}
              density="page"
            />
          </section>
        ))}
      </div>

      <footer className="border-t border-line pt-10">
        <h2 className="text-title text-fg">{text.outroTitle}</h2>
        <p className="mt-2 text-body text-fg-secondary">{text.outroBody}</p>
        <nav className="mt-6 flex flex-wrap gap-3">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              {...(l.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="rounded-full border border-line px-5 py-2.5 text-caption font-medium text-fg transition-colors hover:border-accent hover:text-accent"
            >
              {l.label}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  );
}

/**
 * The résumé, in the two situations the /intro route can be in.
 *
 * Both variants render the *same* document. They used to render two hand-kept
 * copies of it — a class-free one for crawlers and a styled one for the
 * fallback page — which is untenable now that the hidden copy can become
 * visible: a keyboard visitor would have landed on unstyled, unspaced markup.
 * The hidden copy is no longer "markup nobody looks at", so it is styled like
 * everything else. Same tags, same outline, still exactly one h1 — but note
 * that it did gain real content, not just classes: the kicker ("01 — 主业" and
 * its six siblings) is ordinary indexed text, so a screen reader now announces
 * it ahead of each section title and a crawler indexes all seven strings. That
 * reads as a deliberate label rather than noise, which is why it stays.
 *
 * The `seo` wrapper is the interesting part. The canvas cannot be operated by
 * keyboard at all, so the honest answer to "someone pressed Tab" is to hand
 * them the readable page — not to leave them on invisible 1px links that
 * navigate away with no focus ring and nothing moving on screen, which is
 * what this was before. `focus-within:not-sr-only` has to sit on the wrapper
 * itself: `sr-only` hides via `clip-path`, and clip-path clips even `position:
 * fixed` descendants, so no child can escape it.
 *
 * `data-lenis-prevent` keeps the wheel inside the panel: Lenis owns the page's
 * scroll and would otherwise scroll the 3D track underneath while the reader
 * is looking at the résumé.
 *
 * z-85 puts it over the header island (80) — the header sits earlier in the
 * tab order, so by the time this opens it has already been passed, and letting
 * it float on top would only stripe the text — but under the paper grain (90),
 * like every other surface on the site.
 */
export function IntroResume({ text, copy, links, variant }: Props) {
  const doc = <ResumeDocument text={text} copy={copy} links={links} />;
  if (variant === "visible") return doc;

  return (
    <div
      // The panel is the tab stop, ahead of anything inside it. Without that
      // the first focusable descendant is the contact nav in the footer, two
      // thousand pixels down: the sheet would spring open already scrolled
      // past the name and all seven sections, and two more Tabs would close
      // it again having shown the reader nothing but the links. A focusable
      // scroll container is also the plain requirement here — the panel
      // scrolls, so a keyboard has to be able to reach and drive it.
      tabIndex={0}
      role="region"
      aria-label={text.resumeRegion}
      data-lenis-prevent
      className="sr-only focus-within:not-sr-only focus-within:fixed focus-within:inset-0 focus-within:z-[85] focus-within:overflow-y-auto focus-within:overscroll-contain focus-within:bg-bg focus-within:text-fg"
    >
      {doc}
    </div>
  );
}
