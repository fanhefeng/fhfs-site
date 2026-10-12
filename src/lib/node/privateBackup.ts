import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import path from "node:path";
import { parsePrivateManifest, safeBackupPath, type PrivateManifest } from "../privateBackup";

/** Check every ancestor as well as the leaf: a symlinked directory also escapes. */
export async function regularBackupFile(root: string, relative: string): Promise<string> {
  if (!safeBackupPath(relative)) throw new Error("Unsafe private backup path");
  const directory = await lstat(root);
  if (directory.isSymbolicLink() || !directory.isDirectory())
    throw new Error("Private backup root must be a regular directory, not a symbolic link");
  let file = root;
  for (const part of relative.split("/")) {
    file = path.join(file, part);
    const info = await lstat(file);
    if (info.isSymbolicLink()) throw new Error("Private backups cannot contain symbolic links");
  }
  if (!(await lstat(file)).isFile()) throw new Error("Private backups require regular files");
  return file;
}

async function record(root: string, relative: string) {
  const file = await regularBackupFile(root, relative);
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(file)) {
    const data = chunk as Buffer;
    bytes += data.byteLength;
    hash.update(data);
  }
  return { path: relative, bytes, sha256: hash.digest("hex") };
}

export async function createPrivateManifest(
  root: string,
  files: string[],
  createdAt = new Date().toISOString(),
): Promise<PrivateManifest> {
  const records = [];
  for (const relative of [...files].sort()) records.push(await record(root, relative));
  return parsePrivateManifest({ version: 1, createdAt, files: records });
}

export async function verifyPrivateManifest(
  root: string,
  manifest: PrivateManifest,
): Promise<void> {
  for (const expected of parsePrivateManifest(manifest).files) {
    const actual = await record(root, expected.path);
    if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) {
      throw new Error(`Private backup integrity mismatch: ${expected.path}`);
    }
  }
}
