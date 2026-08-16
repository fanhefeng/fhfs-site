/**
 * The lab's table of contents. Three scroll studies, each on its own route.
 *
 * Slug and message key are kept separate on purpose: the URL wants kebab-case
 * and next-intl namespaces want a plain identifier, and pinning them to one
 * table is what stops the two from drifting apart the way the craft log's ids
 * once did.
 */
export type LabSlug = "scroll-video" | "dissolve" | "melting-text";

export type LabEntry = {
  slug: LabSlug;
  /** Key under the `lab.items` message namespace. */
  key: "scrollVideo" | "dissolve" | "meltingText";
  /** Index number printed beside the name, editorial-style. */
  ordinal: string;
  /** Dot + rule colour, from the muted gallery hues used across the site. */
  accent: string;
};

export const LAB_ENTRIES: LabEntry[] = [
  { slug: "scroll-video", key: "scrollVideo", ordinal: "01", accent: "#3e6d93" },
  { slug: "dissolve", key: "dissolve", ordinal: "02", accent: "#4c7a5b" },
  { slug: "melting-text", key: "meltingText", ordinal: "03", accent: "#6b5ba8" },
];

export const labEntry = (slug: string): LabEntry | undefined =>
  LAB_ENTRIES.find((entry) => entry.slug === slug);
