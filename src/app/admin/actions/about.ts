"use server";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { adminSession } from "@/lib/server/auth/session";
import { parseLocale, raw, str } from "@/lib/forms";
import { renderMarkdown } from "@/lib/server/markdown";
import { TAGS } from "@/lib/server/content";
import { invalidate, SESSION_EXPIRED, type ActionState } from "./shared";
import { saveWithUploads } from "../media/storage";

export async function saveAbout(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const locale = parseLocale(str(form, "locale"));
  if (!locale) return { error: "语言只能是 zh 或 en。" };
  const bodyMd = raw(form, "bodyMd");

  const row = {
    locale,
    title: str(form, "title"),
    bodyMd,
    bodyHtml: await renderMarkdown(bodyMd),
  };

  const saved = await saveWithUploads(
    schema.abouts,
    db
      .insert(schema.abouts)
      .values(row)
      .onConflictDoUpdate({
        target: schema.abouts.locale,
        set: { ...row, updatedAt: new Date() },
      })
      .returning({ locale: schema.abouts.locale }),
    row,
  );
  if (saved.error) return { error: saved.error };

  invalidate(TAGS.about);
  return { ok: true };
}
