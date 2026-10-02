import type { Localized } from "@/db/schema";
import type { TrackId } from "./tracks";

/**
 * The idols wall's shapes — what a row of the `idols` table holds beyond its
 * plain columns. Like the films (`lib/films`), the idols were code until
 * 2026-09-29 and are rows now, edited under 偶像 in /admin.
 *
 * Two things stayed in code, both Kobe's. His statue: a three.js scene built
 * for him (`components/idols/KobeStatue`), so the page mounts it for the idol
 * whose key is `STATUE_IDOL`, and its words stay in the catalogues under
 * `idols.kobe`. And his record (`IDOL_TRACKS`): a recording cut for his page
 * alone, which a film's `track` column would be for a film — but no other
 * idol has one, so it is a line here rather than a column on every row.
 */

/** The idol whose page carries the statue. */
export const STATUE_IDOL = "kobe";

/**
 * The record an idol's page puts on at its door (`lib/tracks`), by key. A
 * map, not an object: a key is whatever was typed in the admin, and
 * `constructor` is a valid one.
 */
export const IDOL_TRACKS: ReadonlyMap<string, TrackId> = new Map<string, TrackId>([
  // His own voice, not music: "that's the dream", then "Mamba out".
  [STATUE_IDOL, "mamba"],
]);

/**
 * A photograph on an idol's page: someone else's picture, so it carries its
 * provenance — who took it, under what terms, and the page where both are
 * stated (Commons, for the twelve of Kobe). `src` and the size as for a
 * film's still (`FilmStill`).
 */
export type IdolPhoto = {
  /** Unique on the page: the idol's `cover` names a photo by it. */
  id: string;
  src: string;
  width: number;
  height: number;
  author: string;
  licence: string;
  /** Where the licence and the original are — an http(s) address, or empty. */
  page: string;
  title: Localized;
  meta: Localized;
  alt: Localized;
};

/** A line of the timeline: a date as printed (`1996.06`), and what happened. */
export type IdolMilestone = { date: string; title: Localized; note: Localized };
