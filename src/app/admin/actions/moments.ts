"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { site } from "@/config/site";
import { momentKey, type MomentMedia } from "@/lib/moments";
import { adminSession, requireAdmin } from "@/lib/server/auth/session";
import { parseMedia, parseMomentTime, raw, str, validKey } from "@/lib/forms";
import { TAGS } from "@/lib/server/content";
import {
  invalidate,
  SESSION_EXPIRED,
  KEY_ERROR,
  unknownAsset,
  upsertKeyed,
  type ActionState,
} from "./shared";

/** Every site path a line's files are reached by — see `unknownAsset`. */
const mediaPaths = (media: MomentMedia[]) =>
  media.flatMap((item) => (item.kind === "video" ? [item.src, item.poster] : [item.src]));

export async function saveMoment(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const key = str(form, "key");
  if (!validKey(key)) return KEY_ERROR;
  const content = raw(form, "content").replace(/\r\n/g, "\n").trim();
  const parsedMedia = parseMedia(raw(form, "media"));
  if (!parsedMedia.ok) return { error: parsedMedia.error };
  const media = parsedMedia.value;
  if (!content && media.length === 0) return { error: "正文和媒体不能都是空的。" };
  const missing = unknownAsset(mediaPaths(media), "moments");
  if (missing) return missing;
  const postedAt = parseMomentTime(str(form, "postedAt"));
  if (!postedAt) {
    return { error: "时间要写成 YYYY-MM-DD HH:mm（上海时间），而且得是真实存在的一刻。" };
  }
  const original = str(form, "original");
  if (original !== "yes" && original !== "no") {
    return { error: "原创只能选 yes 或 no。" };
  }
  const draft = str(form, "draft");
  if (draft !== "no" && draft !== "yes") {
    return { error: "草稿只能选 yes 或 no。" };
  }
  const pinned = str(form, "pinned");
  if (pinned !== "no" && pinned !== "yes") {
    return { error: "置顶只能选 yes 或 no。" };
  }

  const row = {
    key,
    content,
    postedAt,
    collection: str(form, "collection") || null,
    original: original === "yes",
    attribution: str(form, "attribution") || null,
    source: str(form, "source") || null,
    mood: str(form, "mood") || null,
    media,
    draft: draft === "yes",
    pinned: pinned === "yes",
  };

  const exists = await upsertKeyed(schema.moments, row, Boolean(form.get("isNew")));
  if (exists) return exists;

  invalidate(TAGS.moments);
  return { ok: true };
}

/**
 * The quick composer's save (`/admin`, `QuickMoment`): words and files, and
 * nothing else to decide. The key and the time are this second's, in the
 * site's zone, taken here rather than when the page was opened — a line typed
 * on a phone over lunch is posted at the moment it is sent. Written by the
 * author and public, as the full form's defaults are. Refuses an existing key
 * rather than overwrite it: two sends in one second are a double tap.
 */
export async function postMoment(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const content = raw(form, "content").replace(/\r\n/g, "\n").trim();
  const parsedMedia = parseMedia(raw(form, "media"));
  if (!parsedMedia.ok) return { error: parsedMedia.error };
  const media = parsedMedia.value;
  if (!content && media.length === 0) return { error: "写点什么再发。" };
  const missing = unknownAsset(mediaPaths(media), "moments");
  if (missing) return missing;
  const postedAt = new Date();
  const row = {
    key: momentKey(postedAt.toISOString(), site.timeZone),
    content,
    postedAt,
    collection: null,
    original: true,
    attribution: null,
    source: null,
    mood: null,
    media,
    draft: false,
    pinned: false,
  };
  const exists = await upsertKeyed(schema.moments, row, true);
  if (exists) return { error: "刚刚已经发过一条了，等一秒再发。" };

  invalidate(TAGS.moments);
  return { ok: true };
}

export async function deleteMoment(form: FormData): Promise<void> {
  await requireAdmin();
  const key = str(form, "key");
  if (!key) return;
  await db.delete(schema.moments).where(eq(schema.moments.key, key));
  invalidate(TAGS.moments);
}
