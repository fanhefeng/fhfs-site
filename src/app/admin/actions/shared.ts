import "server-only";
import { updateTag } from "next/cache";

import { and, eq, type SQL } from "drizzle-orm";

import type { AnyPgColumn, PgInsertValue, PgTable, PgUpdateSetSource } from "drizzle-orm/pg-core";

import { db } from "@/db";

import { TAGS } from "@/lib/server/content";

import { parseLocale, raw, str, validDate, validKey } from "@/lib/forms";

import { renderMarkdown } from "@/lib/server/markdown";

import { readingMinutes } from "@/lib/reading";

import { asset } from "@/lib/asset";

/**
 * Every write the admin can make.
 *
 * Two rules hold across all of them.
 *
 * The session check comes first, always. The proxy's check is optimistic
 * and, more to the point, Server Actions are not routes — this file could be
 * moved or the matcher edited and the proxy would simply stop covering it,
 * with nothing failing loudly. An action that reports to a form checks with
 * `adminSession()` and returns `SESSION_EXPIRED`, so an editor whose eight
 * hours ran out mid-article gets a line beside the save button and keeps the
 * text; a throw would have unmounted the form. (Keeping the text is only half
 * done here: React resets a form whose action *returns*, error or not, and
 * `ui/useSaveAction` is what stops that.) The delete actions have no
 * form state to report to and nothing typed to lose, so they keep the
 * throwing `requireAdmin()`.
 *
 * `updateTag` comes last, and it is `updateTag` rather than `revalidateTag`.
 * The latter serves the stale copy while it refetches, so the person who just
 * pressed save would be the one person still looking at the old text.
 *
 * How a field is read — what counts as a key, a date, a link — lives in
 * `src/lib/forms.ts`, where it is tested.
 */

export function invalidate(...tags: string[]) {
  // `content` is on every getter, so this reaches the pages, the sitemap, the
  // feed and the OG images in one go. The narrower tags are for later, when
  // there is more here than one editor pressing save.
  updateTag(TAGS.content);
  for (const tag of tags) updateTag(tag);
}

export type ActionState = { error?: string; ok?: boolean };

export const SESSION_EXPIRED: ActionState = {
  error: "登录已过期。这一页的内容还在——在新标签页重新登录，回来再按一次保存。",
};

export const KEY_ERROR: ActionState = { error: "key 只能用小写字母、数字和连字符。" };

export const DATE_ERROR: ActionState = {
  error: "日期要写成 YYYY-MM-DD，而且得是真实存在的一天。",
};

export const linkError = (label: string): ActionState => ({
  error: `${label}要写完整的 http(s):// 地址，或以单个 / 开头的站内路径。`,
});

export const existsError = (key: string): ActionState => ({
  error: `key 已存在：已经有「${key}」了，换一个或去编辑原来那条。`,
});

/**
 * The first site path the asset manifest does not know, as the form's error —
 * or null. A file under public/ is reached by its hashed address and
 * `asset()` throws for one it does not know: better here, beside the field,
 * than on the public page. Uploads are Blob addresses and pass untouched.
 * `folder` is where such a file belongs, for the message.
 */
export function unknownAsset(paths: readonly string[], folder: string): ActionState | null {
  for (const path of paths) {
    if (!path.startsWith("/")) continue;
    try {
      asset(path);
    } catch {
      return {
        error: `${path} 不在 assets.gen.json 里——文件放进 public/${folder}/ 后跑 pnpm assets，再存一次；或者直接在这里上传。`,
      };
    }
  }
  return null;
}

/**
 * Whether a row already answers to this address — asked before a "new" form's
 * insert rather than read off the insert's result. The driver resends a
 * statement whose reply broke off on the way back (src/db/index.ts), and the
 * second try of an insert that did land finds its own row: `ON CONFLICT DO
 * NOTHING` returns nothing, which used to read as "the key is taken" and left
 * a saved piece uninvalidated behind an error. Between this look and the
 * insert only a second editor could slip in, and there is one.
 */
async function taken(table: PgTable & { id: AnyPgColumn }, where: SQL | undefined) {
  const [hit] = await db.select({ id: table.id }).from(table).where(where).limit(1);
  return hit !== undefined;
}

/** A table saved by its `key` column — every record list the admin edits
 *  one row at a time. */
export type KeyedTable = PgTable & { key: AnyPgColumn; id: AnyPgColumn };

export const goneError = (key: string): ActionState => ({
  error: `「${key}」已经不在了——可能刚在别处被删掉。刷新这一页再看。`,
});

/**
 * The one save behind every keyed "new / edit" form. `isNew` is the "new"
 * form's promise that it is not overwriting anything: a key that is already
 * there comes back as the exists error instead of silently replacing whatever
 * had it (see `taken` for why that is asked first). The edit form's promise is the
 * opposite — the row exists — so it is an UPDATE by key, and a form left
 * open past a delete gets told rather than quietly resurrecting the row.
 * The columns a table keeps for itself (`id`, `createdAt`) never come from
 * the form, so the row is the whole update — plus a fresh `updatedAt` on the
 * tables that keep one (the board does). Returns the error to hand the form,
 * or null when the row is in.
 */
export async function upsertKeyed<T extends KeyedTable>(
  table: T,
  row: PgInsertValue<T> & { key: string },
  isNew: boolean,
): Promise<ActionState | null> {
  if (isNew) {
    if (await taken(table, eq(table.key, row.key))) return existsError(row.key);
    await db.insert(table).values(row).onConflictDoNothing({ target: table.key });
    return null;
  }
  const set = "updatedAt" in table ? { ...row, updatedAt: new Date() } : row;
  const updated = await db
    .update(table)
    .set(set as PgUpdateSetSource<T>)
    .where(eq(table.key, row.key))
    .returning({ id: table.id });
  return updated.length ? null : goneError(row.key);
}

/** A long-form table — posts and secrets — addressed by `(slug, locale)`. */
export type LongformTable = PgTable & { slug: AnyPgColumn; locale: AnyPgColumn; id: AnyPgColumn };

/** The part every long-form save reads the same way. */
export type LongformFields = {
  slug: string;
  locale: "zh" | "en";
  title: string;
  date: string;
  summary: string;
  draft: boolean;
  bodyMd: string;
  bodyHtml: string;
  readingMinutes: number;
};

/**
 * Reads what a post and a secret share — the address, the title, the date,
 * the draft switch and the body — and renders the body once, here, rather
 * than on every read. The table's own fields (tags; kind, audio, duration)
 * are the action's to add.
 */
export async function readLongform(
  form: FormData,
): Promise<{ ok: true; value: LongformFields } | { ok: false; error: string }> {
  const slug = str(form, "slug");
  if (!validKey(slug)) return { ok: false, error: "slug 只能用小写字母、数字和连字符。" };
  const locale = parseLocale(str(form, "locale"));
  if (!locale) return { ok: false, error: "语言只能是 zh 或 en。" };
  const title = str(form, "title");
  if (!title) return { ok: false, error: "标题不能为空。" };
  const date = str(form, "date");
  if (!validDate(date)) return { ok: false, error: DATE_ERROR.error! };

  const bodyMd = raw(form, "bodyMd");
  return {
    ok: true,
    value: {
      slug,
      locale,
      title,
      date,
      summary: str(form, "summary"),
      draft: form.get("draft") === "on",
      bodyMd,
      bodyHtml: await renderMarkdown(bodyMd),
      readingMinutes: readingMinutes(bodyMd),
    },
  };
}

/**
 * `upsertKeyed` for the long-form tables, keyed by `(slug, locale)`. A new
 * piece must not land on an existing one — an upsert would replace whatever
 * was there with no way to notice — so a conflict comes back as an error.
 * An edit is an UPDATE: the form's promise is that the row exists, and a
 * form left open past a delete in another tab gets told rather than quietly
 * bringing the piece back (published, if draft was off).
 */
export async function upsertLongform<T extends LongformTable>(
  table: T,
  row: PgInsertValue<T> & { slug: string; locale: "zh" | "en" },
  isNew: boolean,
): Promise<ActionState | null> {
  if (isNew) {
    if (await taken(table, and(eq(table.slug, row.slug), eq(table.locale, row.locale)))) {
      return {
        error: `slug 已存在：${row.locale} 下已经有「${row.slug}」了，换一个或去编辑原文。`,
      };
    }
    await db
      .insert(table)
      .values(row)
      .onConflictDoNothing({ target: [table.slug, table.locale] });
    return null;
  }
  const updated = await db
    .update(table)
    .set({ ...row, updatedAt: new Date() } as PgUpdateSetSource<T>)
    .where(and(eq(table.slug, row.slug), eq(table.locale, row.locale)))
    .returning({ id: table.id });
  return updated.length ? null : goneError(`${row.slug}.${row.locale}`);
}

/** Deletes the piece a delete form names, if it names one. */
export async function deleteLongform(table: LongformTable, form: FormData): Promise<void> {
  const slug = str(form, "slug");
  const locale = parseLocale(str(form, "locale"));
  if (!slug || !locale) return;
  await db.delete(table).where(and(eq(table.slug, slug), eq(table.locale, locale)));
}
