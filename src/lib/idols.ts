import type { Localized } from "@/db/schema";

/**
 * The idols wall's shapes — what a row of the `idols` table holds beyond its
 * plain columns. Like the films (`lib/films`), the idols were code until
 * 2026-09-29 and are rows now, edited under 偶像 in /admin.
 *
 * One thing stayed in code: Kobe's statue. It is a three.js scene built for
 * him (`components/idols/KobeStatue`), so the page mounts it for the idol
 * whose key is `STATUE_IDOL`, and its words stay in the catalogues under
 * `idols.kobe`.
 */

/** The idol whose page carries the statue. */
export const STATUE_IDOL = "kobe";

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
