import type { Localized } from "@/db/schema";

/**
 * The films room's shapes — what a row of the `films` table holds beyond its
 * plain columns, and the rules the admin checks it by. Pure: the pages, the
 * admin's form and the tests all read it.
 *
 * Until 2026-09-29 the films were code (`components/films/entries.ts` and a
 * stills file per film) with their copy under `films.<slug>` in the
 * catalogues. They are rows now, edited under 电影 in /admin; what stayed in
 * the catalogues is the room's own chrome — the labels of the facts, the
 * viewer's buttons, the index page's lines.
 */

/** How much of the six-column wall a print takes on a desktop grid. */
export const STILL_SPANS = ["wide", "tall", "one", "full"] as const;
export type StillSpan = (typeof STILL_SPANS)[number];

/**
 * The frame every print on a wall is cut to. The 大话西游 stills are video
 * frames (16:9); the 不能说的秘密 ones are the production photographs, shot
 * on a stills camera (3:2). La La Land's wall mixes the two and is cut to
 * 16:9, the frame of the six publicity stills that hung under the neon sign
 * first. The upright and the panoramic crops are the same for both.
 */
export const FILM_RATIOS = ["video", "photo"] as const;
export type FilmRatio = (typeof FILM_RATIOS)[number];

/** The rows of the facts strip, in order — labels under `films.facts.<key>`. */
export const FILM_FACTS = ["director", "cast", "released", "runtime", "rating"] as const;
export type FilmFact = (typeof FILM_FACTS)[number];
export type FilmFacts = Record<FilmFact, Localized>;

/**
 * A print on a film's wall. `src` is a site path for a file in
 * `public/films/<film>/` — hashed by `asset()` when the page renders — or an
 * upload's address in the media site. The size is the file's own, so the wall
 * reserves the box before the bytes arrive.
 */
export type FilmStill = {
  /** Unique on its wall: the film's `cover` names a still by it. */
  id: string;
  src: string;
  width: number;
  height: number;
  span: StillSpan;
  /** `object-position` for a print cropped away from its frame. */
  focus?: string;
  title: Localized;
  meta: Localized;
  alt: Localized;
};

/** A part of a film released in several — 大话西游's two. */
export type FilmPart = { title: Localized; meta: Localized; note: Localized };

/** A line the page quotes, and who says it where. */
export type FilmLine = { text: Localized; meta: Localized };

/** The picture on an index card — a film's still or an idol's photograph,
 *  named by the row's `cover`, and the first one if that id is gone. */
export const coverOf = <T extends { id: string }>(
  pictures: readonly T[],
  cover: string | null,
): T | undefined => pictures.find((picture) => picture.id === cover) ?? pictures[0];

/** What a picture's id may look like: the stills that came from code were
 *  named in camelCase (`monkeyKing`), the later ones in kebab-case. */
export const PICTURE_ID = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

/**
 * What is wrong with a wall of pictures, or null. Ids unique and well-formed
 * (the cover is found by one), sizes real (the box is reserved from them),
 * and an address the page can load — `validSrc` is the admin's own test,
 * passed in so this stays free of the manifest.
 */
export function checkPictures(
  pictures: readonly { id: string; src: string; width: number; height: number }[],
  validSrc: (src: string) => boolean,
): string | null {
  const seen = new Set<string>();
  for (const [i, picture] of pictures.entries()) {
    const at = `第 ${i + 1} 张`;
    if (!PICTURE_ID.test(picture.id)) return `${at}：id 只能用字母、数字和连字符。`;
    if (seen.has(picture.id)) return `${at}：id「${picture.id}」重复了，同一面墙上每张要不一样。`;
    seen.add(picture.id);
    if (!validSrc(picture.src)) {
      return `${at}：地址要是站内文件（以单个 / 开头），或媒体站上的文件。`;
    }
    if (!(picture.width > 0 && picture.height > 0)) {
      return `${at}：宽和高要填图片本身的像素数。`;
    }
  }
  return null;
}
