import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ENV_RULES, envProblems } from "@/lib/env";

const root = fileURLToPath(new URL("../../../", import.meta.url));

const good = {
  DATABASE_URL: "postgresql://user:pw@host.neon.tech/db?sslmode=require",
  AUTH_SECRET: "x".repeat(44),
  ADMIN_PASSWORD_HASH: `${"ab".repeat(16)}:${"cd".repeat(64)}`,
};

describe("envProblems", () => {
  it("passes the required three, with the optional ones absent or empty", () => {
    expect(envProblems(good)).toEqual([]);
    expect(envProblems({ ...good, GITHUB_TOKEN: "", DATABASE_URL_UNPOOLED: undefined })).toEqual([]);
  });

  it("names every missing variable at once", () => {
    const problems = envProblems({});
    expect(problems).toHaveLength(3);
    expect(problems.join("\n")).toMatch(/DATABASE_URL is not set[\s\S]*AUTH_SECRET is not set[\s\S]*ADMIN_PASSWORD_HASH is not set/);
  });

  it("treats an empty required value as missing", () => {
    expect(envProblems({ ...good, AUTH_SECRET: "" })).toEqual([expect.stringMatching(/^AUTH_SECRET is not set/)]);
  });

  it("catches a placeholder, a pasted password, a wrong scheme and a stray space", () => {
    expect(envProblems({ ...good, AUTH_SECRET: "changeme" })).toEqual([expect.stringMatching(/^AUTH_SECRET is set but malformed/)]);
    expect(envProblems({ ...good, ADMIN_PASSWORD_HASH: "hunter2" })).toEqual([expect.stringMatching(/^ADMIN_PASSWORD_HASH/)]);
    expect(envProblems({ ...good, DATABASE_URL: "mysql://host/db" })).toEqual([expect.stringMatching(/^DATABASE_URL/)]);
    expect(envProblems({ ...good, DATABASE_URL_UNPOOLED: "host/db" })).toEqual([expect.stringMatching(/^DATABASE_URL_UNPOOLED/)]);
    expect(envProblems({ ...good, SITE_URL: "https://example.com/" })).toEqual([expect.stringMatching(/^SITE_URL/)]);
    expect(envProblems({ ...good, GITHUB_TOKEN: ` ${"g".repeat(40)}` })).toEqual([expect.stringMatching(/^GITHUB_TOKEN/)]);
  });

  it("never repeats a value into the message", () => {
    expect(envProblems({ ...good, AUTH_SECRET: "sekrit-value" }).join("\n")).not.toContain("sekrit-value");
  });
});

describe("the variables the code reads", () => {
  function sources(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      const file = path.join(dir, name);
      if (statSync(file).isDirectory()) {
        if (name !== "__tests__") out.push(...sources(file));
      } else if (/\.m?tsx?$/.test(name)) out.push(file);
    }
    return out;
  }

  // Set by the platform or the toolchain, not by whoever deploys — and
  // CHROME_PATH, which only tells `pnpm smoke` where a browser is.
  const AMBIENT = new Set(["NODE_ENV", "VERCEL_PROJECT_PRODUCTION_URL", "CHROME_PATH"]);

  const read = new Set<string>();
  for (const file of [...sources(path.join(root, "src")), ...sources(path.join(root, "scripts"))]) {
    for (const m of readFileSync(file, "utf8").matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      if (!AMBIENT.has(m[1]!)) read.add(m[1]!);
    }
  }

  it("all have a rule in env.ts", () => {
    expect(read.size).toBeGreaterThan(0);
    expect([...read].filter((name) => !(name in ENV_RULES))).toEqual([]);
  });

  it("are the ones .env.example documents, no more and no fewer", () => {
    const documented = [...readFileSync(path.join(root, ".env.example"), "utf8").matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]);
    expect(documented.sort()).toEqual(Object.keys(ENV_RULES).sort());
  });
});
