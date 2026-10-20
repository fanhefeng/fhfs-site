import "server-only";
import type { SQLWrapper } from "drizzle-orm";
import type { BatchItem, BatchResponse } from "drizzle-orm/batch";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { backupAuditQueries } from "@/lib/backupAudit";

/** Called only after the action's session check and form validation. Content,
 * upload retention and expected backup counts commit together or all roll back.
 */
export async function auditedBatch<T extends readonly [BatchItem<"pg">, ...BatchItem<"pg">[]]>(
  table: PgTable,
  writes: T,
): Promise<BatchResponse<T>> {
  const { lock, check, record } = backupAuditQueries(table, crypto.randomUUID());
  const [first, ...rest] = writes;
  const results = await db.batch([
    db.execute(lock),
    db.execute(check),
    first,
    ...rest,
    db.execute(record),
  ]);
  return results.slice(2, -1) as BatchResponse<T>;
}

export async function auditedExecute(table: PgTable, query: SQLWrapper) {
  const [result] = await auditedBatch(table, [db.execute(query.getSQL())]);
  return result;
}
