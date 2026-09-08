import type { TrackId } from "@/lib/tracks";
import { IDOLS } from "@/components/idols/entries";

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

export const ROOM_META: Record<string, RoomMeta> = {
  "/moments": { key: "moments", track: "unknown", accent: "#b45309" },
  "/secrets": { key: "secrets", track: "secret", accent: "#6e8bff" },
  // The wall's own first card, rather than a second copy of its path, size and
  // colour — one edit to `entries.ts` moves both.
  "/idols": {
    key: "idols",
    cover: IDOLS[0].cover,
    accent: IDOLS[0].accent,
  },
  "/odyssey": {
    key: "odyssey",
    track: "odyssey",
    cover: { src: "/odyssey/monkey-king.jpg", width: 1800, height: 1013 },
    accent: "#b8552e",
  },
};
