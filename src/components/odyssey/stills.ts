/**
 * The 大话西游 room's fixtures: which stills hang on its wall and in what
 * order, and the ids of the two films and the three lines the page quotes.
 * Files live in `public/odyssey/` (1800px JPEGs cut from TMDB's stills, see
 * README「内容与模型从哪来」); every caption is copy and lives under
 * `odyssey.stills.<id>` / `odyssey.films.<id>` / `odyssey.lines.<id>` in the
 * message catalogues.
 */
export type OdysseySpan = "wide" | "tall" | "one" | "full";

export type OdysseyStill = {
  /** Message key: `odyssey.stills.<id>.{title,meta,alt}`. */
  id:
    | "monkeyKing"
    | "wink"
    | "desert"
    | "reeds"
    | "bride"
    | "wedding"
    | "jingjing"
    | "cave"
    | "zixia"
    | "box"
    | "gate"
    | "wall";
  file: string;
  width: number;
  height: number;
  /** Which of the two films the frame is from — Pandora's Box or Cinderella. */
  film: "box" | "cinderella";
  /** How much of the six-column wall the print takes on a desktop grid. */
  span: OdysseySpan;
  /** `object-position` for the two prints that are cropped away from 16:9. */
  focus?: string;
};

export const ODYSSEY_STILLS: OdysseyStill[] = [
  { id: "monkeyKing", file: "monkey-king", width: 1800, height: 1013, film: "cinderella", span: "wide" },
  { id: "wink", file: "wink", width: 1280, height: 720, film: "cinderella", span: "tall", focus: "24% 45%" },
  { id: "desert", file: "desert", width: 1800, height: 1013, film: "cinderella", span: "one" },
  { id: "reeds", file: "reeds", width: 1800, height: 1013, film: "box", span: "one" },
  { id: "bride", file: "bride", width: 1280, height: 720, film: "cinderella", span: "one" },
  { id: "wedding", file: "wedding", width: 1800, height: 1011, film: "cinderella", span: "one" },
  { id: "jingjing", file: "jingjing", width: 1800, height: 1013, film: "box", span: "one" },
  { id: "cave", file: "cave", width: 1800, height: 1012, film: "cinderella", span: "one" },
  { id: "zixia", file: "zixia", width: 1800, height: 1012, film: "cinderella", span: "one" },
  { id: "box", file: "box", width: 1800, height: 1013, film: "box", span: "one" },
  { id: "gate", file: "gate", width: 1280, height: 720, film: "cinderella", span: "one" },
  { id: "wall", file: "wall", width: 1800, height: 1013, film: "cinderella", span: "full", focus: "60% 55%" },
];

/** The two parts, in release order — copy under `odyssey.films.<id>`. */
export const ODYSSEY_FILMS = ["box", "cinderella"] as const;

/** The three lines, in the order they are said — copy under `odyssey.lines.<id>`. */
export const ODYSSEY_LINES = ["love", "hero", "dog"] as const;
