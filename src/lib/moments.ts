/**
 * The board's arithmetic — what 《多的是你不知道的事》 does to its list before
 * drawing it. Pure functions over plain rows: the page formats the instants
 * on the server (`getFormatter`, in the site's zone) and hands the board
 * strings, so nothing here touches a Date or a locale.
 *
 * Bucketing by year is not here: the board shares that with /blog and the
 * secrets index, so it lives in `lib/byYear`.
 */

export type BoardMoment = {
  key: string;
  content: string;
  /** The calendar year the line was posted in, already in the site's zone. */
  year: string;
  /** The instant, formatted for the mono column: `2017.07.29 19:28`. */
  time: string;
  /** The same instant as ISO, for `<time dateTime>`. */
  dateTime: string;
  collection: string | null;
  original: boolean;
  attribution: string | null;
  source: string | null;
};

/**
 * An instant as the mono column prints it — `2017.07.29 19:28` — and the year
 * it falls in, both in the given zone. One shape in every language: a
 * timestamp is not prose, and a board that reads `07/29/2017` on one side
 * and `2017/07/29` on the other would be two boards.
 */
export function stampInZone(iso: string, timeZone: string): { year: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const year = get("year");
  return {
    year,
    time: `${year}.${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`,
  };
}

/**
 * The notebooks on the board with how many lines each holds, in order of
 * first appearance — the newest notebook first, since the list is. Lines
 * filed under no notebook are not a notebook.
 */
export function collections<T extends { collection: string | null }>(
  items: T[]
): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.collection) continue;
    counts.set(item.collection, (counts.get(item.collection) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

/** How many lines a card shows before it folds the rest behind "read all".
 *  Exported because the board has to clamp at exactly the number this decides
 *  to fold at — a hard-coded `line-clamp` beside it would be two answers to
 *  one question, and the disagreement would show as a fold button on a card
 *  that was never actually cut off. */
export const FOLD_LINES = 10;

/**
 * Whether a line is long enough to fold. Counted in lines rather than
 * characters because that is what the reader sees: a poem of short lines
 * folds sooner than a paragraph of the same length, and should.
 */
export function shouldFold(content: string): boolean {
  return content.split("\n").length > FOLD_LINES || content.length > 360;
}
