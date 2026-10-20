import type { PgTable } from "drizzle-orm/pg-core";
import { auditedExecute } from "../backup";
import "server-only";
import { and, eq, inArray, lt, or, sql, type SQLWrapper } from "drizzle-orm";
import { db } from "@/db";
import { mediaUploads } from "@/db/schema";
import { MEDIA_ORIGIN } from "@/config/csp";
import { UPLOAD_LIFETIME_MS, UPLOAD_CLEANUP_GRACE_MS, uploadIds } from "@/lib/mediaUploads";

export function uploadSecret(): string {
  const secret = process.env.MEDIA_UPLOAD_SECRET;
  if (!secret || secret.length < 32) throw new Error("后台上传尚未配置。");
  return secret;
}

/** Only the guarded E2E process can point writes at a local KV emulator. */
export function uploadServiceOrigin() {
  return process.env.E2E_BUILD === "true" && process.env.E2E_MEDIA_ORIGIN
    ? process.env.E2E_MEDIA_ORIGIN
    : MEDIA_ORIGIN;
}

/** The content write and the lease retention share one statement and row locks.
 * A cancellation either wins before it (save rolls back), or observes retained
 * files afterwards. A failed content write rolls back its retention as well.
 */
export async function saveWithUploads(table: PgTable, query: SQLWrapper, row: unknown) {
  const ids = uploadIds(row);
  if (!ids.length) return { rows: (await auditedExecute(table, query)).rows };
  try {
    const rows = await auditedExecute(
      table,
      sql`
      WITH upload_locks AS MATERIALIZED (
        SELECT id FROM ${mediaUploads}
        WHERE id IN (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `,
        )})
          AND state IN ('ready', 'retained') FOR UPDATE
      ), saved AS (${query.getSQL()}), retained AS (
        UPDATE ${mediaUploads} SET state = 'retained'
        WHERE id IN (SELECT id FROM upload_locks) AND EXISTS (SELECT 1 FROM saved)
        RETURNING id
      )
      SELECT saved.*,
        1 / CASE WHEN (SELECT count(*) FROM upload_locks) = ${ids.length} THEN 1 ELSE 0 END AS upload_guard,
        (SELECT count(*) FROM retained) AS upload_count
      FROM saved
    `,
    );
    return { rows: rows.rows };
  } catch (error) {
    // Only this guard divides. Neon/Drizzle may wrap the Postgres error.
    const cause = error instanceof Error && "cause" in error ? error.cause : error;
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "22012") {
      return { error: "有文件尚未上传完成或已被清理，请重新上传后再保存。" };
    }
    throw error;
  }
}

async function removeFiles(rows: (typeof mediaUploads.$inferSelect)[]) {
  let removed = 0;
  for (const row of rows) {
    const response = await fetch(`${uploadServiceOrigin()}/_uploads${row.path}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${uploadSecret()}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("文件清理未完成，稍后会自动重试。");
    await db
      .update(mediaUploads)
      .set({
        state:
          row.discardedAt && row.discardedAt.getTime() < Date.now() - UPLOAD_CLEANUP_GRACE_MS
            ? "expired"
            : "deleted",
      })
      .where(and(eq(mediaUploads.id, row.id), eq(mediaUploads.state, "deleting")));
    removed++;
  }
  // Keep tombstones beyond the upload permit's life. An upload already in
  // flight when cancelled can finish late; the next sweep deletes it again.
  const old = rows.filter(
    (row) => row.discardedAt && row.discardedAt.getTime() < Date.now() - UPLOAD_LIFETIME_MS,
  );
  if (old.length)
    await db.delete(mediaUploads).where(
      and(
        inArray(
          mediaUploads.id,
          old.map((row) => row.id),
        ),
        eq(mediaUploads.state, "expired"),
      ),
    );
  return removed;
}

export async function cancelUploads(batch: string, id?: string) {
  const rows = await db
    .update(mediaUploads)
    .set({ state: "deleting", discardedAt: sql`coalesce(${mediaUploads.discardedAt}, now())` })
    .where(
      and(
        eq(mediaUploads.batch, batch),
        id ? eq(mediaUploads.id, id) : undefined,
        inArray(mediaUploads.state, ["uploading", "ready", "deleting"]),
      ),
    )
    .returning();
  return removeFiles(rows);
}

export async function sweepUploads() {
  await db
    .delete(mediaUploads)
    .where(
      and(
        eq(mediaUploads.state, "expired"),
        lt(mediaUploads.discardedAt, new Date(Date.now() - UPLOAD_LIFETIME_MS)),
      ),
    );
  const rows = await db
    .update(mediaUploads)
    .set({ state: "deleting", discardedAt: sql`coalesce(${mediaUploads.discardedAt}, now())` })
    .where(
      or(
        eq(mediaUploads.state, "deleting"),
        and(
          eq(mediaUploads.state, "deleted"),
          lt(mediaUploads.discardedAt, new Date(Date.now() - UPLOAD_CLEANUP_GRACE_MS)),
        ),
        and(
          inArray(mediaUploads.state, ["uploading", "ready"]),
          lt(mediaUploads.createdAt, new Date(Date.now() - UPLOAD_LIFETIME_MS)),
        ),
      ),
    )
    .returning();
  return removeFiles(rows);
}
