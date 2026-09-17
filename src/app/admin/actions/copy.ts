"use server";

import { sql } from "drizzle-orm";
import { db } from "@/db";

import * as schema from "@/db/schema";
import { adminSession } from "@/lib/auth/session";

import { raw, str } from "@/lib/forms";

import { TAGS } from "@/lib/content";

import { invalidate, SESSION_EXPIRED, type ActionState } from "./shared";


/**
 * Saves the copy table in one go — it is edited as one page, because that is
 * how you notice that two lines have to rhyme.
 */
export async function saveCopy(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const rows = await db
    .select({ key: schema.copyBlocks.key })
    .from(schema.copyBlocks);

  const kinetic = str(form, "home.heroKineticWord.zh");
  const enKinetic = str(form, "home.heroKineticWord.en");
  const zhLines = [
    str(form, "home.heroLine1.zh"),
    str(form, "home.heroLine2.zh"),
    str(form, "home.heroSub.zh"),
  ].join(" ");
  const enLines = [
    str(form, "home.heroLine1.en"),
    str(form, "home.heroLine2.en"),
    str(form, "home.heroSub.en"),
  ].join(" ");

  // The home page looks for this word inside the three hero lines to attach
  // the light-up animation. No match, no animation — and nothing would say so.
  if (kinetic && !zhLines.includes(kinetic)) {
    return { error: `中文 hero 里找不到「${kinetic}」，插电动画会失效。` };
  }
  if (enKinetic && !enLines.includes(enKinetic)) {
    return { error: `English hero does not contain "${enKinetic}" — the light-up animation would not run.` };
  }

  // One statement, not sixty-seven. The HTTP driver spends a round trip per
  // query, so updating each row separately turned a save into a wait long
  // enough to wonder whether the button had worked.
  //
  // Only rows the form actually carries: a key added to the table after the
  // page was opened would otherwise be overwritten with two empty strings.
  const values = rows
    .filter(({ key }) => form.has(`${key}.zh`) && form.has(`${key}.en`))
    .map(
      ({ key }) => sql`(${key}, ${raw(form, `${key}.zh`)}, ${raw(form, `${key}.en`)})`
    );
  if (values.length) {
    await db.execute(sql`
      UPDATE copy_blocks AS c
      SET zh = v.zh, en = v.en
      FROM (VALUES ${sql.join(values, sql`, `)}) AS v(key, zh, en)
      WHERE c.key = v.key
    `);
  }

  invalidate(TAGS.copy);
  return { ok: true };
}
