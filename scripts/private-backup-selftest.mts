/** Real encrypted round trip, using synthetic data and a local temporary repository. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createPrivateManifest, verifyPrivateManifest } from "../src/lib/node/privateBackup";
import {
  parsePrivateManifest,
  snapshotProblem,
  latestSnapshotTime,
} from "../src/lib/privateBackup";

process.umask(0o077);
const root = await mkdtemp(path.join(os.tmpdir(), "fhfs-restic-selftest-"));
const source = path.join(root, "source");
const restored = path.join(root, "restored");
const env = {
  ...process.env,
  RESTIC_REPOSITORY: path.join(root, "repository"),
  RESTIC_PASSWORD: randomBytes(32).toString("hex"),
  RESTIC_PASSWORD_FILE: "",
  RESTIC_PASSWORD_COMMAND: "",
  RESTIC_REPOSITORY_FILE: "",
};
const exec = promisify(execFile);
async function restic(args: string[]) {
  const result = await exec("restic", ["--no-cache", ...args], {
    cwd: source,
    env,
    timeout: 60_000,
  });
  return result.stdout;
}
try {
  await mkdir(path.join(source, "media/moments"), { recursive: true });
  // This is deliberately not a Postgres archive: no database is contacted.
  await writeFile(path.join(source, "database.dump"), "synthetic private draft");
  await writeFile(path.join(source, "media/moments/test.bin"), randomBytes(100_000));
  const manifest = await createPrivateManifest(source, ["database.dump", "media/moments/test.bin"]);
  await writeFile(path.join(source, "snapshot.json"), JSON.stringify(manifest));
  await restic(["init"]);
  await restic([
    "backup",
    ".",
    "--tag",
    "fhfs-private",
    "--host",
    "fhfs-site",
    "--group-by",
    "host,tags",
  ]);
  const snapshots: unknown = JSON.parse(
    await restic([
      "snapshots",
      "--json",
      "--tag",
      "fhfs-private",
      "--host",
      "fhfs-site",
      "--group-by",
      "host",
      "--latest",
      "1",
    ]),
  );
  assert.ok(Array.isArray(snapshots));
  assert.equal(snapshots.length, 1);
  assert.equal(snapshotProblem(latestSnapshotTime(snapshots)), null);
  await restic(["check"]);
  await restic([
    "restore",
    "latest",
    "--tag",
    "fhfs-private",
    "--host",
    "fhfs-site",
    "--target",
    restored,
  ]);
  // Backing up '.' records the contents at the snapshot root.
  const directory = restored;
  const actual = parsePrivateManifest(
    JSON.parse(await readFile(path.join(directory, "snapshot.json"), "utf8")),
  );
  await verifyPrivateManifest(directory, actual);
  await writeFile(path.join(directory, "media/moments/test.bin"), "tampered");
  await assert.rejects(verifyPrivateManifest(directory, actual), /integrity mismatch/);
  console.log(
    "Private backup self-test passed: encryption, restore, SHA-256 and tamper detection. No database or remote storage was used.",
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
