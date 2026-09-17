"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { adminSession, requireAdmin } from "@/lib/auth/session";
import { intField, list, localized, str, validKey, validLink } from "@/lib/forms";
import { TAGS } from "@/lib/content";
import { invalidate, SESSION_EXPIRED, KEY_ERROR, linkError, upsertKeyed, type ActionState } from "./shared";

export async function saveWork(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const key = str(form, "key");
  if (!validKey(key)) return KEY_ERROR;
  const year = intField(form, "year", "年份", null);
  if (!year.ok) return year;
  if (year.value === null || year.value < 1990 || year.value > 2100) {
    return { error: "年份填个四位数。" };
  }
  const sort = intField(form, "sort", "排序", 0);
  if (!sort.ok) return sort;
  const url = str(form, "url") || null;
  if (url && !validLink(url)) return linkError("链接");
  const cover = str(form, "cover") || null;
  if (cover && !validLink(cover)) return linkError("封面路径");

  const row = {
    key,
    title: localized(form, "title"),
    description: localized(form, "description"),
    year: year.value,
    cover,
    url,
    tags: list(form, "tags"),
    accent: str(form, "accent") || null,
    sort: sort.value,
  };

  const exists = await upsertKeyed(schema.works, row, Boolean(form.get("isNew")));
  if (exists) return exists;

  invalidate(TAGS.works);
  return { ok: true };
}

export async function deleteWork(form: FormData): Promise<void> {
  await requireAdmin();
  const key = str(form, "key");
  if (!key) return;
  await db.delete(schema.works).where(eq(schema.works.key, key));
  invalidate(TAGS.works);
}
