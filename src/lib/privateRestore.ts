import { postgresEnvironment } from "./privateBackup";

/** Validate the whole TOC: pg_restore --schema filters out SCHEMA definitions themselves. */
export function applicationArchiveTables(toc: string): string[] {
  const schemas = new Set<string>();
  const tables = new Set<string>();
  const item =
    /^\d+;\s+\d+\s+\d+\s+(TABLE DATA|SEQUENCE OWNED BY|SEQUENCE SET|FK CONSTRAINT|CONSTRAINT|SCHEMA|COMMENT|ACL|TABLE|SEQUENCE|INDEX|DEFAULT|TYPE|FUNCTION|TRIGGER|ENCODING|STDSTRINGS|SEARCHPATH) ([^ ]+) (.+)$/;
  for (const line of toc.split("\n")) {
    if (!line.trim() || line.startsWith(";")) continue;
    const match = item.exec(line);
    if (!match) throw new Error("Unsupported object in database restore archive");
    const [, kind, namespace, rest] = match;
    if (namespace === "-") {
      if (kind === "SCHEMA" && /^(public|drizzle) \S+$/.test(rest!)) {
        const schema = rest!.split(" ")[0]!;
        if (schemas.has(schema)) throw new Error("Duplicate schema in restore archive");
        schemas.add(schema);
      } else if (
        !(
          (kind === "COMMENT" && /^SCHEMA (public|drizzle) \S+$/.test(rest!)) ||
          (kind === "ACL" && /^(public|drizzle) \S+$/.test(rest!)) ||
          (["ENCODING", "STDSTRINGS", "SEARCHPATH"].includes(kind!) &&
            rest!.startsWith(kind! + " "))
        )
      )
        throw new Error("Archive includes objects outside the application schemas");
    } else {
      if (namespace !== "public" && namespace !== "drizzle")
        throw new Error("Archive includes objects outside the application schemas");
      if (kind === "TABLE") {
        const name = `${namespace}.${rest!.split(" ")[0]!}`;
        if (tables.has(name)) throw new Error("Duplicate table in restore archive");
        tables.add(name);
      }
    }
  }
  if (
    !schemas.has("public") ||
    !schemas.has("drizzle") ||
    !tables.has("drizzle.__drizzle_migrations")
  )
    throw new Error("Archive is missing application schemas or migration history");
  return [...tables].sort();
}

/** Fixed names plus an independently provisioned marker prevent accidental production restores. */
export function restoreTargetEnvironment(target: string, protectedUrls: string[]) {
  const env = postgresEnvironment(target);
  if (
    protectedUrls.length === 0 ||
    env.PGDATABASE !== "fhfs_restore_drill" ||
    env.PGUSER !== "backup_restore" ||
    env.PGHOST!.includes("-pooler.") ||
    !["require", "verify-ca", "verify-full"].includes(env.PGSSLMODE!) ||
    protectedUrls.some((value) => new URL(value).hostname.replace("-pooler.", ".") === env.PGHOST)
  )
    throw new Error("Restore target must be a separate direct database with the dedicated role");
  return env;
}

export function requireRestoreGuard(value: unknown): void {
  if (!value || typeof value !== "object") throw new Error("Restore guard missing");
  const guard = value as Record<string, unknown>;
  if (
    guard.database !== "fhfs_restore_drill" ||
    guard.role !== "backup_restore" ||
    guard.purpose !== "fhfs-private-restore-only" ||
    guard.guardCount !== 1 ||
    guard.superuser !== false ||
    guard.createDatabase !== false ||
    guard.createRole !== false ||
    guard.membershipCount !== 0 ||
    guard.canChangeGuard !== false
  )
    throw new Error("Restore marker or limited-role permissions do not match");
}
