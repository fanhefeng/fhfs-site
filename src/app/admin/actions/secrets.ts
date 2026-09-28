"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { adminSession, requireAdmin } from "@/lib/auth/session";
import {
  intField,
  oneOf,
  parseLocale,
  raw,
  str,
  validDate,
  validKey,
  validPlayableSrc,
} from "@/lib/forms";
import { MEDIA_ORIGIN } from "@/lib/csp";
import { renderMarkdown } from "@/lib/markdown";
import { readingMinutes } from "@/lib/reading";
import { TAGS } from "@/lib/content";
import { invalidate, SESSION_EXPIRED, DATE_ERROR, goneError, type ActionState } from "./shared";

export async function saveSecret(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const slug = str(form, "slug");
  const locale = parseLocale(str(form, "locale"));
  const bodyMd = raw(form, "bodyMd");

  if (!validKey(slug)) {
    return { error: "slug 只能用小写字母、数字和连字符。" };
  }
  if (!locale) return { error: "语言只能是 zh 或 en。" };
  if (!str(form, "title")) return { error: "标题不能为空。" };

  const kind = str(form, "kind");
  if (!oneOf(schema.secretKindEnum.enumValues, kind)) {
    return { error: "类型只能是 essay（随笔）或 podcast（播客）。" };
  }
  const date = str(form, "date");
  if (!validDate(date)) return DATE_ERROR;

  // Rendered as the <audio> src, so it has to be somewhere the CSP lets a
  // page play from — any other host saves fine and then stays silent.
  const audio = str(form, "audio") || null;
  if (audio && !validPlayableSrc(audio)) {
    return {
      error: `音频地址要是站内文件（以单个 / 开头，放在 public/ 下），或 Blob 存储里的文件（${MEDIA_ORIGIN}/…）。别的网站的地址会被页面的安全策略拦下，放不出来。`,
    };
  }
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
    // The edit form's promise is that the row exists — so an UPDATE, not an
    // upsert: a form left open past a delete in another tab gets told, rather
    // than quietly bringing the secret back (published, if draft was off).
    const updated = await db
      .update(schema.secrets)
      .set({ ...row, updatedAt: new Date() })
      .where(and(eq(schema.secrets.slug, slug), eq(schema.secrets.locale, locale)))
      .returning({ id: schema.secrets.id });
    if (!updated.length) return goneError(`${slug}.${locale}`);
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
  // Same as deletePost: the page this was pressed on no longer has a row.
  redirect("/admin/secrets");
}
