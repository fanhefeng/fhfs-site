import type { FilmStill } from "./entries";

/**
 * The La La Land wall: twelve frames in the order of the story, from the
 * freeway to the road of piano keys. Six (the piano, the lovely night, the
 * pier, the planetarium, the lamp, the keys) are the studio's own publicity
 * images via TMDB, 16:9 and 1800px wide except the pier (1403px) — they hung
 * under the neon sign in `/lab/neon` first, and still do: that study reads
 * this list. Two of them, the lamp and the keys, are poster art rather than
 * frames of the film, and their captions say so. The other six are the
 * film's official production stills (3:2, shot on a stills camera) from
 * Douban's 官方剧照 set, kept at the size served (1620px wide); README's
 * /films section says where each set came from. Every caption is copy under
 * `films.lala.stills.<id>`.
 *
 * Same composition as the other walls: a wide one with an upright crop
 * beside it, rows of three, a panoramic one across the bottom.
 */
export const LALA_STILLS: readonly FilmStill[] = [
  { id: "freeway", file: "freeway", width: 1620, height: 1080, span: "wide" },
  { id: "roommates", file: "roommates", width: 1620, height: 1080, span: "tall", focus: "50% 38%" },
  { id: "lovelyNight", file: "lovely-night", width: 1800, height: 1012, span: "one" },
  { id: "piano", file: "piano", width: 1800, height: 1012, span: "one" },
  { id: "pier", file: "pier", width: 1403, height: 789, span: "one" },
  { id: "stage", file: "stage", width: 1624, height: 1080, span: "one" },
  { id: "cinema", file: "cinema", width: 1619, height: 1080, span: "one" },
  { id: "planetarium", file: "planetarium", width: 1800, height: 1012, span: "one" },
  { id: "lamp", file: "lamp", width: 1800, height: 1012, span: "one" },
  { id: "messengers", file: "messengers", width: 1620, height: 1080, span: "one" },
  { id: "moonDoor", file: "moon-door", width: 1619, height: 1080, span: "one" },
  { id: "keys", file: "keys", width: 1800, height: 1012, span: "full" },
];

/** The three lines, in the order they are said. */
export const LALA_LINES = ["passionate", "fools", "always"] as const;
