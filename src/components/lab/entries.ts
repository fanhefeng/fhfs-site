/**
 * The lab's table of contents. Eight studies, each on its own route.
 *
 * Slug and message key are kept separate on purpose: the URL wants kebab-case
 * and next-intl namespaces want a plain identifier, and pinning them to one
 * table is what stops the two from drifting apart the way the craft log's ids
 * once did.
 */
export type LabSlug =
  | "scroll-video"
  | "dissolve"
  | "melting-text"
  | "grove"
  | "grove-stage"
  | "liquid-metal"
  | "workstation"
  | "lens-slider";

export type LabEntry = {
  slug: LabSlug;
  /** Key under the `lab.items` message namespace. */
  key:
    | "scrollVideo"
    | "dissolve"
    | "meltingText"
    | "grove"
    | "groveStage"
    | "liquidMetal"
    | "workstation"
    | "lensSlider";
  /** Index number printed beside the name, editorial-style. */
  ordinal: string;
  /** Dot + rule colour, from the muted gallery hues used across the site. */
  accent: string;
};

export const LAB_ENTRIES: LabEntry[] = [
  { slug: "scroll-video", key: "scrollVideo", ordinal: "01", accent: "#3e6d93" },
  { slug: "dissolve", key: "dissolve", ordinal: "02", accent: "#4c7a5b" },
  { slug: "melting-text", key: "meltingText", ordinal: "03", accent: "#6b5ba8" },
  { slug: "grove", key: "grove", ordinal: "04", accent: "#4a5d3a" },
  // The same moss with two paper cards standing in it, one on each side of
  // the canvas — the composition the grove was first built for.
  { slug: "grove-stage", key: "groveStage", ordinal: "05", accent: "#7c8177" },
  { slug: "liquid-metal", key: "liquidMetal", ordinal: "06", accent: "#8a93a8" },
  // The 3D desk from the old portfolio — it lived on /about until the page
  // slimmed down; a draggable, inertial three.js piece is a study by nature.
  { slug: "workstation", key: "workstation", ordinal: "07", accent: "#b45309" },
  // Four photographs and a lens: the next picture arrives inside a growing
  // circle of glass, magnified at the rim, then settles flat.
  { slug: "lens-slider", key: "lensSlider", ordinal: "08", accent: "#5b7f8a" },
];

export const labEntry = (slug: string): LabEntry | undefined =>
  LAB_ENTRIES.find((entry) => entry.slug === slug);
