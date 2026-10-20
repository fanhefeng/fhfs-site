import { describe, expect, it } from "vite-plus/test";
import { BACKUP_TABLES, snapshotProblems, type BackupState } from "@/lib/backupAudit";

const snapshot = () =>
  ({
    ...Object.fromEntries(Object.keys(BACKUP_TABLES).map((key) => [key, []])),
    mediaUploads: [],
  }) as Record<string, unknown[]>;
const states = (): BackupState[] =>
  Object.values(BACKUP_TABLES).map((tableName) => ({ tableName, publicRows: 0 }));

describe("public snapshots and authenticated admin edit evidence", () => {
  it("accepts intentional clearing, including the last resume entry and all content", () => {
    expect(snapshotProblems(snapshot(), states())).toEqual([]);
  });

  it("accepts ordinary edits and adding rows", () => {
    const data = snapshot();
    data.posts = [{ title: "rewritten" }, { title: "added" }];
    const evidence = states();
    evidence.find((row) => row.tableName === "posts")!.publicRows = 2;
    expect(snapshotProblems(data, evidence)).toEqual([]);
  });

  it("catches both total and partial loss without an authenticated edit", () => {
    const data = snapshot();
    data.posts = [{}];
    const evidence = states();
    evidence.find((row) => row.tableName === "posts")!.publicRows = 2;
    evidence.find((row) => row.tableName === "resume_experiences")!.publicRows = 3;
    expect(snapshotProblems(data, evidence)).toEqual([
      "posts: exported 1 rows; authenticated edits expect 2",
      "resumeExperiences: exported 0 rows; authenticated edits expect 3",
    ]);
  });

  it("rejects a wrong or empty database without evidence", () => {
    expect(snapshotProblems(snapshot(), [])).length(Object.keys(BACKUP_TABLES).length);
  });

  it("rejects omitted tables, malformed exports and malformed evidence", () => {
    const data = snapshot();
    delete data.posts;
    const evidence = states();
    evidence[1]!.publicRows = -1;
    evidence[2]!.publicRows = 0.5;
    expect(snapshotProblems(data, evidence)).toEqual([
      "posts: missing or invalid export",
      "abouts: missing or invalid admin edit evidence",
      "secrets: missing or invalid admin edit evidence",
    ]);
    expect(snapshotProblems({ ...snapshot(), mediaUploads: null }, states())).toEqual([
      "mediaUploads: missing or invalid export",
    ]);
    expect(snapshotProblems(snapshot(), [...states(), states()[0]!])).toEqual([
      "duplicate edit evidence",
    ]);
  });
});
