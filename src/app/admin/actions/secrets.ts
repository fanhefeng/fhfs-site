"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { adminSession, requireAdmin } from "@/lib/auth/session";
import { intField, parseLocale, str, validDate, validKey, validLink } from "@/lib/forms";
import { renderMarkdown } from "@/lib/markdown";
import { readingMinutes } from "@/lib/reading";
import { TAGS } from "@/lib/content";
import { invalidate, SESSION_EXPIRED, DATE_ERROR, linkError, type ActionState } from "./shared";

export async function saveSecret(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const slug = str(form, "slug");
  const locale = parseLocale(str(form, "locale"));
  const bodyMd = String(form.get("bodyMd") ?? "");

  if (!validKey(slug)) {
    return { error: "slug 只能用小写字母、数字和连字符。" };
  }
  if (!locale) return { error: "语言只能是 zh 或 en。" };
  if (!str(form, "title")) return { error: "标题不能为空。" };

  const kindField = str(form, "kind");
  if (kindField !== "essay" && kindField !== "podcast") {
    return { error: "类型只能是 essay（随笔）或 podcast（播客）。" };
  }
  const kind: "essay" | "podcast" = kindField;
  const date = str(form, "date");
  if (!validDate(date)) return DATE_ERROR;

  // Rendered as the <audio> src — the same belt every href wears.
  const audio = str(form, "audio") || null;
  if (audio && !validLink(audio)) return linkError("音频地址");
  if (kind === "podcast" && !audio) {
    return { error: "播客得有音频地址；没有的话先存成随笔。" };
  }
  const duration = intField(form, "duration", "时长", null);
  if (!duration.ok) return duration;
  if (duration.value !== null && duration.value <= 0) {
    return { error: "时长要填正整数分钟。" };
  }

  const row = {
    slug,
    locale,
    kind,
    title: str(form, "title"),
    date,
    summary: str(form, "summary"),
    audio,
    duration: duration.value,
    draft: form.get("draft") === "on",
    bodyMd,
    bodyHtml: await renderMarkdown(bodyMd),
    readingMinutes: readingMinutes(bodyMd),
  };

  const isNew = Boolean(form.get("isNew"));
  if (isNew) {
    const inserted = await db
      .insert(schema.secrets)
      .values(row)
      .onConflictDoNothing({ target: [schema.secrets.slug, schema.secrets.locale] })
      .returning({ id: schema.secrets.id });
    if (!inserted.length) {
      return { error: `slug 已存在：${locale} 下已经有「${slug}」了，换一个或去编辑原文。` };
    }
  } else {
    await db
      .insert(schema.secrets)
      .values(row)
      .onConflictDoUpdate({
        target: [schema.secrets.slug, schema.secrets.locale],
        set: { ...row, updatedAt: new Date() },
      });
  }

  invalidate(TAGS.secrets);
  if (isNew) redirect(`/admin/secrets/${slug}/${locale}`);
  return { ok: true };
}

export async function deleteSecret(form: FormData): Promise<void> {
  await requireAdmin();
  const slug = str(form, "slug");
  const locale = parseLocale(str(form, "locale"));
  if (!locale) return;
  await db
    .delete(schema.secrets)
    .where(and(eq(schema.secrets.slug, slug), eq(schema.secrets.locale, locale)));
  invalidate(TAGS.secrets);
}
