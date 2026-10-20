import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { PgDialect } from "drizzle-orm/pg-core";
import { eq, sql } from "drizzle-orm";
import {
  bootstrapAuditQuery,
  backupAuditQueries,
  snapshotProblems,
  BACKUP_TABLES,
} from "@/lib/backupAudit";
import * as schema from "@/db/schema";

vi.mock("server-only", () => ({}));
const isolated = vi.hoisted(() => ({ pg: undefined as PGlite | undefined }));

// Replace only the HTTP transport. Drizzle's actual transaction builder and
// result mapping still run; PostgreSQL runs in memory and reads no env/URL.
vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/neon-http");
  const query = (text: string, params: unknown[], options: { arrayMode?: boolean }) => ({
    text,
    params,
    options,
  });
  const client = Object.assign(query, {
    query,
    transaction: async (queries: ReturnType<typeof query>[]) =>
      isolated.pg!.transaction(async (tx) => {
        const results = [];
        for (const q of queries) {
          const result = await tx.query<Record<string, unknown>>(q.text, q.params);
          results.push({
            ...result,
            rowCount: result.affectedRows ?? result.rows.length,
            rows: q.options.arrayMode
              ? result.rows.map((row) => result.fields.map((field) => row[field.name]))
              : result.rows,
          });
        }
        return results;
      }),
  });
  return { db: drizzle({ client: client as never }) };
});

import { db } from "@/db";
import { auditedBatch, auditedExecute } from "@/app/admin/backup";

beforeAll(async () => {
  isolated.pg = new PGlite();
  await isolated.pg.exec(
    readFileSync(new URL("./fixtures/backupAudit.sql", import.meta.url), "utf8"),
  );
}, 30000);
afterAll(async () => {
  await isolated.pg?.close();
});

beforeEach(async () => {
  await isolated.pg!.exec(`
    TRUNCATE resume_experiences, posts, admin_content_state;
    INSERT INTO resume_experiences (key, company, role, period, bullets)
    VALUES ('one', '{}', '{}', '{}', '{}'), ('two', '{}', '{}', '{}', '{}'), ('three', '{}', '{}', '{}', '{}');
    INSERT INTO admin_content_state (table_name, total_rows, public_rows, revision)
    VALUES ('resume_experiences', 3, 3, 'before'), ('posts', 0, 0, 'before');
  `);
});

const count = async () =>
  (await isolated.pg!.query<{ n: number }>("SELECT count(*)::integer AS n FROM resume_experiences"))
    .rows[0]!.n;
const evidence = async () =>
  (
    await isolated.pg!.query<{ public_rows: number; revision: string }>(
      "SELECT public_rows, revision FROM admin_content_state WHERE table_name = 'resume_experiences'",
    )
  ).rows[0]!;

describe("the shared admin transaction", () => {
  it("initializes only against a matching reviewed snapshot and preserves existing evidence", async () => {
    const dialect = new PgDialect();
    const execute = async (expected: number) => {
      const query = dialect.sqlToQuery(
        bootstrapAuditQuery(schema.resumeExperiences, expected, "initialized"),
      );
      return isolated.pg!.query(query.sql, query.params);
    };
    await expect(execute(0)).rejects.toThrow(/BACKUP_BASELINE_MISMATCH/);
    await isolated.pg!.exec(
      "DELETE FROM admin_content_state WHERE table_name = 'resume_experiences'",
    );
    await execute(3);
    expect(await evidence()).toEqual({ public_rows: 3, revision: "initialized" });
    await isolated.pg!.exec("DELETE FROM resume_experiences");
    await execute(0);
    expect(await evidence()).toEqual({ public_rows: 3, revision: "initialized" });
    expect(() => bootstrapAuditQuery(schema.resumeExperiences, -1, "bad")).toThrow();
  });

  it("records each intentional delete, including deleting the last row", async () => {
    for (const key of ["one", "two", "three"]) {
      await auditedExecute(
        schema.resumeExperiences,
        db.delete(schema.resumeExperiences).where(eq(schema.resumeExperiences.key, key)),
      );
      expect((await evidence()).public_rows).toBe(await count());
    }
    const data = Object.fromEntries(Object.keys(BACKUP_TABLES).map((key) => [key, []]));
    const proof = Object.values(BACKUP_TABLES).map((tableName) => ({ tableName, publicRows: 0 }));
    expect(snapshotProblems({ ...data, mediaUploads: [] }, proof)).toEqual([]);
    expect(await count()).toBe(0);
    expect((await evidence()).revision).not.toBe("before");
  });

  it("rolls the edit back when a later statement fails", async () => {
    await expect(
      auditedBatch(schema.resumeExperiences, [
        db.delete(schema.resumeExperiences),
        db.execute(sql`SELECT 1 / 0`),
      ]),
    ).rejects.toThrow();
    expect(await count()).toBe(3);
    expect(await evidence()).toEqual({ public_rows: 3, revision: "before" });
  });

  it("refuses to bless loss that happened before a later no-op admin edit", async () => {
    await isolated.pg!.exec("DELETE FROM resume_experiences");
    await expect(
      auditedExecute(
        schema.resumeExperiences,
        db.delete(schema.resumeExperiences).where(eq(schema.resumeExperiences.key, "one")),
      ),
    ).rejects.toThrow(/BACKUP_STATE_MISMATCH/);
    expect(await evidence()).toEqual({ public_rows: 3, revision: "before" });
  });

  it("detects partial loss before another edit and missing evidence", async () => {
    await isolated.pg!.exec("DELETE FROM resume_experiences WHERE key = 'one'");
    await expect(
      auditedExecute(schema.resumeExperiences, db.delete(schema.resumeExperiences)),
    ).rejects.toThrow(/BACKUP_STATE_MISMATCH/);
    expect(await count()).toBe(2);
    await isolated.pg!.exec("DELETE FROM admin_content_state");
    await expect(
      auditedExecute(schema.resumeExperiences, db.delete(schema.resumeExperiences)),
    ).rejects.toThrow(/BACKUP_STATE_MISMATCH/);
    expect(await count()).toBe(2);
  });

  it("records unpublishing the last public post without exposing the draft", async () => {
    await isolated.pg!
      .exec(`INSERT INTO posts (slug, locale, title, date, summary, body_md, body_html, reading_minutes)
      VALUES ('article', 'zh', 'Title', '2026-10-20', '', '', '', 1);
      UPDATE admin_content_state SET total_rows = 1, public_rows = 1 WHERE table_name = 'posts';`);
    await auditedExecute(schema.posts, db.update(schema.posts).set({ draft: true }));
    const result = await isolated.pg!.query<{ total_rows: number; public_rows: number }>(
      "SELECT total_rows, public_rows FROM admin_content_state WHERE table_name = 'posts'",
    );
    expect(result.rows).toEqual([{ total_rows: 1, public_rows: 0 }]);
  });

  it("rejects operational tables instead of manufacturing edit evidence", () => {
    expect(() => backupAuditQueries(schema.loginAttempts, "test")).toThrow(/Not a backed-up/);
    const query = new PgDialect().sqlToQuery(
      backupAuditQueries(schema.resumeExperiences, "test").lock,
    );
    expect(query.sql).toContain("SHARE ROW EXCLUSIVE MODE");
  });
});
