"use client";

import { useState } from "react";

type Props = {
  /** Address hidden under the sticker; empty string renders `fallback`. */
  email: string;
  /** Short teaser printed on the sticker face ("Peel me"). */
  hint: string;
  /** Accessible name for the peel button. */
  ariaLabel: string;
  /** Shown instead of a mailto link when no public email is configured. */
  fallback: string;
  className?: string;
};

/**
 * The footer's tear-off sticker — one of the site's five sanctioned sticker
 * spots. A paper-white note is stuck over the email address; hovering curls
 * its bottom edge (fine pointers), and a click/tap folds it up along the top
 * edge in 3D — mid-fold the grey adhesive back shows — then it fades away,
 * leaving the address behind. A second activation (keyboard included) sticks
 * it back on.
 *
 * Pure CSS state machine: React only flips one boolean; all motion is CSS
 * transitions on transform/opacity (motion-reduce gets instant snaps). The
 * lift is sold by two stacked shadows cross-faded via opacity — box-shadow
 * itself is never animated. No GSAP, no per-frame JS.
 */
export function PeelSticker({ email, hint, ariaLabel, fallback, className }: Props) {
  const [peeled, setPeeled] = useState(false);

  return (
    <div
      className={`group relative h-[72px] w-28 rotate-[-2.5deg] [perspective:520px] ${className ?? ""}`}
    >
      {/* What the sticker was hiding: the address, on a plain surface card.
          Inert while covered so the hidden link can't be tabbed into. */}
      <span className="absolute inset-0 flex items-center justify-center rounded-[10px] border border-dashed border-line bg-surface px-2 text-center">
        {email ? (
          <a
            href={`mailto:${email}`}
            tabIndex={peeled ? 0 : -1}
            aria-hidden={!peeled}
            className="break-all font-mono text-[10.5px] leading-tight text-accent underline decoration-from-font underline-offset-2"
          >
            {email}
          </a>
        ) : (
          <span
            aria-hidden={!peeled}
            className="font-mono text-[10.5px] leading-tight text-fg-secondary"
          >
            {fallback}
          </span>
        )}
      </span>

      {/* Double shadow, opacity-crossfaded: tight contact shadow at rest,
          soft lifted shadow while the corner curls, neither once torn off. */}
      <span
        aria-hidden
        className={`absolute inset-0 z-[1] rounded-[10px] shadow-[0_2px_6px_var(--sticker-shadow-color)] transition-opacity duration-300 motion-reduce:transition-none ${
          peeled ? "opacity-0" : "opacity-100 group-hover:opacity-0 group-focus-within:opacity-0"
        }`}
      />
      <span
        aria-hidden
        className={`absolute inset-0 z-[1] rounded-[10px] shadow-[0_10px_22px_var(--sticker-shadow-color)] transition-opacity duration-300 motion-reduce:transition-none ${
          peeled ? "opacity-0" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        }`}
      />

      {/* The sticker itself is the button. Once peeled it goes
          pointer-events-none so the revealed link is clickable, but stays
          focusable — Enter re-sticks it. The button owns the fold
          (transform); the faces layer owns the delayed fade (opacity), so
          the adhesive back gets its mid-fold glimpse before vanishing.
          Inline transform (peeled) always beats the hover-curl class, so
          the two states can't fight. */}
      <button
        type="button"
        aria-expanded={peeled}
        aria-label={ariaLabel}
        onClick={() => setPeeled((v) => !v)}
        style={peeled ? { transform: "rotateX(-118deg)" } : undefined}
        className={`absolute inset-0 z-[2] block origin-top cursor-pointer rounded-[10px] transition-transform duration-[550ms] ease-[cubic-bezier(.22,1,.36,1)] [transform-style:preserve-3d] motion-reduce:transition-none ${
          peeled
            ? "pointer-events-none"
            : "hover:[transform:rotateX(-14deg)] focus-visible:[transform:rotateX(-14deg)]"
        }`}
      >
        <span
          className={`absolute inset-0 block transition-opacity duration-300 [transform-style:preserve-3d] motion-reduce:transition-none ${
            peeled ? "opacity-0 delay-200" : "opacity-100 delay-0"
          }`}
        >
          {/* Front face: the paper-white note (a real sticker stays white in
              both themes — it's content material, not a themed surface). */}
          <span className="absolute inset-0 flex items-center justify-center rounded-[10px] border border-black/10 bg-white [backface-visibility:hidden]">
            <span className="font-mono text-[10.5px] tracking-[0.08em] text-[#1a1a1a]">
              {hint}
            </span>
          </span>
          {/* Back face: grey adhesive, glimpsed mid-fold. */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-[10px] bg-[#dcd8ce] [backface-visibility:hidden] [transform:rotateX(180deg)]"
          />
        </span>
      </button>
    </div>
  );
}
