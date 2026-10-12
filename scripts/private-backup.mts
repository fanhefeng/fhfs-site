/** Encrypted recovery copy, including drafts. Never writes to backup/ or Git. */
import { spawn } from "node:child_process";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MEDIA_ORIGIN } from "../src/config/csp";
import { mediaPaths, MEDIA_FILE_LIMIT } from "../src/lib/mediaSite";
import {
  parsePrivateManifest,
  postgresEnvironment,
  snapshotProblem,
  latestSnapshotTime,
  safeBackupPath,
} from "../src/lib/privateBackup";
import {
  createPrivateManifest,
  regularBackupFile,
  verifyPrivateManifest,
} from "../src/lib/node/privateBackup";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(path.join(ROOT, ".env.local"));
} catch {
  /* CI supplies its environment. */
}
process.umask(0o077);
const command = process.argv[2] ?? "check";
const repository = process.env.RESTIC_REPOSITORY;
const password = process.env.RESTIC_PASSWORD || process.env.RESTIC_PASSWORD_FILE;
const database = process.env.BACKUP_DATABASE_URL;
/** Only curated messages may reach public workflow logs. */
class BackupError extends Error {}

const TAG = "fhfs-private";
const HOST = "fhfs-site";

/** Capture output: native tools may repeat a connection URL or private row. */
function run(
  binary: string,
  args: string[],
  cwd = ROOT,
  extra: Record<string, string> = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd,
      env: { ...process.env, ...extra },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    let bytes = 0;
    const timeout = setTimeout(() => child.kill("SIGKILL"), 20 * 60_000);
    child.stdout.on("data", (data: Buffer) => {
      bytes += data.length;
      if (bytes > 16 * 1024 * 1024) child.kill("SIGKILL");
      else chunks.push(data);
    });
    child.stderr.resume();
    child.on("error", () => {
      clearTimeout(timeout);
      reject(new BackupError(`${binary} could not start; install it and check its permissions`));
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0)
        reject(
          new BackupError(
            `${binary} failed (exit ${code}); native output withheld because it can contain private data`,
          ),
        );
      else resolve(Buffer.concat(chunks).toString("utf8"));
    });
  });
}

async function localMedia(dir: string, prefix = ""): Promise<string[]> {
  const directory = await lstat(dir);
  if (directory.isSymbolicLink() || !directory.isDirectory())
    throw new BackupError("Media backup source must be a regular directory");
  const found: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (!safeBackupPath(relative) || entry.isSymbolicLink())
      throw new BackupError("Unsafe media file in local backup source");
    if (entry.isDirectory())
      found.push(...(await localMedia(path.join(dir, entry.name), `${relative}/`)));
    else if (entry.isFile()) found.push(relative);
  }
  return found;
}

async function stageBackup(stage: string) {
  if (!database)
    throw new BackupError(
      "Set BACKUP_DATABASE_URL to the direct URL of the private backup read-only role",
    );
  // Native pg_dump owns the consistent snapshot; no second JS connection is opened.
  await run(
    "pg_dump",
    [
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      "--schema=public",
      "--schema=drizzle",
      "--exclude-table-data=public.login_attempts",
      "--file=database.dump",
    ],
    stage,
    postgresEnvironment(database),
  );
  await run("pg_restore", ["--list", "database.dump"], stage);
  // Extract references from this exact snapshot, including drafts, rather than
  // a later SELECT that could miss media removed while the dump was running.
  await run("pg_restore", ["--data-only", "--file=references.sql", "database.dump"], stage);
  const references = mediaPaths(
    await readFile(path.join(stage, "references.sql"), "utf8"),
    MEDIA_ORIGIN,
  );
  await rm(path.join(stage, "references.sql"));
  const source = path.join(ROOT, "media/files");
  const local = await localMedia(source).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const media = new Set([...local, ...references.map((item) => item.slice(1))]);
  const files = ["database.dump"];
  for (const relative of [...media].sort()) {
    if (!safeBackupPath(relative) || !relative.startsWith("moments/")) {
      // Worker metadata is generated on deploy; only moments are private media.
      if (relative === "_headers") continue;
      throw new BackupError("Unexpected path in media backup");
    }
    const destination = path.join(stage, "media", relative);
    await mkdir(path.dirname(destination), { recursive: true });
    try {
      const file = await regularBackupFile(source, relative);
      await copyFile(file, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const response = await fetch(`${MEDIA_ORIGIN}/${relative}`, {
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) throw new BackupError("A referenced media file could not be downloaded");
      const length = Number(response.headers.get("content-length"));
      if (length > MEDIA_FILE_LIMIT) throw new BackupError("Media file exceeds the asset limit");
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      if (!response.body) throw new BackupError("Empty media response");
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > MEDIA_FILE_LIMIT) throw new BackupError("Media file exceeds the asset limit");
        chunks.push(chunk);
      }
      if (bytes === 0) throw new BackupError("Empty media file");
      await writeFile(destination, Buffer.concat(chunks));
    }
    files.push(`media/${relative}`);
  }
  const manifest = await createPrivateManifest(stage, files);
  await writeFile(path.join(stage, "snapshot.json"), JSON.stringify(manifest, null, 2));
  await verifyPrivateManifest(stage, manifest);
  return manifest.files.length - 1;
}

async function manifestDirectory(dir: string): Promise<string | null> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new BackupError("Symbolic link in restored backup");
    if (entry.isFile() && entry.name === "snapshot.json") return dir;
    if (entry.isDirectory()) {
      const found = await manifestDirectory(path.join(dir, entry.name));
      if (found) return found;
    }
  }
  return null;
}

async function main() {
  if (!["check", "create", "verify", "verify-database", "health"].includes(command))
    throw new BackupError(
      "Usage: pnpm backup:private [check|create|verify|verify-database|health]",
    );
  const problems: string[] = [];
  if (!repository) problems.push("RESTIC_REPOSITORY is missing");
  if (!password) problems.push("RESTIC_PASSWORD or RESTIC_PASSWORD_FILE is missing");
  if ((command === "create" || command === "check") && !database)
    problems.push("BACKUP_DATABASE_URL is missing");
  const binaries =
    command === "health"
      ? ["restic"]
      : command === "verify" || command === "verify-database"
        ? ["pg_restore", "restic"]
        : ["pg_dump", "pg_restore", "restic"];
  for (const binary of binaries) {
    try {
      await run(binary, [binary === "restic" ? "version" : "--version"]);
    } catch {
      problems.push(`${binary} is unavailable`);
    }
  }
  if (problems.length) throw new BackupError(problems.join("\n"));
  if (database) {
    try {
      postgresEnvironment(database);
    } catch {
      throw new BackupError("BACKUP_DATABASE_URL must be a valid direct Postgres URL");
    }
  }
  if (command === "check") {
    console.log(
      "Private backup configuration and tools are ready; run restic init once for a new repository.",
    );
    return;
  }
  if (command === "health") {
    const newest = latestSnapshotTime(
      JSON.parse(
        await run("restic", [
          "snapshots",
          "--json",
          "--tag",
          TAG,
          "--host",
          HOST,
          "--group-by",
          "host",
          "--latest",
          "1",
        ]),
      ),
    );
    const problem = snapshotProblem(newest);
    if (problem) throw new BackupError(problem);
    console.log(`Private backup is current: ${newest}`);
    return;
  }
  const stage = await mkdtemp(path.join(os.tmpdir(), "fhfs-private-backup-"));
  try {
    if (command === "create") {
      const mediaCount = await stageBackup(stage);
      await run(
        "restic",
        ["backup", ".", "--tag", TAG, "--host", HOST, "--group-by", "host,tags", "--json"],
        stage,
      );
      console.log(`Encrypted backup completed, including drafts and ${mediaCount} media files.`);
    } else {
      await run("restic", ["check"]);
      await run("restic", [
        "restore",
        "latest",
        "--tag",
        TAG,
        "--host",
        HOST,
        "--target",
        stage,
        ...(command === "verify-database"
          ? ["--include", "/database.dump", "--include", "/snapshot.json"]
          : []),
      ]);
      const dir = await manifestDirectory(stage);
      if (!dir) throw new BackupError("Restored snapshot has no integrity manifest");
      const manifest = parsePrivateManifest(
        JSON.parse(await readFile(path.join(dir, "snapshot.json"), "utf8")),
      );
      await verifyPrivateManifest(
        dir,
        command === "verify-database"
          ? { ...manifest, files: manifest.files.filter((file) => file.path === "database.dump") }
          : manifest,
      );
      await run("pg_restore", ["--list", "database.dump"], dir);
      console.log(
        command === "verify-database"
          ? "Restored database bytes and archive directory verified. Media bytes were not downloaded; a database restore drill is still separate."
          : `Restored bytes verified: ${manifest.files.length} files. A database restore drill is still required.`,
      );
    }
  } finally {
    // Only our own 0700 temporary directory; never the source media or database.
    if ((await lstat(stage)).isDirectory()) await rm(stage, { recursive: true, force: true });
  }
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof BackupError
      ? error.message
      : "Private backup failed during an integrity, filesystem or connection check; private details withheld",
  );
  process.exitCode = 1;
}
