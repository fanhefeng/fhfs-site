"use client";

import { replayVeil } from "@/lib/veil";
import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  label: string;
  body: string;
  action: string;
};

/**
 * The veil between routes: glass frosts over this page, and the next one
 * condenses out of it. It plays on every in-site link and on nothing else —
 * a link to this very page is ignored — so the button asks the veil to play
 * in place: the same cover and reveal, no navigation, the scroll kept.
 */
export function VeilDemo({ accent, label, body, action }: Props) {
  return (
    <StudyPanel accent={accent} label={label}>
      <p className="spn-body">{body}</p>
      <button type="button" className="spn-btn" onClick={replayVeil}>
        {action}
        <span aria-hidden="true">↻</span>
      </button>
    </StudyPanel>
  );
}
