"use client";

import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/lib/gsap";
import { forgetOverture } from "@/lib/overture";
import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  label: string;
  body: string;
  action: string;
  /** Said instead of replaying when the reader asked for reduced motion. */
  reducedNote?: string;
};

/**
 * The lamp that opens a session: 0.9s of blackout, a cord dropping, a glow
 * flooding the page into view. It plays once per session, so the study
 * cannot mount it — the button hands the session key back and reloads, and
 * the layout plays it again on the way in.
 *
 * Under reduced motion OvertureLight goes straight to the page, so the reload
 * would show nothing at all: the button is disabled and says why instead of
 * looking broken.
 */
export function OvertureDemo({ accent, label, body, action, reducedNote }: Props) {
  // Read after mount: the server cannot know, and the first render has to
  // match what it sent.
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  const replay = () => {
    forgetOverture();
    window.location.reload();
  };

  return (
    <StudyPanel accent={accent} label={label}>
      <p className="spn-body">{body}</p>
      <button
        type="button"
        className="spn-btn"
        onClick={replay}
        disabled={reduced}
        style={reduced ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
        aria-describedby={reduced && reducedNote ? "overture-reduced" : undefined}
      >
        {action}
        <span aria-hidden="true">↻</span>
      </button>
      {reduced && reducedNote && (
        <p id="overture-reduced" className="spn-note">
          {reducedNote}
        </p>
      )}
    </StudyPanel>
  );
}
