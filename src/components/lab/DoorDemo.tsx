"use client";

import { forgetSplash } from "@/lib/splash";
import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  label: string;
  body: string;
  action: string;
  /** The cover's address in this language — the only place the door is decided. */
  homeHref: string;
};

/**
 * The way in through the sign: on a hard landing at the cover the letters go
 * dark, the ring holds, the paper shows through it and the wall pushes past.
 * Decided before first paint and once per session, so the study cannot mount
 * it — the button hands the session key back and lands on the cover again.
 */
export function DoorDemo({ accent, label, body, action, homeHref }: Props) {
  const replay = () => {
    forgetSplash();
    window.location.assign(homeHref);
  };

  return (
    <StudyPanel accent={accent} label={label}>
      <p className="spn-body">{body}</p>
      <button type="button" className="spn-btn" onClick={replay}>
        {action}
        <span aria-hidden="true">→</span>
      </button>
    </StudyPanel>
  );
}
