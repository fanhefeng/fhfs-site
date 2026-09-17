"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { adminSession, requireAdmin } from "@/lib/auth/session";
import { intField, localized, localizedLines, str, validKey } from "@/lib/forms";
import { TAGS } from "@/lib/content";
import { invalidate, SESSION_EXPIRED, KEY_ERROR, upsertKeyed, type ActionState } from "./shared";

export async function saveIntroNode(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const key = str(form, "key");
  if (!validKey(key)) return KEY_ERROR;

  const period = localized(form, "period");
  const sort = intField(form, "sort", "排序", 0);
  if (!sort.ok) return sort;

  const row = {
    key,
    kicker: localized(form, "kicker"),
    title: localized(form, "title"),
    period: period.zh || period.en ? period : null,
    body: localized(form, "body"),
    bullets: localizedLines(form, "bullets"),
    stickerLabel: str(form, "stickerLabel"),
    stickerIcon: str(form, "stickerIcon"),
    sort: sort.value,
  };

  const exists = await upsertKeyed(schema.introNodes, row, Boolean(form.get("isNew")));
  if (exists) return exists;

  invalidate(TAGS.intro);
  return { ok: true };
}

export async function deleteIntroNode(form: FormData): Promise<void> {
  await requireAdmin();
  const key = str(form, "key");
  if (!key) return;
  await db.delete(schema.introNodes).where(eq(schema.introNodes.key, key));
  invalidate(TAGS.intro);
}
