"use server";

import { redirect } from "next/navigation";
import * as schema from "@/db/schema";
import { adminSession, requireAdmin } from "@/lib/server/auth/session";
import { list } from "@/lib/forms";
import { TAGS } from "@/lib/server/content";
import {
  deleteLongform,
  invalidate,
  readLongform,
  SESSION_EXPIRED,
  upsertLongform,
  type ActionState,
} from "./shared";

export async function savePost(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const doc = await readLongform(form);
  if (!doc.ok) return doc;
  const row = { ...doc.value, tags: list(form, "tags") };

  const isNew = Boolean(form.get("isNew"));
  const problem = await upsertLongform(schema.posts, row, isNew);
  if (problem) return problem;

  invalidate(TAGS.posts);
  // A first save leaves the "new post" page behind: its props are a blank
  // draft, and a saved form resets to its props (`useSaveAction`).
  if (isNew) redirect(`/admin/posts/${row.slug}/${row.locale}`);
  return { ok: true };
}

export async function deletePost(form: FormData): Promise<void> {
  await requireAdmin();
  await deleteLongform(schema.posts, form);
  // A deleted post's page is cached like any other — without this it would go
  // on being served from the edge.
  invalidate(TAGS.posts);
  // The editor this was pressed in is the deleted post's own page; left
  // there, it re-renders into a 404 that reads like the delete went wrong.
  redirect("/admin/posts");
}
