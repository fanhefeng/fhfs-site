"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { asset } from "@/lib/asset";
import { adminSession, requireAdmin } from "@/lib/auth/session";
import { parseMedia, parseMomentTime, raw, str, validKey } from "@/lib/forms";
import { TAGS } from "@/lib/content";
import { invalidate, SESSION_EXPIRED, KEY_ERROR, upsertKeyed, type ActionState } from "./shared";

export async function saveMoment(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const key = str(form, "key");
  if (!validKey(key)) return KEY_ERROR;
  const content = raw(form, "content").replace(/\r\n/g, "\n").trim();
  const parsedMedia = parseMedia(raw(form, "media"));
  if (!parsedMedia.ok) return { error: parsedMedia.error };
  const media = parsedMedia.value;
  if (!content && media.length === 0) return { error: "正文和媒体不能都是空的。" };
  // A file under public/ is reached by its hashed address, and asset() throws
  // for one the manifest does not know — better here, beside the field, than
  // on the public page.
  for (const item of media) {
    for (const path of item.kind === "video" ? [item.src, item.poster] : [item.src]) {
      if (!path.startsWith("/")) continue;
      try {
        asset(path);
      } catch {
        return {
          error: `${path} 不在 assets.gen.json 里——文件放进 public/moments/ 后跑 pnpm assets，再存一次。`,
        };
      }
    }
  }
  const postedAt = parseMomentTime(str(form, "postedAt"));
  if (!postedAt) {
    return { error: "时间要写成 YYYY-MM-DD HH:mm（上海时间），而且得是真实存在的一刻。" };
  }
  const original = str(form, "original");
  if (original !== "yes" && original !== "no") {
    return { error: "原创只能选 yes 或 no。" };
  }
  const draft = str(form, "draft");
  if (draft !== "no" && draft !== "yes") {
    return { error: "草稿只能选 yes 或 no。" };
  }
  const pinned = str(form, "pinned");
  if (pinned !== "no" && pinned !== "yes") {
    return { error: "置顶只能选 yes 或 no。" };
  }

  const row = {
    key,
    content,
    postedAt,
    collection: str(form, "collection") || null,
    original: original === "yes",
    attribution: str(form, "attribution") || null,
    source: str(form, "source") || null,
    mood: str(form, "mood") || null,
    media,
    draft: draft === "yes",
    pinned: pinned === "yes",
  };

  const exists = await upsertKeyed(schema.moments, row, Boolean(form.get("isNew")));
  if (exists) return exists;

  invalidate(TAGS.moments);
  return { ok: true };
}

export async function deleteMoment(form: FormData): Promise<void> {
  await requireAdmin();
  const key = str(form, "key");
  if (!key) return;
  await db.delete(schema.moments).where(eq(schema.moments.key, key));
  invalidate(TAGS.moments);
}
