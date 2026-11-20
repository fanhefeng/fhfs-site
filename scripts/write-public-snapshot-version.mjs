import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

// Runs after the snapshot guard has checked the exported rows and evidence.
const sha256 = createHash("sha256")
  .update(await readFile("backup/db.json"))
  .digest("hex");
const publishedAt = new Date().toISOString();
await writeFile("backup/snapshot-version.json", JSON.stringify({ publishedAt, sha256 }) + "\n");
