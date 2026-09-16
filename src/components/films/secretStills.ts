import type { FilmStill } from "./entries";

/**
 * The 不能说的秘密 wall: twelve frames in the order of the story, from the
 * first tune in the piano room to the sunset on the roof. Ten are the film's
 * official production stills (3:2, shot on a stills camera) from Douban's
 * 官方剧照 set, two (the bicycle, the father's guitar) TMDB's backdrops, and
 * two (the desk, the score) frames of the film itself, letterboxed bars cut
 * away; see README「内容与模型从哪来」. Kept at their own size (1500–1800px
 * wide) in `public/films/secret/`; every caption is copy under
 * `films.secret.stills.<id>`.
 *
 * Same composition as the 大话西游 wall: a wide one with an upright crop
 * beside it, rows of three, a panoramic one across the bottom.
 */
export const SECRET_STILLS: readonly FilmStill[] = [
  { id: "piano", file: "piano", width: 1628, height: 1080, span: "wide" },
  { id: "doorway", file: "doorway", width: 1544, height: 1024, span: "tall", focus: "58% 30%" },
  { id: "corridor", file: "corridor", width: 1500, height: 994, span: "one" },
  { id: "bike", file: "bike", width: 1800, height: 1013, span: "one" },
  { id: "icecream", file: "icecream", width: 1544, height: 1024, span: "one" },
  { id: "rain", file: "rain", width: 1544, height: 1024, span: "one" },
  { id: "duel", file: "duel", width: 1544, height: 1024, span: "one" },
  { id: "desk", file: "desk", width: 1728, height: 735, span: "one" },
  { id: "photo1979", file: "photo1979", width: 1500, height: 1000, span: "one" },
  { id: "guitar", file: "guitar", width: 1280, height: 720, span: "one" },
  { id: "note", file: "note", width: 1800, height: 758, span: "one" },
  { id: "rooftop", file: "rooftop", width: 1544, height: 1024, span: "full", focus: "50% 62%" },
];

/** The three lines, in the order they are said. */
export const SECRET_LINES = ["steps", "chopin", "note"] as const;
