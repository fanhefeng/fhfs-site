import { describe, expect, it } from "vite-plus/test";
import {
  restoreTargetEnvironment,
  requireRestoreGuard,
  applicationArchiveTables,
} from "@/lib/privateRestore";
import { postgresDataFingerprint } from "@/lib/node/privateRestore";

const target =
  "postgresql://backup_restore:secret@restore.neon.tech/fhfs_restore_drill?sslmode=require";
const production = "postgresql://private_backup:secret@production.neon.tech/neondb";
const guard = {
  database: "fhfs_restore_drill",
  role: "backup_restore",
  purpose: "fhfs-private-restore-only",
  guardCount: 1,
  superuser: false,
  createDatabase: false,
  createRole: false,
  membershipCount: 0,
  canChangeGuard: false,
};

describe("disposable restore boundary", () => {
  it("accepts only the dedicated direct database and limited role", () => {
    expect(restoreTargetEnvironment(target, [production]).PGDATABASE).toBe("fhfs_restore_drill");
    for (const url of [
      target.replace("restore.neon", "production.neon"),
      target.replace("restore.neon.tech", "PRODUCTION.NEON.TECH."),
      target.replace("restore.neon", "restore-pooler.neon"),
      target.replace("restore.neon.tech", "RESTORE-POOLER.NEON.TECH."),
      target.replace("backup_restore:", "neondb_owner:"),
      target.replace("fhfs_restore_drill", "neondb"),
      target.replace("sslmode=require", "sslmode=disable"),
      "https://restore.neon.tech/fhfs_restore_drill",
    ])
      expect(() => restoreTargetEnvironment(url, [production])).toThrow();
    expect(() => restoreTargetEnvironment(target, [])).toThrow();
    expect(() =>
      restoreTargetEnvironment(target, [
        production.replace("production.neon", "restore-pooler.neon"),
      ]),
    ).toThrow();
    expect(() =>
      restoreTargetEnvironment(target, [
        production.replace("production.neon.tech", "RESTORE-POOLER.NEON.TECH."),
      ]),
    ).toThrow();
  });

  it("refuses a missing marker, a privileged account or writable marker before restoring", () => {
    expect(() => requireRestoreGuard(guard)).not.toThrow();
    for (const value of [
      null,
      {},
      { ...guard, purpose: "production" },
      { ...guard, guardCount: 2 },
      { ...guard, database: "neondb" },
      { ...guard, role: "neondb_owner" },
      { ...guard, superuser: true },
      { ...guard, createDatabase: true },
      { ...guard, createRole: true },
      { ...guard, membershipCount: 1 },
      { ...guard, canChangeGuard: true },
    ])
      expect(() => requireRestoreGuard(value)).toThrow();
  });
});

const migrations = "COPY drizzle.__drizzle_migrations (id, hash) FROM stdin;\n1\tabc\n\\.\n";
const sequence = "SELECT pg_catalog.setval('public.posts_id_seq', 7, true);\n";
const toc = `; pg_restore archive directory
3; 2615 2200 SCHEMA - public owner
4; 2615 2201 SCHEMA - drizzle owner
5; 0 0 COMMENT - SCHEMA public owner
6; 1259 2202 TABLE drizzle __drizzle_migrations owner
7; 1259 2203 TABLE public posts owner
8; 0 2203 TABLE DATA public posts owner
9; 1259 2204 SEQUENCE public posts_id_seq owner
10; 0 0 SEQUENCE OWNED BY public posts_id_seq owner
11; 0 0 SEQUENCE SET public posts_id_seq owner
12; 2606 2205 CONSTRAINT public posts posts_pkey owner
`;
describe("archive restore scope", () => {
  it("includes schema definitions as well as their objects, without filtering away drizzle creation", () => {
    expect(applicationArchiveTables(toc)).toEqual(["drizzle.__drizzle_migrations", "public.posts"]);
  });
  it("rejects missing schema definitions, extra schemas, database creation and malformed entries", () => {
    for (const value of [
      "",
      toc.replace("4; 2615 2201 SCHEMA - drizzle owner\n", ""),
      toc + "13; 2615 2206 SCHEMA - recovery_control owner\n",
      toc + "13; 1259 2206 TABLE recovery_control guard owner\n",
      toc + "13; 1262 2206 DATABASE - neondb owner\n",
      toc + "not an archive item\n",
      toc + "13; 1259 2206 TABLE public posts owner\n",
    ])
      expect(() => applicationArchiveTables(value)).toThrow();
  });
});
function dump(rows: string[], columns = "id, body, draft") {
  return (
    migrations + `COPY public.posts (${columns}) FROM stdin;\n${rows.join("\n")}\n\\.\n` + sequence
  );
}

describe("restored Postgres data", () => {
  it("compares row content and columns independent of physical row order, including drafts and escapes", () => {
    const rows = ["1\tline\\nnext\\tcell\\\\path\tt", "2\t\\N\tf", "3\t\tf"];
    expect(postgresDataFingerprint(dump(rows))).toEqual(
      postgresDataFingerprint(dump([...rows].reverse())),
    );
    expect(postgresDataFingerprint(dump(rows))).not.toEqual(
      postgresDataFingerprint(dump([rows[0]!, rows[1]!, "3\tchanged\tf"])),
    );
    expect(postgresDataFingerprint(dump(rows))).not.toEqual(
      postgresDataFingerprint(dump(rows, "id, draft, body")),
    );
    expect(postgresDataFingerprint(dump(rows))).not.toEqual(
      postgresDataFingerprint(dump(rows).replace("7, true", "8, false")),
    );
    expect(postgresDataFingerprint(dump(rows)).tables["public.posts"]?.rows).toBe(3);
  });

  it("distinguishes an empty table from a single empty-string row and preserves duplicate rows", () => {
    const empty = migrations + "COPY public.labels (label) FROM stdin;\n\\.\n";
    const one = migrations + "COPY public.labels (label) FROM stdin;\n\n\\.\n";
    const two = migrations + "COPY public.labels (label) FROM stdin;\n\n\n\\.\n";
    expect(postgresDataFingerprint(empty).tables["public.labels"]?.rows).toBe(0);
    expect(postgresDataFingerprint(one).tables["public.labels"]?.rows).toBe(1);
    expect(postgresDataFingerprint(two).tables["public.labels"]?.rows).toBe(2);
    expect(postgresDataFingerprint(one)).not.toEqual(postgresDataFingerprint(empty));
  });

  it("fails closed on missing migrations, truncated/duplicate COPY, malformed rows or foreign schemas", () => {
    for (const sql of [
      "",
      dump(["1\ttext\tf"]).replace(migrations, ""),
      migrations + "COPY public.posts (id) FROM stdin;\n1\n",
      migrations + migrations,
      migrations + "COPY public.posts (id) FROM stdin;\n1\textra\n\\.\n",
      migrations + "COPY other.posts (id) FROM stdin;\n1\n\\.\n",
      migrations + "COPY public.posts FROM stdin;\n1\n\\.\n",
      migrations + "\\.\n",
      migrations + sequence + sequence,
    ])
      expect(() => postgresDataFingerprint(sql)).toThrow();
  });
});
