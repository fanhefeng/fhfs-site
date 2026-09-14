/**
 * The sign's geometry, in the units of the drawing it is traced from: the
 * SEB'S over the door of Seb's, vectorised from the film on Wikimedia Commons
 * (File:Seb's.svg, Espandero, CC BY-SA 4.0). Measured off that trace: the
 * ring is a circle about (401, 595) of radius 323, its tube 15.6 wide, the
 * letters' 12.7; it is broken at the top right where the note's stem leaves
 * it, and its left arc simply ends at the lower left while the right arc runs
 * on round the bottom and folds back up into the bar — one tube. The letters
 * stand upright, cap ≈ 343, on a baseline that climbs to the right by 9.5°.
 *
 * Plain data, no React and no "use client": the sign hangs in client
 * components (the door, the lab, the island) but its ring is also the site's
 * mark — the favicon is drawn from these numbers and the Open Graph cards
 * paint it on the server, where a client module's exports are not values.
 */

export const VIEW_BOX = "0 150 802 802";
/** The box's side, in drawing units — the viewBox is square. */
export const BOX = 802;

/** Tube width, in drawing units; the core sits centred inside it. */
export const TUBE = 13;
/** The ring and the bar are bent from a slightly heavier tube. */
export const RING_TUBE = 14;

/**
 * The ring, as fractions of the rendered box: where its centre lands and
 * how far its inner edge is from it. The door opens through this circle.
 */
export const RING = {
  cx: 401 / BOX,
  cy: (595 - 150) / BOX,
  inner: (323 - RING_TUBE / 2) / BOX,
} as const;

/** The left arc: from the note's stem (−60°) over the top and down the left to 155°. */
export const ARC_L = "M562.8 314.9A323.3 323.3 0 0 0 108.2 731.4";
/** The right arc alone: down from −30° round the bottom to 135°. */
export const ARC_R = "M681.2 433.2A323.3 323.3 0 0 1 172.6 823.4";
/**
 * The right arc and the bar: the arc above, then a hairpin back up along the
 * bar to its free end under the S.
 */
export const ARC_R_BAR = `${ARC_R}L616.2 738.2`;

/**
 * The note is the trace's: an outlined stem and an outlined head, one solid
 * shape whose tube the filter finds. The original sits on the B's shoulder;
 * here it has to clear the second F's arm, so it is raised and its stem cut
 * shorter by as much, to stand as far above the ring as the original does.
 */
export const NOTE_D =
  "m627.7 271c-11.33 2.004-22.67 4.272-33.92 6.473-0.18 23.5-0.08 47-0.18 70.6v8.585c-2.427-0.8046-1.197 1.28-1.991 2.069-16.85 4.82-32.92 14.4-42.95 29.05-6.548 9.536-10.03 21.17-9.495 32.75 0.3086 6.572 2.091 13.37 6.29 18.56 5.043 5.836 13.12 8.465 20.7 7.743 10.76-0.3604 20.68-5.582 29.24-11.74 13.36-9.731 24.64-22.77 30.58-38.33 2.126-5.701 3.979-11.63 4.364-17.73 0.1006-18.58-0.4451-37.15-0.6702-55.73-0.6-17.2-1.2-34.4-1.8-51.6-0.0923-0.1478 0.1219-0.731-0.1997-0.6646z";
export const NOTE_T = "translate(8 -60)";
/** The note's own box (after NOTE_T), with room for its glow — the island's icon. */
export const NOTE_VIEW_BOX = "520 190 150 220";

/**
 * The mark: the ring with the note in its gap, and nothing else — what the
 * sign is at sixteen pixels. A square box about the ring's centre with the
 * note's head inside it (the ring spans x 71–731, y 265–925; the note reaches
 * up to y ≈ 211).
 */
export const MARK_VIEW_BOX = "31 198 740 740";
/** The ring alone, squared about its centre — the badge on the island. */
export const RING_VIEW_BOX = "51 245 700 700";

export type GlyphName = "F" | "H" | "S";

/**
 * The letters, as solid outer outlines. S is the trace's S. F is the trace's
 * E without its foot: E's outline up to its bottom-left corner, the stem
 * closed with an arm-end corner, then up the stem's inner edge into E's own
 * middle arm and top. The original has no H; this one is two stems of B's
 * weight joined by a bar of E's middle arm's weight, its horizontals on the
 * same tilt as the rest of the word.
 */
export const GLYPH: Record<GlyphName, string> = {
  F: "m365.8 422.3c-19.73 1.727-39.32 4.849-58.97 7.356-9.121 1.129-18.5 2.519-26.41 7.56-12.64 7.098-21.2 20.07-24.24 34.09-0.9372 6.707-0.1556 13.65-0.4318 20.45-0.174 46.59 0.0762 93.2-0.596 139.8-6.246 0.1185-12.76 3.338-15 9.491-0.8736 4.727-0.0398 9.858-0.276 14.74 0.2027 8.737-0.1766 17.55 0.7413 26.24 2.307 4.899 7.825 7.031 12.94 7.305 4.422-0.8033 3.933 2.739 3.771 5.992 0.3519 16.16-0.1292 32.36 0.8981 48.49 2.456 8.121 8.263 15.36 15.63 19.6 4.142 2.485 9.063 2.344 13.64 1.385l12.5-1.6c4.06-1.41 7.4-5.24 8.23-9.35l-2-71.8c3.018-4.347 8.845-3.133 13.34-4.191 11.6-1.684 23.27-3.066 34.75-5.428 4.355-1.955 7.15-6.368 8.502-10.72-0.3588-11.42 0.2612-22.9-0.7917-34.27-1.777-5.115-6.638-9.777-12.21-10.05-14.31 1.082-28.62 2.928-42.85 4.466-1.524-0.3207-0.2152-2.956-0.7402-3.991-0.232-38.55 0.0163-77.12 0.4546-115.7 0.5089-4.955-0.5158-10.54 2.032-15.03 3.011-3.947 7.539-6.764 12.63-6.698 14.43-1.553 29.03-1.817 43.37-4.073 6.916-2.248 12.08-8.588 13.74-15.48 0.0177-10.04 1.317-20.14 0.2696-30.15-1.259-5.534-7.538-8.471-12.79-8.365z",
  H: "M267 447.6Q267 438.6 275.9 437.5L302.1 434.2Q311 433.1 311 442.1L311 617.4Q311 621.4 315 620.9L359 615.6Q363 615.2 363 611.2L363 435.6Q363 426.6 371.9 425.5L398.1 422.2Q407 421.1 407 430.1L407 740.6Q407 749.6 398.1 750.7L371.9 754.1Q363 755.2 363 746.2L363 675.8Q363 671.8 359 672.4L315 678.5Q311 679.1 311 683.1L311 752.9Q311 761.9 302.1 763L275.9 766.4Q267 767.5 267 758.5z",
  S: "m180.2 452.4c-12.83 14.14-23.85 30.03-32.42 47.12-9.855 19.54-15.76 41.3-15.24 63.29 0.2581 19.02 4.073 38.24 12.65 55.31 4.936 10.3 13.01 19.12 15.9 30.35 2.212 10.43 0.8882 21.27-0.8568 31.67-5.541 28.76-18.61 55.51-34.06 80.19-2.153 3.587-4.791 7.026-6.699 10.68 11.33 7.074 22.85 13.97 34.44 20.54 13.96-17.54 26.35-36.31 37.65-55.66 11.57-20.06 22.45-41.08 26.64-64.08 3.204-17.15 3.671-34.87 1.153-52.14-1.896-12.63-8-24.1-15.2-34.47-7.914-11.11-14.78-23.4-17.03-37.02-3.405-20.84 0.2894-42.78 10.05-61.47 3.265-6.102 7.715-11.5 12.07-16.8-9.413-5.732-18.53-11.99-28.18-17.31-0.2774-0.1062-0.5762-0.2552-0.8818-0.2023z",
};

/**
 * Where each letter stands. The glyphs keep the trace's coordinates (E's, S's
 * at the second S); the offsets put the word where SEB'S was — the first F on
 * the first S's spot, the S on the second's — each letter's foot on the
 * baseline climbing at 9.5°.
 */
export const WORD: { g: GlyphName; x: number; y: number }[] = [
  { g: "F", x: -120.2, y: 22.9 },
  { g: "H", x: 0, y: 0 },
  { g: "F", x: 175.3, y: -26.4 },
  { g: "S", x: 483, y: -80.5 },
];

export const SEGS = ["ring", "bar", "note", "l0", "l1", "l2", "l3"] as const;
export type SegName = (typeof SEGS)[number];
export const LETTER_SEGS: SegName[] = ["l0", "l1", "l2", "l3"];

/** The tube's colours, the filter's and the flat drawings' alike. */
export const NEON = {
  /** The lit glass. */
  tube: "#a9cbff",
  /** The white-hot core down the middle of the tube. */
  core: "#f4f9ff",
  /** The glow hugging the tube. */
  glow: "#3f78ff",
  /** The wider, dimmer halo on the wall. */
  halo: "#2b57ff",
  /** The bricks behind the door — the plate the mark sits on. */
  wall: "#0e0e11",
} as const;
