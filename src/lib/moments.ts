/**
 * The board's arithmetic — what 《多的是你不知道的事》 does to its list before
 * drawing it. Pure functions over plain rows: the page formats the instants
 * on the server (`getFormatter`, in the site's zone) and hands the board
 * strings, so nothing here touches a Date or a locale.
 *
 * Bucketing by year is not here: the board shares that with /blog and the
 * secrets index, so it lives in `lib/byYear`.
 */

/**
 * What hangs under a line: a picture, a voice note, a video. `src` is a site
 * path for a file in public/moments/ — app-1-2.jpg there is /moments/app-1-2.jpg,
 * and `asset()` hashes it when the page is drawn — or, for a video too large
 * for the repository, the address in the Blob store. Sizes are the file's
 * own, so the card can reserve the box before the bytes arrive; durations
 * are in seconds.
 */
export type MomentMedia =
  | { kind: "image"; src: string; width: number; height: number }
  | { kind: "audio"; src: string; duration: number }
  | {
      kind: "video";
      src: string;
      /** A frame of the video, in `public/moments/` like a picture. */
      poster: string;
      width: number;
      height: number;
      duration: number;
    };

export type BoardMoment = {
  key: string;
  content: string;
  /** Already resolved to the addresses the browser fetches — hashed for the files in `public/`. */
  media: MomentMedia[];
  /** The calendar year the line was posted in, already in the site's zone. */
  year: string;
  /** The instant, formatted for the mono column: `2017.07.29 19:28`. */
  time: string;
  /** The same instant as ISO, for `<time dateTime>`. */
  dateTime: string;
  collection: string | null;
  original: boolean;
  attribution: string | null;
  pinned: boolean;
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
 * The key a line written in the admin starts out with: `m-20260918-231507`,
 * the second it was opened, in the given zone. A key only has to be unique
 * and never change; nobody should have to invent one to post a sentence, and
 * a second is fine-grained enough that two lines never ask for the same one.
 */
export function momentKey(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `m-${get("year")}${get("month")}${get("day")}-${get("hour")}${get("minute")}${get("second")}`;
}

/**
 * The notebooks on the board with how many lines each holds, in order of
 * first appearance — the newest notebook first, since the list is. Lines
 * filed under no notebook are not a notebook.
 */
export function collections<T extends { collection: string | null }>(
  items: T[],
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

/**
 * The newest line on the board by the clock that has words in it — not the
 * pinned one, which `getMoments` puts first for the board's own sake, and not
 * one that is only a picture: whatever quotes it quotes words. The home
 * page's "now" strip and the grove study's card both ask this.
 */
export function newestSaid<T extends { content: string; postedAt: string }>(
  items: readonly T[],
): T | undefined {
  let newest: T | undefined;
  for (const item of items) {
    if (item.content && (!newest || item.postedAt > newest.postedAt)) newest = item;
  }
  return newest;
}

const MEDIA_NAMES: Record<MomentMedia["kind"], string> = {
  image: "图片",
  audio: "语音",
  video: "视频",
};

const clock = (seconds: number) => {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/**
 * What hangs under a line, in the admin's words: "图片 ×3", "视频 0:30",
 * "语音 1:05 · 图片". A line that is only a file has no words to list it by,
 * and "（只有1 个文件）" read as if the row were empty — this names the file
 * instead. One kind at a time, in the order they first appear; a lone voice
 * note or video carries its length, which is what tells two of them apart.
 */
export function describeMedia(media: readonly MomentMedia[]): string {
  const kinds: MomentMedia["kind"][] = [];
  for (const item of media) if (!kinds.includes(item.kind)) kinds.push(item.kind);
  return kinds
    .map((kind) => {
      const items = media.filter((item) => item.kind === kind);
      const name = MEDIA_NAMES[kind];
      if (items.length > 1) return `${name} ×${items.length}`;
      const only = items[0]!;
      return only.kind === "image" ? name : `${name} ${clock(only.duration)}`;
    })
    .join(" · ");
}

/** One cell of the board's calendar: a week, how many lines it holds, and
 *  the newest of them — where a press on the cell lands. */
export type CalendarWeek = { week: number; count: number; newest: string; start: string };

/** One row of it: a year, and only the weeks something was said in. */
export type CalendarYear = { year: string; weeks: CalendarWeek[] };

/** How many columns a year's row spans on that calendar: its weeks, counted
 *  the same way, the part-weeks at either end included. */
export function weeksInYear(year: number): number {
  const jan1 = Date.UTC(year, 0, 1);
  const lead = (new Date(jan1).getUTCDay() + 6) % 7;
  const days = (Date.UTC(year + 1, 0, 1) - jan1) / 86_400_000;
  return Math.floor((days - 1 + lead) / 7) + 1;
}

/** A calendar day in the given zone, as `YYYY-MM-DD`. */
const dayInZone = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));

/**
 * The years above the board, a row each, cut into weeks: the shape of how
 * much was said when. Weeks run Monday to Sunday and are counted from the
 * one that holds 1 January, so column 0 is the first days of the year and a
 * year spans at most 54 columns (53 whole weeks and a day or two either side).
 * Days are the site's zone's, like every stamp on the board.
 *
 * Every year between the first line and the last gets a row, a silent one
 * included: a year of nothing is part of the shape. Newest year first, as
 * the board below is.
 */
export function momentCalendar(
  items: readonly { key: string; postedAt: string }[],
  timeZone: string,
): CalendarYear[] {
  const byYear = new Map<string, Map<number, CalendarWeek>>();
  // The stamp of each cell's newest line, while counting.
  const newestAt = new Map<CalendarWeek, string>();
  for (const item of items) {
    const day = dayInZone(item.postedAt, timeZone);
    const [y, m, d] = day.split("-").map(Number) as [number, number, number];
    const jan1 = Date.UTC(y, 0, 1);
    // getUTCDay is 0 for Sunday; the week starts on Monday.
    const lead = (new Date(jan1).getUTCDay() + 6) % 7;
    const dayOfYear = (Date.UTC(y, m - 1, d) - jan1) / 86_400_000;
    const week = Math.floor((dayOfYear + lead) / 7);
    const year = String(y);
    let weeks = byYear.get(year);
    if (!weeks) byYear.set(year, (weeks = new Map()));
    const cell = weeks.get(week);
    if (!cell) {
      const start = new Date(jan1 + Math.max(0, week * 7 - lead) * 86_400_000);
      const fresh = { week, count: 1, newest: item.key, start: start.toISOString().slice(0, 10) };
      weeks.set(week, fresh);
      newestAt.set(fresh, item.postedAt);
    } else {
      cell.count += 1;
      if (item.postedAt > newestAt.get(cell)!) {
        cell.newest = item.key;
        newestAt.set(cell, item.postedAt);
      }
    }
  }
  const years = [...byYear.keys()].map(Number);
  if (years.length === 0) return [];
  const rows: CalendarYear[] = [];
  for (let y = Math.max(...years); y >= Math.min(...years); y--) {
    const weeks = byYear.get(String(y));
    rows.push({
      year: String(y),
      weeks: weeks ? [...weeks.values()].sort((a, b) => a.week - b.week) : [],
    });
  }
  return rows;
}
