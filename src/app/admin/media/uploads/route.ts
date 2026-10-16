import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaUploads } from "@/db/schema";
import { MEDIA_ORIGIN } from "@/config/csp";
import { adminSession } from "@/lib/server/auth/session";
import {
  signUpload,
  uploadFile,
  UPLOAD_ID,
  UPLOAD_PREFIX,
  UPLOAD_TOKEN_SECONDS,
} from "@/lib/mediaUploads";
import { cancelUploads, uploadSecret, uploadServiceOrigin } from "../storage";

export async function POST(request: Request) {
  if (!(await adminSession()))
    return Response.json({ error: "登录已过期，请在新标签页重新登录。" }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new Response(null, { status: 403 });
  try {
    const input = (await request.json()) as {
      action?: string;
      id?: string;
      batch?: string;
      name?: string;
      size?: number;
    };
    if (!UPLOAD_ID.test(input.batch ?? "") || (input.id !== undefined && !UPLOAD_ID.test(input.id)))
      return new Response(null, { status: 400 });
    const batch = input.batch!;
    if (input.action === "cancel") {
      const removed = await cancelUploads(batch, input.id);
      return Response.json({ ok: true, removed });
    }
    if (input.action === "finish" && input.id) {
      const [row] = await db
        .select()
        .from(mediaUploads)
        .where(and(eq(mediaUploads.id, input.id), eq(mediaUploads.batch, batch)));
      if (!row || !["uploading", "ready"].includes(row.state))
        return Response.json({ error: "这次上传已取消，请重新选择文件。" }, { status: 409 });
      const response = await fetch(uploadServiceOrigin() + row.path, {
        method: "HEAD",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok || Number(response.headers.get("content-length")) !== row.size)
        return Response.json({ error: "文件仍在同步，请稍后重试。" }, { status: 425 });
      const ready = await db
        .update(mediaUploads)
        .set({ state: "ready" })
        .where(and(eq(mediaUploads.id, row.id), eq(mediaUploads.state, "uploading")))
        .returning();
      if (row.state !== "ready" && !ready.length)
        return Response.json({ error: "这次上传已取消。" }, { status: 409 });
      return Response.json({ ok: true });
    }
    if (
      input.action !== "start" ||
      !input.id ||
      typeof input.name !== "string" ||
      typeof input.size !== "number"
    )
      return new Response(null, { status: 400 });
    const format = uploadFile(input.name, input.size);
    if (!format.ok) return Response.json({ error: format.error }, { status: 400 });
    const secret = uploadSecret();
    const path = `${UPLOAD_PREFIX}${input.id}.${format.extension}`;
    await db
      .insert(mediaUploads)
      .values({
        id: input.id,
        batch,
        path,
        size: input.size,
        contentType: format.type,
        state: "uploading",
      })
      .onConflictDoNothing();
    const [row] = await db.select().from(mediaUploads).where(eq(mediaUploads.id, input.id));
    if (
      !row ||
      row.batch !== batch ||
      row.path !== path ||
      row.size !== input.size ||
      row.state !== "uploading"
    )
      return Response.json({ error: "这次上传已取消或已完成，请重新选择文件。" }, { status: 409 });
    const token = await signUpload(
      {
        path,
        size: row.size,
        type: format.type,
        origin: new URL(request.url).origin,
        expires: Math.floor(Date.now() / 1000) + UPLOAD_TOKEN_SECONDS,
      },
      secret,
    );
    return Response.json({ token, src: MEDIA_ORIGIN + path, type: format.type });
  } catch (error) {
    console.error("Media upload operation failed", error instanceof Error ? error.name : "unknown");
    return Response.json({ error: "上传或清理未完成，请稍后重试。" }, { status: 503 });
  }
}
