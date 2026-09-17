import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const read = (file: string) => readFileSync(`${root}${file}`, "utf8");

/** Every table the schema declares, as `[exportName, sqlName]`. */
const tables = Object.entries(schema)
  .filter(([, value]) => is(value, PgTable))
  .map(([name, table]) => [name, getTableName(table as PgTable)] as const);

/**
 * Tables that hold no content: nothing to back up, nothing to restore. A new
 * table is content until it is named here with its reason.
 */
const NOT_CONTENT = new Set([
  // Failed-login timestamps by IP; they expire by themselves.
  "loginAttempts",
]);

const content = tables.filter(([name]) => !NOT_CONTENT.has(name));

// A table added to the schema has to be named in each of these by hand — the
// scripts treat every table a little differently, so they cannot be derived.
// One forgotten is a backup that silently lacks a table, found at restore.
describe("every table in the schema", () => {
  it("is found", () => {
    expect(tables.length).toBeGreaterThan(10);
    expect([...NOT_CONTENT].filter((name) => !tables.some(([t]) => t === name))).toEqual([]);
  });

  it("is counted by db:check", () => {
    const script = read("scripts/db-check.mts");
    expect(tables.filter(([, sqlName]) => !script.includes(`"${sqlName}"`)).map(([name]) => name)).toEqual([]);
  });

  for (const script of ["scripts/db-export.mts", "scripts/db-import.mts"]) {
    it(`is handled by ${script}, if it holds content`, () => {
      const text = read(script);
      expect(content.filter(([name]) => !new RegExp(`\\bschema\\.${name}\\b`).test(text)).map(([name]) => name)).toEqual([]);
    });
  }

  it("has its rows in backup/db.json, if it holds content", () => {
    const backup = Object.keys(JSON.parse(read("backup/db.json")) as Record<string, unknown>);
    expect(content.map(([name]) => name).filter((name) => !backup.includes(name))).toEqual([]);
  });
});
