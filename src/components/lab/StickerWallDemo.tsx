"use client";

import { StickerWall } from "@/components/about/StickerWall";
import { StudyPanel } from "./StudyPanel";

type Props = {
  accent: string;
  label: string;
  title: string;
  hint: string;
  ariaLabel: string;
};

/**
 * The wall's vocabulary here is the site's own toolbox — names that read the
 * same in both languages, so the demo carries no copy for them.
 */
const CHIPS = [
  "GSAP",
  "three.js",
  "Next.js",
  "React",
  "Tailwind",
  "TypeScript",
  "Postgres",
  "Lenis",
  "WebGL",
  "SVG",
  "Canvas",
  "Drizzle",
].map((label, i) => ({
  label,
  tone: (["paper", "ink", "accent"] as const)[i % 3]!,
}));

/**
 * The wall from /about, with the toolbox for its words: stickers converge
 * from an arc above, shiver on hover, and can be thrown on a fine pointer.
 */
export function StickerWallDemo({ accent, label, title, hint, ariaLabel }: Props) {
  return (
    <StudyPanel accent={accent} label={label}>
      <StickerWall chips={CHIPS} title={title} hint={hint} ariaLabel={ariaLabel} />
    </StudyPanel>
  );
}
