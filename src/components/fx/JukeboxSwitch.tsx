"use client";

import { useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { gsap, useGSAP } from "@/lib/client/gsap";
import { toggleMusic, useJukebox } from "@/lib/client/jukebox";
import {
  NeonFilter,
  NOTE_D,
  NOTE_T,
  NOTE_VIEW_BOX,
  TUBE,
  score,
} from "@/components/neon/NeonSignArt";

/**
 * The unlit glass, for the island: the sign's dark band takes a fixed
 * night-blue that would vanish on paper, so here the band is the button's
 * own text colour and follows the theme like the burger beside it.
 */
function IconGlassFilter({ id }: { id: string }) {
  return (
    <filter id={id} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
      <feMorphology in="SourceAlpha" operator="erode" radius={TUBE} result="inner" />
      <feComposite in="SourceAlpha" in2="inner" operator="out" result="band" />
      <feFlood floodColor="currentColor" floodOpacity={0.85} />
      <feComposite in2="band" operator="in" />
    </filter>
  );
}

/**
 * The note off the sign, on the island: the background music's switch once
 * the reader is inside. Lit while the music is wanted, dark glass while it
 * is not — the same drawing and the same filter as the sign over the door,
 * at icon size. Lighting up is a three-step flicker; going dark is instant,
 * as a switch is.
 */
export function JukeboxSwitch({ className = "" }: { className?: string }) {
  const t = useTranslations("common");
  const { wanted } = useJukebox();
  const litRef = useRef<SVGGElement>(null);
  // The island and a room's music line each draw one of these, so the ids are
  // per instance: `url(#…)` resolves to the first match in the document, and a
  // fixed id made every switch borrow the island's filters — which stop
  // painting the moment that copy sits in a hidden subtree.
  const uid = useId();
  const noteId = `${uid}note`;
  const litId = `${uid}lit`;
  const darkId = `${uid}dark`;

  useGSAP(
    () => {
      const lit = litRef.current;
      if (!lit) return;
      // A flicker still running from the last press would go on writing its
      // opacities over this one: switched off within a fifth of a second, the
      // note ended lit over silence.
      gsap.killTweensOf(lit);
      if (!wanted) {
        gsap.set(lit, { opacity: 0 });
        return;
      }
      const tl = gsap.timeline();
      score(tl, [lit], 0, [
        [0.05, 1],
        [0.06, 0],
        [0.04, 0.6],
        [0.03, 1],
      ]);
    },
    { dependencies: [wanted] },
  );

  return (
    <button
      type="button"
      onClick={toggleMusic}
      // One name for the switch; `aria-pressed` carries its state. A label
      // that flipped too was read as "stop the background music, pressed".
      // The tooltip is for the eye and may say what a press will do.
      aria-pressed={wanted}
      aria-label={t("music")}
      title={wanted ? t("musicPause") : t("musicPlay")}
      className={`grid size-11 cursor-pointer place-items-center rounded-full text-fg-secondary transition-colors hover:text-fg ${className}`}
    >
      <svg
        viewBox={NOTE_VIEW_BOX}
        className="h-[22px] w-[15px] overflow-visible"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <NeonFilter id={litId} x="-60%" y="-30%" width="220%" height="160%" />
          <IconGlassFilter id={darkId} />
          <path id={noteId} d={NOTE_D} transform={NOTE_T} fill="#000" />
        </defs>
        <g filter={`url(#${darkId})`}>
          <use href={`#${noteId}`} />
        </g>
        <g ref={litRef} filter={`url(#${litId})`} style={{ opacity: 0 }}>
          <use href={`#${noteId}`} />
        </g>
      </svg>
    </button>
  );
}
