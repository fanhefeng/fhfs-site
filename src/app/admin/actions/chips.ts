"use server";

import { db } from "@/db";

import * as schema from "@/db/schema";
import { adminSession } from "@/lib/server/auth/session";

import { formRows, oneOf } from "@/lib/forms";

import { TAGS } from "@/lib/server/content";

import { invalidate, SESSION_EXPIRED, type ActionState } from "./shared";

/**
 * Chips, like nav links (`./nav.ts`), are saved as a whole list. Neither has
 * a natural key, both are short and ordered, and both are read as a sequence
 * — so the sequence is what gets edited. The rows' numbering in the form is
 * thrown away and their order becomes `sort`, which makes reordering, adding
 * and removing one operation that cannot leave a gap behind.
 */
export async function saveChips(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const tones = schema.chipToneEnum.enumValues;
  const rows: (typeof schema.chips.$inferInsert)[] = [];
  for (const [index, row] of formRows(form, "chip").entries()) {
    const label = row.localized("label");
    // An emptied pair is how a row is deleted — there is no separate button.
    if (!label.zh && !label.en) continue;
    const tone = row.str("tone");
    if (!oneOf(tones, tone)) return { error: `纸色只能是 ${tones.join(" / ")}。` };
    // Proper nouns read the same either way, so one side may stand for both.
    label.zh ||= label.en;
    label.en ||= label.zh;
    rows.push({ label, tone, sort: index });
  }

  // Delete and insert travel in one `db.batch()` — a single atomic request —
  // so a failed insert cannot leave the table empty. Same contract as
  // scripts/db-import.mts.
  const wipe = db.delete(schema.chips);
  await db.batch(rows.length ? [wipe, db.insert(schema.chips).values(rows)] : [wipe]);

  invalidate(TAGS.chips);
  return { ok: true };
}
