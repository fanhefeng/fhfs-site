"use server";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { adminSession } from "@/lib/auth/session";
import { parseLocale, str } from "@/lib/forms";
import { renderMarkdown } from "@/lib/markdown";
import { TAGS } from "@/lib/content";
import { invalidate, SESSION_EXPIRED, type ActionState } from "./shared";

export async function saveAbout(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const locale = parseLocale(str(form, "locale"));
  if (!locale) return { error: "语言只能是 zh 或 en。" };
  const bodyMd = String(form.get("bodyMd") ?? "");

  const row = {
    locale,
    title: str(form, "title"),
    bodyMd,
    bodyHtml: await renderMarkdown(bodyMd),
  };

  await db
    .insert(schema.abouts)
    .values(row)
    .onConflictDoUpdate({
      target: schema.abouts.locale,
      set: { ...row, updatedAt: new Date() },
    });

  invalidate(TAGS.about);
  return { ok: true };
}
