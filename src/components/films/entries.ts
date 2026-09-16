import type { TrackId } from "@/lib/tracks";
import { ODYSSEY_LINES, ODYSSEY_PARTS, ODYSSEY_STILLS } from "./odysseyStills";
import { SECRET_LINES, SECRET_STILLS } from "./secretStills";

/**
 * The films — which ones hang in the room, in what order, and everything
 * about each that is not copy: the route, the record it plays, the stills
 * on its wall and which of them is on the index card. The copy for each
 * lives under `films.<slug>` in the message catalogues, and its pictures in
 * `public/films/<slug>/`.
 */
export type FilmSlug = "odyssey" | "secret";

/** How much of the six-column wall a print takes on a desktop grid. */
export type StillSpan = "wide" | "tall" | "one" | "full";

/**
 * The frame every print on a wall is cut to. The 大话西游 stills are video
 * frames (16:9); the 不能说的秘密 ones are the production photographs, shot
 * on a stills camera (3:2). The upright and the panoramic crops are the same
 * for both.
 */
export type FilmRatio = "video" | "photo";

export type FilmStill = {
  /** Message key: `films.<slug>.stills.<id>.{title,meta,alt}`. */
  id: string;
  /** File name under `public/films/<slug>/`, without the `.jpg`. */
  file: string;
  width: number;
  height: number;
  span: StillSpan;
  /** `object-position` for a print cropped away from its frame. */
  focus?: string;
};

/** The rows of the facts strip, in order — labels under `films.facts.<key>`,
 *  values under `films.<slug>.facts.<key>`. */
export const FILM_FACTS = ["director", "cast", "released", "runtime", "rating"] as const;

export type FilmEntry = {
  slug: FilmSlug;
  year: string;
  /** The record the room plays on entry (`lib/tracks`). */
  track: TrackId;
  /** Dot + rule colour on the index card and the /life row. */
  accent: string;
  ratio: FilmRatio;
  /** The `id` of the still on the index card and the /life row. */
  cover: string;
  stills: readonly FilmStill[];
  /** The lines the page quotes, in the order they are said — copy under `films.<slug>.lines.<id>`. */
  lines: readonly string[];
  /** For a film released in parts — copy under `films.<slug>.parts.<id>`. */
  parts?: readonly string[];
};

export const FILMS: FilmEntry[] = [
  {
    slug: "odyssey",
    year: "1995",
    track: "odyssey",
    accent: "#b8552e",
    ratio: "video",
    cover: "monkeyKing",
    stills: ODYSSEY_STILLS,
    lines: ODYSSEY_LINES,
    parts: ODYSSEY_PARTS,
  },
  {
    slug: "secret",
    year: "2007",
    track: "secret",
    accent: "#8a6a3d",
    ratio: "photo",
    cover: "piano",
    stills: SECRET_STILLS,
    lines: SECRET_LINES,
  },
];

export const filmEntry = (slug: string): FilmEntry | undefined =>
  FILMS.find((film) => film.slug === slug);

/** The public path of a still. */
export const stillSrc = (film: FilmEntry, still: FilmStill): string =>
  `/films/${film.slug}/${still.file}.jpg`;

/** The still on a film's index card — the first one if the named id is gone. */
export const filmCover = (film: FilmEntry): FilmStill =>
  film.stills.find((still) => still.id === film.cover) ?? film.stills[0];
