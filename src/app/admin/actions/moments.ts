"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { adminSession, requireAdmin } from "@/lib/auth/session";
import { raw, str, validDate, validKey } from "@/lib/forms";
import { TAGS } from "@/lib/content";
import { invalidate, SESSION_EXPIRED, KEY_ERROR, upsertKeyed, type ActionState } from "./shared";

/**
 * A moment is stamped to the minute, in the site's zone: `2026-09-07 23:15`
 * as the author would write it, stored as the instant that is.
 */
const MOMENT_TIME_RE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})$/;

function parseMomentTime(value: string): Date | null {
  const match = MOMENT_TIME_RE.exec(value);
  if (!match) return null;
  const [, day, hour, minute] = match;
  if (!validDate(day!) || Number(hour) > 23 || Number(minute) > 59) return null;
  // The site's zone is UTC+8 without daylight saving, so the offset is a constant.
  return new Date(`${day}T${hour}:${minute}:00+08:00`);
}

export async function saveMoment(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const key = str(form, "key");
  if (!validKey(key)) return KEY_ERROR;
  const content = raw(form, "content").replace(/\r\n/g, "\n").trim();
  if (!content) return { error: "正文不能为空。" };
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

  const row = {
    key,
    content,
    postedAt,
    collection: str(form, "collection") || null,
    original: original === "yes",
    attribution: str(form, "attribution") || null,
    source: str(form, "source") || null,
    mood: str(form, "mood") || null,
    draft: draft === "yes",
  };

  const exists = await upsertKeyed(schema.moments, row, Boolean(form.get("isNew")));
  if (exists) return exists;

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
