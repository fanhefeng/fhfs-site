"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { adminSession, requireAdmin } from "@/lib/auth/session";
import { intField, localized, str, validDate, validKey } from "@/lib/forms";
import { TAGS } from "@/lib/content";
import {
  invalidate,
  SESSION_EXPIRED,
  KEY_ERROR,
  DATE_ERROR,
  upsertKeyed,
  type ActionState,
} from "./shared";

export async function saveTimelineEntry(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const key = str(form, "key");
  if (!validKey(key)) return KEY_ERROR;

  const date = str(form, "date");
  const dateLabel = localized(form, "dateLabel");
  const hasLabel = Boolean(dateLabel.zh || dateLabel.en);

  // The column has a CHECK for this, but saying it here means a form error
  // rather than a database one.
  if (!date && !hasLabel) {
    return { error: "日期和占位文字至少要填一个——这一栏不编造日期。" };
  }
  if (date && !validDate(date)) return DATE_ERROR;
  const sort = intField(form, "sort", "排序", 0);
  if (!sort.ok) return sort;

  const row = {
    key,
    version: str(form, "version"),
    date: date || null,
    dateLabel: hasLabel ? dateLabel : null,
    title: localized(form, "title"),
    note: localized(form, "note"),
    sort: sort.value,
  };

  const exists = await upsertKeyed(schema.timelineEntries, row, Boolean(form.get("isNew")));
  if (exists) return exists;

  invalidate(TAGS.timeline);
  return { ok: true };
}

export async function deleteTimelineEntry(form: FormData): Promise<void> {
  await requireAdmin();
  const key = str(form, "key");
  if (!key) return;
  await db.delete(schema.timelineEntries).where(eq(schema.timelineEntries.key, key));
  invalidate(TAGS.timeline);
}
