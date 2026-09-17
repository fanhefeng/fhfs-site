"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { adminSession, requireAdmin } from "@/lib/auth/session";
import { list, parseLocale, str, validDate, validKey } from "@/lib/forms";
import { renderMarkdown } from "@/lib/markdown";
import { readingMinutes } from "@/lib/reading";
import { TAGS } from "@/lib/content";
import { invalidate, SESSION_EXPIRED, DATE_ERROR, type ActionState } from "./shared";

export async function savePost(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const slug = str(form, "slug");
  const locale = parseLocale(str(form, "locale"));
  const bodyMd = String(form.get("bodyMd") ?? "");

  if (!validKey(slug)) {
    return { error: "slug 只能用小写字母、数字和连字符。" };
  }
  if (!locale) return { error: "语言只能是 zh 或 en。" };
  if (!str(form, "title")) return { error: "标题不能为空。" };

  const date = str(form, "date");
  if (!validDate(date)) return DATE_ERROR;

  const row = {
    slug,
    locale,
    title: str(form, "title"),
    date,
    summary: str(form, "summary"),
    tags: list(form, "tags"),
    draft: form.get("draft") === "on",
    bodyMd,
    // Rendered once, here, rather than on every read.
    bodyHtml: await renderMarkdown(bodyMd),
    readingMinutes: readingMinutes(bodyMd),
  };

  const isNew = Boolean(form.get("isNew"));
  if (isNew) {
    // A new post must not land on an existing one: the upsert below would
    // silently replace whatever was there, with no way to notice.
    const inserted = await db
      .insert(schema.posts)
      .values(row)
      .onConflictDoNothing({ target: [schema.posts.slug, schema.posts.locale] })
      .returning({ id: schema.posts.id });
    if (!inserted.length) {
      return { error: `slug 已存在：${locale} 下已经有「${slug}」了，换一个或去编辑原文。` };
    }
  } else {
    await db
      .insert(schema.posts)
      .values(row)
      .onConflictDoUpdate({
        target: [schema.posts.slug, schema.posts.locale],
        set: { ...row, updatedAt: new Date() },
      });
  }

  invalidate(TAGS.posts);
  // A first save leaves the "new post" page behind: its props are a blank
  // draft, and React resets the form to props once the action completes.
  if (isNew) redirect(`/admin/posts/${slug}/${locale}`);
  return { ok: true };
}

export async function deletePost(form: FormData): Promise<void> {
  await requireAdmin();
  const slug = str(form, "slug");
  const locale = parseLocale(str(form, "locale"));
  if (!locale) return;
  await db
    .delete(schema.posts)
    .where(and(eq(schema.posts.slug, slug), eq(schema.posts.locale, locale)));
  // A deleted post's page is cached like any other — without this it would go
  // on being served from the edge.
  invalidate(TAGS.posts);
}
