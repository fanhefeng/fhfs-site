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
 * A Chinese article headline entering: never scrambled — swapping glyph
 * widths every frame reads as noise — but cut into lines by SplitText, each
 * rising from behind its own mask, and re-cut once the font lands
 * (autoSplit). `PostTitle` takes this branch when the title has CJK in it;
 * the Latin branch — a decode — is its own study. Replaying remounts the
 * title (`key`), which is what a route change does.
 */
export function UnmaskDemo({ accent, label, replay, title }: Props) {
  const [take, setTake] = useState(0);

  return (
    <StudyPanel accent={accent} label={label}>
      <style href="lab-unmask" precedence="medium">
        {DEMO_CSS}
      </style>
      <PostTitle key={take} as="p" title={title} className="umd-title" lang="zh-CN" />
      <button type="button" className="spn-btn" onClick={() => setTake((n) => n + 1)}>
        {replay}
        <span aria-hidden="true">↻</span>
      </button>
    </StudyPanel>
  );
}

/* Narrow enough that the title breaks into lines on every screen — the
   mask is per line, so one line would be one rise. */
const DEMO_CSS = `
.umd-title {
  margin: 0;
  max-width: 11ch;
  font-size: clamp(1.75rem, 4.6vw, 3.25rem);
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: 0;
}
`;
