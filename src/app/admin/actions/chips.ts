"use server";

import { db } from "@/db";

import * as schema from "@/db/schema";
import { adminSession } from "@/lib/auth/session";

import { str } from "@/lib/forms";

import { TAGS } from "@/lib/content";

import { invalidate, SESSION_EXPIRED, collectRows, type ActionState } from "./shared";

export async function saveChips(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const rows = collectRows(form, "chip")
    .map((i, index) => ({
      label: {
        zh: str(form, `chip.${i}.label.zh`),
        en: str(form, `chip.${i}.label.en`),
      },
      tone: str(form, `chip.${i}.tone`) as "paper" | "ink" | "accent",
      sort: index,
    }))
    // An emptied pair is how a row is deleted — there is no separate button.
    .filter((row) => row.label.zh || row.label.en);

  for (const row of rows) {
    if (!["paper", "ink", "accent"].includes(row.tone)) {
      return { error: "纸色只能是 paper / ink / accent。" };
    }
    // Proper nouns read the same either way, so one side may stand for both.
    row.label.zh ||= row.label.en;
    row.label.en ||= row.label.zh;
  }

  // Delete and insert travel in one `db.batch()` — a single atomic request —
  // so a failed insert cannot leave the table empty. Same contract as
  // scripts/db-import.mts.
  const wipe = db.delete(schema.chips);
  await db.batch(rows.length ? [wipe, db.insert(schema.chips).values(rows)] : [wipe]);

  invalidate(TAGS.chips);
  return { ok: true };
}
