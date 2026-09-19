"use client";

import { useState } from "react";
import { PostTitle } from "@/components/blog/PostTitle";
import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  label: string;
  replay: string;
  title: string;
};

/**
 * A Latin article headline entering: one lowercase ScrambleText pass, a
 * typewriter finding the words. `PostTitle` takes this branch when the
 * title has no CJK in it; the Chinese branch — a line mask — is its own
 * study. Replaying remounts the title (`key`), which is what a route change
 * does.
 */
export function HeadlineDemo({ accent, label, replay, title }: Props) {
  const [take, setTake] = useState(0);

  return (
    <StudyPanel accent={accent} label={label}>
      <style href="lab-headline" precedence="medium">
        {DEMO_CSS}
      </style>
      <PostTitle key={take} as="p" title={title} className="hld-title" />
      <button type="button" className="spn-btn" onClick={() => setTake((n) => n + 1)}>
        {replay}
        <span aria-hidden="true">↻</span>
      </button>
    </StudyPanel>
  );
}

const DEMO_CSS = `
.hld-title {
  margin: 0;
  max-width: 22ch;
  font-size: clamp(1.75rem, 4.6vw, 3.25rem);
  font-weight: 650;
  line-height: 1.12;
  letter-spacing: -0.02em;
}
`;
