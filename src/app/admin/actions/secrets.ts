"use server";

import { redirect } from "next/navigation";
import * as schema from "@/db/schema";
import { adminSession, requireAdmin } from "@/lib/server/auth/session";
import { intField, oneOf, str, validPlayableSrc } from "@/lib/forms";
import { MEDIA_ORIGIN } from "@/config/csp";
import { TAGS } from "@/lib/server/content";
import {
  deleteLongform,
  invalidate,
  readLongform,
  SESSION_EXPIRED,
  upsertLongform,
  type ActionState,
} from "./shared";

/** A post with two more fields: what kind of piece it is, and for an episode,
 *  where the audio is and how long it runs. */
export async function saveSecret(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const doc = await readLongform(form);
  if (!doc.ok) return doc;

  const kind = str(form, "kind");
  if (!oneOf(schema.secretKindEnum.enumValues, kind)) {
    return { error: "类型只能是 essay（随笔）或 podcast（播客）。" };
  }

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

  const row = { ...doc.value, kind, audio, duration: duration.value };
  const isNew = Boolean(form.get("isNew"));
  const problem = await upsertLongform(schema.secrets, row, isNew);
  if (problem) return problem;

  invalidate(TAGS.secrets);
  if (isNew) redirect(`/admin/secrets/${row.slug}/${row.locale}`);
  return { ok: true };
}

export async function deleteSecret(form: FormData): Promise<void> {
  await requireAdmin();
  await deleteLongform(schema.secrets, form);
  invalidate(TAGS.secrets);
  // Same as deletePost: the page this was pressed on no longer has a row.
  redirect("/admin/secrets");
}
