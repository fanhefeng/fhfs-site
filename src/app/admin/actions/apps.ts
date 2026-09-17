"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";

import * as schema from "@/db/schema";
import { adminSession, requireAdmin } from "@/lib/auth/session";

import { intField, list, localized, str, validKey, validLink } from "@/lib/forms";

import { TAGS } from "@/lib/content";

import {
  invalidate,
  SESSION_EXPIRED,
  KEY_ERROR,
  linkError,
  upsertKeyed,
  type ActionState,
} from "./shared";

export async function saveApp(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const key = str(form, "key");
  if (!validKey(key)) return KEY_ERROR;

  const category = str(form, "category");
  if (!["desktop", "tool", "game", "website"].includes(category)) {
    return { error: "分类只能是 desktop / tool / game / website。" };
  }

  // Rendered as the card's outbound link on three pages.
  const website = str(form, "website");
  if (!validLink(website)) return linkError("网址");

  // "owner/name" — src/lib/github.ts builds an API URL out of it, so it has
  // to be exactly two path segments and nothing that could escape them.
  const repo = str(form, "repo") || null;
  if (repo && !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return { error: "仓库要写成 owner/name，比如 fanhefeng/fhfs-site。" };
  }

  const hue = intField(form, "hue", "色相", null);
  if (!hue.ok) return hue;
  const sort = intField(form, "sort", "排序", 0);
  if (!sort.ok) return sort;

  const row = {
    key,
    name: str(form, "name"),
    tagline: localized(form, "tagline"),
    description: localized(form, "description"),
    category: category as "desktop" | "tool" | "game" | "website",
    website,
    repo,
    platforms: list(form, "platforms"),
    accent: str(form, "accent") || null,
    hue: hue.value,
    sort: sort.value,
  };

  const exists = await upsertKeyed(schema.apps, row, Boolean(form.get("isNew")));
  if (exists) return exists;

  invalidate(TAGS.apps);
  return { ok: true };
}

export async function deleteApp(form: FormData): Promise<void> {
  await requireAdmin();
  const key = str(form, "key");
  if (!key) return;
  await db.delete(schema.apps).where(eq(schema.apps.key, key));
  invalidate(TAGS.apps);
}
