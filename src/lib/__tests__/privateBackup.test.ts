import { mkdir, mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  parsePrivateManifest,
  snapshotProblem,
  postgresEnvironment,
  latestSnapshotTime,
} from "@/lib/privateBackup";
import { createPrivateManifest, verifyPrivateManifest } from "@/lib/node/privateBackup";

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
async function directory() {
  const dir = await mkdtemp(path.join(tmpdir(), "fhfs-backup-test-"));
  temporary.push(dir);
  return dir;
}

describe("private backup integrity", () => {
  it("restores the recorded bytes and detects a changed or missing file", async () => {
    const dir = await directory();
    await writeFile(path.join(dir, "database.dump"), "private draft");
    const manifest = await createPrivateManifest(dir, ["database.dump"], "2026-10-12T08:00:00Z");
    await expect(verifyPrivateManifest(dir, manifest)).resolves.toBeUndefined();
    await writeFile(path.join(dir, "database.dump"), "private theft");
    await expect(verifyPrivateManifest(dir, manifest)).rejects.toThrow(/database.dump/);
    await rm(path.join(dir, "database.dump"));
    await expect(verifyPrivateManifest(dir, manifest)).rejects.toThrow();
  });

  it("rejects paths that could escape the private restore directory", () => {
    for (const name of [
      "../secret",
      "/secret",
      "media/../../secret",
      "media\\secret",
      "a//b",
      "C:/secret",
    ]) {
      expect(() =>
        parsePrivateManifest({
          version: 1,
          createdAt: "2026-10-12T08:00:00Z",
          files: [
            { path: "database.dump", bytes: 1, sha256: "a".repeat(64) },
            { path: name, bytes: 1, sha256: "a".repeat(64) },
          ],
        }),
      ).toThrow();
    }
  });

  it("refuses symlinks instead of backing up files outside its directory", async () => {
    const dir = await directory();
    const outside = await directory();
    await writeFile(path.join(outside, "secret"), "not part of the backup");
    await symlink(path.join(outside, "secret"), path.join(dir, "database.dump"));
    await expect(createPrivateManifest(dir, ["database.dump"])).rejects.toThrow(/symbolic|regular/);
  });

  it("also rejects a symlinked root or ancestor directory", async () => {
    const dir = await directory();
    const outside = await directory();
    await writeFile(path.join(outside, "database.dump"), "outside");
    await symlink(outside, path.join(dir, "linked"));
    await expect(
      createPrivateManifest(path.join(dir, "linked"), ["database.dump"]),
    ).rejects.toThrow(/symbolic|directory/);
    await expect(createPrivateManifest(dir, ["linked/database.dump"])).rejects.toThrow(/symbolic/);
    await mkdir(path.join(dir, "database.dump"));
    await expect(createPrivateManifest(dir, ["database.dump"])).rejects.toThrow(/regular/);
  });

  it("rejects malformed or duplicate integrity records", () => {
    const file = { path: "database.dump", bytes: 4, sha256: "a".repeat(64) };
    for (const files of [[file, file], [{ ...file, bytes: -1 }], [{ ...file, sha256: "bad" }]]) {
      expect(() =>
        parsePrivateManifest({ version: 1, createdAt: "2026-10-12T08:00:00Z", files }),
      ).toThrow();
    }
    expect(() => parsePrivateManifest({ version: 2, files: [] })).toThrow();
  });
});

describe("backup freshness", () => {
  const now = Date.parse("2026-10-12T08:00:00Z");
  it("reads restic grouped and flat listings in chronological order", () => {
    const older = { time: "2026-10-12T12:00:00+08:00" };
    const newer = { time: "2026-10-12T08:00:00Z" };
    expect(
      latestSnapshotTime([{ group_key: { hostname: "fhfs-site" }, snapshots: [older, newer] }]),
    ).toBe(newer.time);
    expect(latestSnapshotTime([older, newer])).toBe(newer.time);
    expect(latestSnapshotTime([])).toBeUndefined();
  });
  it("refuses malformed snapshot listings", () => {
    for (const value of [{}, [null], [{ snapshots: {} }], [{ time: "not-a-date" }]]) {
      expect(() => latestSnapshotTime(value)).toThrow(/snapshot listing/);
    }
  });
  it("fails when there is no recent successful snapshot", () => {
    expect(snapshotProblem(undefined, now)).toMatch(/No successful/);
    expect(snapshotProblem("2026-10-10T08:00:00Z", now)).toMatch(/36/);
    expect(snapshotProblem("not-a-date", now)).toMatch(/Invalid/);
    expect(snapshotProblem("2026-10-13T08:00:00Z", now)).toMatch(/future/);
    expect(snapshotProblem("2026-10-12T07:00:00Z", now)).toBeNull();
  });
});

describe("native Postgres connection", () => {
  it("passes credentials in environment variables, with escaped values decoded", () => {
    expect(
      postgresEnvironment(
        "postgresql://backup:p%40ss@db.example:5433/site?sslmode=require&channel_binding=require",
      ),
    ).toEqual({
      PGHOST: "db.example",
      PGPORT: "5433",
      PGUSER: "backup",
      PGPASSWORD: "p@ss",
      PGDATABASE: "site",
      PGSSLMODE: "require",
      PGCHANNELBINDING: "require",
      PGCONNECT_TIMEOUT: "15",
    });
    expect(() => postgresEnvironment("https://example.com")).toThrow(/Postgres/);
  });
});
