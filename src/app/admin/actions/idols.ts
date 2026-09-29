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
  pixels,
  str,
  validColor,
  validKey,
  validMediaSrc,
} from "@/lib/forms";
import { checkPictures } from "@/lib/films";
import type { IdolPhoto } from "@/lib/idols";
import { TAGS } from "@/lib/server/content";
import {
  invalidate,
  SESSION_EXPIRED,
  KEY_ERROR,
  unknownAsset,
  upsertKeyed,
  type ActionState,
} from "./shared";

/** An idol, whole — as `saveFilm` does for a film, with photographs for stills. */
export async function saveIdol(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const key = str(form, "key");
  if (!validKey(key)) return KEY_ERROR;
  const name = localized(form, "name");
  if (!filled(name)) return { error: "名字不能为空——卡片和页面最大的那行字就是它。" };
  const accent = str(form, "accent") || null;
  if (accent !== null && !validColor(accent)) {
    return { error: "主色要写成 #5b3f8a 这样的六位十六进制。" };
  }
  const draft = str(form, "draft");
  if (draft !== "no" && draft !== "yes") return { error: "草稿只能选 yes 或 no。" };
  const sort = intField(form, "sort", "排序", 0);
  if (!sort.ok) return sort;

  const photos: IdolPhoto[] = [];
  for (const row of formRows(form, "photos")) {
    const photo = {
      id: row.str("id"),
      src: row.str("src"),
      width: pixels(row.str("width")),
      height: pixels(row.str("height")),
      author: row.str("author"),
      licence: row.str("licence"),
      page: row.str("page"),
      title: row.localized("title"),
      meta: row.localized("meta"),
      alt: row.localized("alt"),
    };
    if (!photo.id && !photo.src && !filled(photo.title) && !filled(photo.alt)) continue;
    // Printed as the photograph's credit link, which opens a new tab.
    if (photo.page && !/^https?:\/\/\S+$/.test(photo.page)) {
      return {
        error: `第 ${photos.length + 1} 张照片：出处要写完整的 http(s):// 地址，或者留空。`,
      };
    }
    photos.push(photo);
  }
  const wrong = checkPictures(photos, validMediaSrc);
  if (wrong) return { error: `照片${wrong}` };
  const missing = unknownAsset(
    photos.map((photo) => photo.src),
    `idols/${key}`,
  );
  if (missing) return missing;

  const cover = str(form, "cover") || null;
  if (cover !== null && !photos.some((photo) => photo.id === cover)) {
    return { error: `封面填的是照片的 id，页面上没有「${cover}」。留空就用第一张。` };
  }

  const timeline = formRows(form, "timeline")
    .map((row) => ({
      date: row.str("date"),
      title: row.localized("title"),
      note: row.localized("note"),
    }))
    .filter((line) => line.date || filled(line.title) || filled(line.note));

  const row = {
    key,
    name,
    latin: localized(form, "latin"),
    kicker: localized(form, "kicker"),
    years: str(form, "years"),
    numbers: str(form, "numbers"),
    lede: localized(form, "lede"),
    accent,
    cover,
    galleryKicker: localized(form, "galleryKicker"),
    galleryTitle: localized(form, "galleryTitle"),
    galleryLede: localized(form, "galleryLede"),
    photos,
    timelineKicker: localized(form, "timelineKicker"),
    timelineTitle: localized(form, "timelineTitle"),
    timeline,
    credit: localized(form, "credit"),
    draft: draft === "yes",
    sort: sort.value,
  };

  const exists = await upsertKeyed(schema.idols, row, Boolean(form.get("isNew")));
  if (exists) return exists;

  invalidate(TAGS.idols);
  return { ok: true };
}

export async function deleteIdol(form: FormData): Promise<void> {
  await requireAdmin();
  const key = str(form, "key");
  if (!key) return;
  await db.delete(schema.idols).where(eq(schema.idols.key, key));
  invalidate(TAGS.idols);
}
