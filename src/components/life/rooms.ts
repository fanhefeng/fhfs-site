import type { TrackId } from "@/lib/tracks";

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
  /** A picture for the row, already the address the browser fetches. */
  cover?: { src: string; width: number; height: number };
  /** The accent rule that slides in on hover. */
  accent: string;
};

/** A room's first card as the row borrows it: its picture and its colour. */
type FirstCard = { cover?: RoomMeta["cover"]; accent: string | null } | undefined;

/**
 * The rows' furniture. The idols' and the films' rows borrow the first card
 * on their walls — its picture, its colour — rather than keeping a second
 * copy of either, so hanging a new first film in the admin moves both; the
 * page hands those over from the rows it has read.
 */
export function roomMeta(firstIdol: FirstCard, firstFilm: FirstCard): Record<string, RoomMeta> {
  return {
    "/moments": { key: "moments", track: "lovely", accent: "#b45309" },
    "/secrets": { key: "secrets", track: "secret", accent: "#6e8bff" },
    "/idols": {
      key: "idols",
      cover: firstIdol?.cover,
      accent: firstIdol?.accent ?? "#5b3f8a",
    },
    // No record on the row: each film puts on its own at its door, and the
    // index between them plays the theme.
    "/films": {
      key: "films",
      cover: firstFilm?.cover,
      accent: firstFilm?.accent ?? "#b8552e",
    },
  };
}
