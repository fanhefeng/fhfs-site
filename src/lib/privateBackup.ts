/** The private recovery copy is versioned separately from the public JSON export. */
export type PrivateManifest = {
  version: 1;
  createdAt: string;
  files: { path: string; bytes: number; sha256: string }[];
};

export function safeBackupPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !/[\\\0:]/.test(value) &&
    value.split("/").every((part) => part !== "" && part !== "." && part !== "..")
  );
}

export function parsePrivateManifest(value: unknown): PrivateManifest {
  if (!value || typeof value !== "object") throw new Error("Invalid private backup manifest");
  const manifest = value as Partial<PrivateManifest>;
  if (
    manifest.version !== 1 ||
    typeof manifest.createdAt !== "string" ||
    !Number.isFinite(Date.parse(manifest.createdAt)) ||
    !Array.isArray(manifest.files) ||
    manifest.files.length === 0
  )
    throw new Error("Invalid private backup manifest");
  const seen = new Set<string>();
  for (const file of manifest.files) {
    if (
      !file ||
      !safeBackupPath(file.path) ||
      seen.has(file.path) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0 ||
      typeof file.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(file.sha256)
    ) {
      throw new Error("Invalid private backup file record");
    }
    seen.add(file.path);
  }
  if (!seen.has("database.dump")) throw new Error("Private backup has no database.dump");
  return manifest as PrivateManifest;
}

/** restic --group-by emits groups; older/plain JSON listings emit snapshots. */
export function latestSnapshotTime(value: unknown): string | undefined {
  if (!Array.isArray(value)) throw new Error("Invalid snapshot listing");
  const times: string[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") throw new Error("Invalid snapshot listing");
    const snapshots = "snapshots" in item ? item.snapshots : [item];
    if (!Array.isArray(snapshots)) throw new Error("Invalid snapshot listing");
    for (const snapshot of snapshots) {
      if (
        !snapshot ||
        typeof snapshot.time !== "string" ||
        !Number.isFinite(Date.parse(snapshot.time))
      )
        throw new Error("Invalid snapshot listing");
      times.push(snapshot.time);
    }
  }
  return times.sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1);
}

export function snapshotProblem(time: string | undefined, now = Date.now()): string | null {
  if (!time) return "No successful private backup";
  const age = now - Date.parse(time);
  if (!Number.isFinite(age)) return "Invalid snapshot timestamp";
  if (age < -5 * 60_000) return "Snapshot timestamp is in the future";
  return age > 36 * 60 * 60_000 ? "No successful private backup in the last 36 hours" : null;
}

/** libpq credentials stay out of process arguments and diagnostic command lines. */
export function postgresEnvironment(value: string): Record<string, string> {
  const url = new URL(value);
  if (!/^postgres(?:ql)?:$/.test(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
    throw new Error("A Postgres connection URL is required");
  }
  const env: Record<string, string> = {
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: url.searchParams.get("sslmode") || "require",
    PGCONNECT_TIMEOUT: "15",
  };
  const options = {
    channel_binding: "PGCHANNELBINDING",
    options: "PGOPTIONS",
    sslrootcert: "PGSSLROOTCERT",
  };
  for (const [query, name] of Object.entries(options)) {
    const option = url.searchParams.get(query);
    if (option) env[name] = option;
  }
  return env;
}
