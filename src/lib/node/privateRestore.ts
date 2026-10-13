import { createHash } from "node:crypto";

/** pg_dump COPY text escapes embedded tabs/newlines; physical lines are therefore complete rows. */
export function postgresDataFingerprint(sql: string) {
  const tables: Record<string, { columns: string[]; rows: number; sha256: string }> = {};
  const sequences: string[] = [];
  let current: { name: string; columns: string[]; rows: string[] } | undefined;
  const identifier = '(?:"(?:[^"]|"")+"|[a-z_][a-z_0-9]*)';
  const header = new RegExp(`^COPY ((?:public|drizzle)\\.${identifier}) \\((.+)\\) FROM stdin;$`);
  const column = new RegExp(`^${identifier}$`);
  for (const line of sql.split("\n")) {
    if (current) {
      if (line === "\\.") {
        tables[current.name] = {
          columns: current.columns,
          rows: current.rows.length,
          sha256: createHash("sha256")
            .update(JSON.stringify({ columns: current.columns, rows: current.rows.sort() }))
            .digest("hex"),
        };
        current = undefined;
      } else {
        if (line.split("\t").length !== current.columns.length)
          throw new Error("Invalid COPY row in restore comparison");
        current.rows.push(line);
      }
      continue;
    }
    if (line.startsWith("COPY ")) {
      const match = header.exec(line);
      if (!match || Object.hasOwn(tables, match[1]!))
        throw new Error("Invalid or duplicate COPY table in restore comparison");
      const columns = match[2]!.split(", ");
      if (!columns.every((name) => column.test(name)) || new Set(columns).size !== columns.length)
        throw new Error("Invalid COPY columns in restore comparison");
      current = { name: match[1]!, columns, rows: [] };
    } else if (line.startsWith("SELECT pg_catalog.setval(")) {
      if (!/^SELECT pg_catalog\.setval\('[^']+', \d+, (?:true|false)\);$/.test(line))
        throw new Error("Invalid sequence in restore comparison");
      const name = line.split("'")[1]!;
      if (sequences.some((item) => item.split("'")[1] === name))
        throw new Error("Duplicate sequence in restore comparison");
      sequences.push(line);
    } else if (line === "\\.") throw new Error("Unexpected COPY terminator");
  }
  if (current || !Object.hasOwn(tables, "drizzle.__drizzle_migrations"))
    throw new Error("Incomplete restore comparison or missing migration history");
  return {
    tables: Object.fromEntries(Object.entries(tables).sort(([a], [b]) => a.localeCompare(b))),
    sequences: sequences.sort(),
  };
}
