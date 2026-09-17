import type { TrackId } from "@/lib/tracks";
import { IDOLS } from "@/components/idols/entries";
import { FILMS, filmCover, stillSrc } from "@/components/films/entries";

/**
 * What /life knows about each room beyond its link. The rooms themselves —
 * which pages, in what order — come from the nav table (group `rooms`, not
 * on the header surface), the same rows the footer and the menu read, so a
 * room added in the admin is on the index at once. What is here is the
 * furniture a link cannot carry: the record the room puts on, a picture for
 * the row, a colour. A room with no entry here still lists — as a bare row.
 */
export type RoomMeta = {
  /** Key under the `life.items` message namespace, for the row's copy. */
  key: string;
  /** The record the room plays on entry (`lib/tracks`), if it has one. */
  track?: TrackId;
  /** A picture for the row, from `public/`. */
  cover?: { src: string; width: number; height: number };
  /** The accent rule that slides in on hover. */
  accent: string;
};

const firstFilm = filmCover(FILMS[0]!);

export const ROOM_META: Record<string, RoomMeta> = {
  "/moments": { key: "moments", track: "lovely", accent: "#b45309" },
  "/secrets": { key: "secrets", track: "secret", accent: "#6e8bff" },
  // The wall's own first card, rather than a second copy of its path, size and
  // colour — one edit to `entries.ts` moves both.
  "/idols": {
    key: "idols",
    cover: IDOLS[0]!.cover,
    accent: IDOLS[0]!.accent,
  },
  // Likewise the first film's card. No record on the row: each film puts on
  // its own at its door, and the index between them plays the theme.
  "/films": {
    key: "films",
    cover: {
      src: stillSrc(FILMS[0]!, firstFilm),
      width: firstFilm.width,
      height: firstFilm.height,
    },
    accent: FILMS[0]!.accent,
  },
};
