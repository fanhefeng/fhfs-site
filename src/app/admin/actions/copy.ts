"use server";

import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";

import * as schema from "@/db/schema";
import { adminSession, requireAdmin } from "@/lib/auth/session";

import { raw, str } from "@/lib/forms";

import { TAGS } from "@/lib/content";
import { COPY_GROUPS, copyError, namespaceOf } from "@/lib/copy";
import { copyCatalogues } from "@/lib/copyCatalogue";

import { invalidate, SESSION_EXPIRED, type ActionState } from "./shared";

/**
 * Saves one namespace of the copy catalogue.
 *
 * The table is an override layer, so what gets written is the *difference*
 * from `messages/*.json`: a value equal to the file's is stored as null, a row
 * with nothing left to override is deleted, and a cleared field therefore
 * means "put the default back" rather than "leave this blank". Keeping the two
 * languages separately nullable matters for the same reason — a headline
 * edited in Chinese must not pin the English line to whatever the file said on
 * the day it was edited.
 *
 * Two statements at most, not one per row: over the HTTP driver each query is
 * a round trip, and a group of 343 lines would make a save into a wait long
 * enough to wonder whether the button had worked. Both are idempotent, which
 * is what lets them run without a transaction (`src/db/index.ts`).
 */
export async function saveCopy(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const namespace = str(form, "namespace");
  if (!COPY_GROUPS.some((group) => group.id === namespace)) {
    return { error: "不认识这一组文案——回到文案首页重新进来。" };
  }

  const { zh, en } = await copyCatalogues();

  const rows: { key: string; zh: string | null; en: string | null }[] = [];
  const gone: string[] = [];

  for (const key of Object.keys(zh)) {
    if (namespaceOf(key) !== namespace) continue;
    // Only the fields this form actually carries. A key added to the
    // catalogue after the page was opened is left alone rather than read as
    // an empty field and reset to its default.
    if (!form.has(`${key}.zh`) || !form.has(`${key}.en`)) continue;

    const zhDefault = zh[key]!;
    const enDefault = en[key] ?? "";
    // Empty means "no override" — which is the default, not an empty line.
    const zhValue = raw(form, `${key}.zh`) || zhDefault;
    const enValue = raw(form, `${key}.en`) || enDefault;

    for (const [value, fallback, language] of [
      [zhValue, zhDefault, "中文"],
      [enValue, enDefault, "English"],
    ] as const) {
      const problem = copyError(value, fallback);
      if (problem) return { error: `${key} 的${language}文案：${problem}` };
    }

    const zhOverride = zhValue === zhDefault ? null : zhValue;
    const enOverride = enValue === enDefault ? null : enValue;
    if (zhOverride === null && enOverride === null) gone.push(key);
    else rows.push({ key, zh: zhOverride, en: enOverride });
  }

  if (gone.length) await db.delete(schema.copyBlocks).where(inArray(schema.copyBlocks.key, gone));
  if (rows.length) {
    await db
      .insert(schema.copyBlocks)
      .values(rows)
      .onConflictDoUpdate({
        target: schema.copyBlocks.key,
        set: { zh: sql`excluded.zh`, en: sql`excluded.en` },
      });
  }

  invalidate(TAGS.copy);
  return { ok: true };
}

/**
 * Drops rows for keys the catalogue no longer has.
 *
 * They come from a key renamed or deleted in `messages/*.json` while its
 * override stayed behind. `merge()` adds such a row to the catalogue as a key
 * of its own, where nothing reads it — so it is invisible out front, unreachable
 * from any group, and only the copy index can offer to sweep it up.
 */
export async function deleteOrphanCopy(_form: FormData): Promise<void> {
  await requireAdmin();

  const { zh } = await copyCatalogues();
  const rows = await db.select({ key: schema.copyBlocks.key }).from(schema.copyBlocks);
  const orphans = rows.map((row) => row.key).filter((key) => !(key in zh));

  if (orphans.length) {
    await db.delete(schema.copyBlocks).where(inArray(schema.copyBlocks.key, orphans));
  }
  invalidate(TAGS.copy);
}
