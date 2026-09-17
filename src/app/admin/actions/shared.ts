import "server-only";
import { updateTag } from "next/cache";


import { eq } from "drizzle-orm";

import type { AnyPgColumn, PgInsertValue, PgTable, PgUpdateSetSource } from "drizzle-orm/pg-core";


import { db } from "@/db";



import { TAGS } from "@/lib/content";



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
 * text; a throw would have unmounted the form. The delete actions have no
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

/** A table saved by its `key` column — every record list the admin edits
 *  one row at a time. */
export type KeyedTable = PgTable & { key: AnyPgColumn; id: AnyPgColumn };

export const goneError = (key: string): ActionState => ({
  error: `「${key}」已经不在了——可能刚在别处被删掉。刷新这一页再看。`,
});

/**
 * The one save behind every keyed "new / edit" form. `isNew` is the "new"
 * form's promise that it is not overwriting anything: the insert then does
 * nothing on a conflict, and the form gets the exists error back instead of
 * silently replacing whatever had the key. The edit form's promise is the
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
  isNew: boolean
): Promise<ActionState | null> {
  if (isNew) {
    const inserted = await db
      .insert(table)
      .values(row)
      .onConflictDoNothing({ target: table.key })
      .returning({ id: table.id });
    return inserted.length ? null : existsError(row.key);
  }
  const set = "updatedAt" in table ? { ...row, updatedAt: new Date() } : row;
  const updated = await db
    .update(table)
    .set(set as PgUpdateSetSource<T>)
    .where(eq(table.key, row.key))
    .returning({ id: table.id });
  return updated.length ? null : goneError(row.key);
}

/**
 * Chips and nav links are saved as whole lists.
 *
 * Neither has a natural key, both are short and ordered, and both are read as
 * a sequence — so the sequence is what gets edited. Rows arrive numbered by
 * their position in the form; the numbering is thrown away and the order in
 * the list becomes `sort`, which means reordering, adding and removing are all
 * the same operation and none of them can leave a gap behind.
 */
export function collectRows(form: FormData, prefix: string): string[] {
  const indices = new Set<string>();
  for (const key of form.keys()) {
    const match = new RegExp(`^${prefix}\\.(\\d+)\\.`).exec(key);
    if (match) indices.add(match[1]!);
  }
  return [...indices].sort((a, b) => Number(a) - Number(b));
}
