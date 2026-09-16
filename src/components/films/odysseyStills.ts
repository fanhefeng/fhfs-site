import type { FilmStill } from "./entries";

/**
 * The 大话西游 wall: which stills hang on it and in what order, and the ids
 * of the two parts and the three lines the page quotes. Files live in
 * `public/films/odyssey/` (1800px JPEGs cut from TMDB's stills, see README
 * 「内容与模型从哪来」); every caption is copy and lives under
 * `films.odyssey.stills.<id>` / `films.odyssey.parts.<id>` /
 * `films.odyssey.lines.<id>` in the message catalogues.
 *
 * The composition: a wide one with an upright crop beside it, rows of three,
 * and a panoramic one across the bottom. `focus` only for the two prints
 * cropped away from 16:9 — the wink to the left, the city wall to the right.
 */
export const ODYSSEY_STILLS: readonly FilmStill[] = [
  { id: "monkeyKing", file: "monkey-king", width: 1800, height: 1013, span: "wide" },
  { id: "wink", file: "wink", width: 1280, height: 720, span: "tall", focus: "24% 45%" },
  { id: "desert", file: "desert", width: 1800, height: 1013, span: "one" },
  { id: "reeds", file: "reeds", width: 1800, height: 1013, span: "one" },
  { id: "bride", file: "bride", width: 1280, height: 720, span: "one" },
  { id: "wedding", file: "wedding", width: 1800, height: 1011, span: "one" },
  { id: "jingjing", file: "jingjing", width: 1800, height: 1013, span: "one" },
  { id: "cave", file: "cave", width: 1800, height: 1012, span: "one" },
  { id: "zixia", file: "zixia", width: 1800, height: 1012, span: "one" },
  { id: "box", file: "box", width: 1800, height: 1013, span: "one" },
  { id: "gate", file: "gate", width: 1280, height: 720, span: "one" },
  { id: "wall", file: "wall", width: 1800, height: 1013, span: "full", focus: "60% 55%" },
];

/** The two parts, in release order. */
export const ODYSSEY_PARTS = ["box", "cinderella"] as const;

/** The three lines, in the order they are said. */
export const ODYSSEY_LINES = ["love", "hero", "dog"] as const;
