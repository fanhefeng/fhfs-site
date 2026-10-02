"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { adminSession, requireAdmin } from "@/lib/server/auth/session";
import {
  filled,
  formRows,
  intField,
  localized,
  localizedLines,
  oneOf,
  pixels,
  str,
  validColor,
  validKey,
  validMediaSrc,
} from "@/lib/forms";
import {
  checkPictures,
  FILM_FACTS,
  FILM_RATIOS,
  STILL_SPANS,
  type FilmFacts,
  type FilmStill,
} from "@/lib/films";
import { TRACK_IDS } from "@/lib/tracks";
import { TAGS } from "@/lib/server/content";
import {
  invalidate,
  SESSION_EXPIRED,
  KEY_ERROR,
  unknownAsset,
  upsertKeyed,
  type ActionState,
} from "./shared";

/**
 * A film, whole: the title, the facts, the story, the lines and the wall of
 * stills, as `/admin/films` sends them. The repeated groups come
 * in as rows (`formRows`); a row left entirely empty is dropped rather than
 * refused, which is how one is removed without a button having been pressed.
 */
export async function saveFilm(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const key = str(form, "key");
  if (!validKey(key)) return KEY_ERROR;
  const title = localized(form, "title");
  if (!filled(title)) return { error: "片名不能为空——索引卡和页面最大的那行字就是它。" };

  const track = str(form, "track") || null;
  if (track !== null && !oneOf(TRACK_IDS, track)) {
    return { error: `唱片只能是 ${TRACK_IDS.join(" / ")}，或者不放。` };
  }
  const ratio = str(form, "ratio");
  if (!oneOf(FILM_RATIOS, ratio)) return { error: `画幅只能是 ${FILM_RATIOS.join(" / ")}。` };
  const accent = str(form, "accent") || null;
  if (accent !== null && !validColor(accent)) {
    return { error: "主色要写成 #5b3f8a 这样的六位十六进制。" };
  }
  const draft = str(form, "draft");
  if (draft !== "no" && draft !== "yes") return { error: "草稿只能选 yes 或 no。" };
  const sort = intField(form, "sort", "排序", 0);
  if (!sort.ok) return sort;

  const stills: FilmStill[] = [];
  for (const row of formRows(form, "stills")) {
    const still = {
      id: row.str("id"),
      src: row.str("src"),
      width: pixels(row.str("width")),
      height: pixels(row.str("height")),
      span: row.str("span"),
      title: row.localized("title"),
      meta: row.localized("meta"),
      alt: row.localized("alt"),
    };
    if (!still.id && !still.src && !filled(still.title) && !filled(still.alt)) continue;
    if (!oneOf(STILL_SPANS, still.span)) {
      return { error: `第 ${stills.length + 1} 张剧照：宽度只能是 ${STILL_SPANS.join(" / ")}。` };
    }
    const focus = row.str("focus");
    stills.push({ ...still, span: still.span, ...(focus ? { focus } : {}) });
  }
  const wrong = checkPictures(stills, validMediaSrc);
  if (wrong) return { error: `剧照${wrong}` };
  const missing = unknownAsset(
    stills.map((still) => still.src),
    `films/${key}`,
  );
  if (missing) return missing;

  const cover = str(form, "cover") || null;
  if (cover !== null && !stills.some((still) => still.id === cover)) {
    return { error: `封面填的是剧照的 id，墙上没有「${cover}」。留空就用第一张。` };
  }

  const facts = Object.fromEntries(
    FILM_FACTS.map((fact) => [fact, localized(form, `facts.${fact}`)]),
  ) as FilmFacts;
  const lines = formRows(form, "lines")
    .map((row) => ({ text: row.localized("text"), meta: row.localized("meta") }))
    .filter((line) => filled(line.text) || filled(line.meta));

  const row = {
    key,
    title,
    subtitle: localized(form, "subtitle"),
    latin: localized(form, "latin"),
    year: str(form, "year"),
    track,
    accent,
    ratio,
    cover,
    facts,
    story: localizedLines(form, "story"),
    lines,
    stills,
    credit: localized(form, "credit"),
    draft: draft === "yes",
    sort: sort.value,
  };

  const exists = await upsertKeyed(schema.films, row, Boolean(form.get("isNew")));
  if (exists) return exists;

  invalidate(TAGS.films);
  return { ok: true };
}

export async function deleteFilm(form: FormData): Promise<void> {
  await requireAdmin();
  const key = str(form, "key");
  if (!key) return;
  await db.delete(schema.films).where(eq(schema.films.key, key));
  invalidate(TAGS.films);
}
