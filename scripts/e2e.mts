/** All browser-test writes go through a marked, dedicated test database. */
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq, like, or, sql } from "drizzle-orm";
import { connect } from "./connect.mjs";
import { films, idols, moments, posts, resumeExperiences, timelineEntries } from "../src/db/schema";
import { hashPassword } from "../src/lib/server/auth/password";
import { testDatabaseProblem } from "../src/lib/e2e";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const operation = process.argv[2];
if (operation && operation !== "prepare") throw new Error("Usage: pnpm e2e [prepare]");
try {
  process.loadEnvFile(path.join(ROOT, ".env.local"));
} catch {
  /* CI supplies its environment. */
}
const testUrl = process.env.TEST_DATABASE_URL;
const production = [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter(
  (url): url is string => Boolean(url),
);
const problem = testDatabaseProblem(testUrl, production);
if (problem) throw new Error(problem);
if (operation !== "prepare") {
  // Do this before any writes or build: never test against an unrelated server.
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();
    probe.once("error", () =>
      reject(new Error("Port 3100 is occupied; stop its server before pnpm e2e")),
    );
    probe.listen(3100, () => probe.close((error) => (error ? reject(error) : resolve())));
  });
}
const db = connect(testUrl!);
// Provision this marker manually in an empty dedicated test project. Nothing
// here creates it: a mistaken production URL cannot make itself eligible.
try {
  const result = await db.execute(
    sql`SELECT marker FROM public.fhfs_e2e_guard WHERE marker = 'fhfs-e2e-only'`,
  );
  if (result.rows.length !== 1) throw new Error("missing marker");
} catch {
  throw new Error(
    "Test database must contain the fhfs_e2e_guard marker; see docs/TESTING.md. No migrations or writes were run.",
  );
}

const state = path.join(ROOT, ".e2e");
await mkdir(state, { recursive: true, mode: 0o700 });
const lock = await open(path.join(state, "lock"), "wx", 0o600).catch(() => {
  throw new Error("Another e2e run is active; only remove .e2e/lock after confirming it stopped");
});
let server: ChildProcess | undefined;
let fixturesReady = false;
let typeSnapshot: { content: string | null } | undefined;
const children = new Set<ChildProcess>();
const interrupted = new AbortController();
function signalGroup(child: ChildProcess, signal: NodeJS.Signals) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return;
    // macOS can report EPERM while a terminated process group is reaped.
    // Fall back to the owned child handle; never signal an unrelated PID.
    if (code === "EPERM") {
      child.kill(signal);
      return;
    }
    throw error;
  }
}
function interrupt(signal: "SIGINT" | "SIGTERM") {
  process.exitCode = signal === "SIGINT" ? 130 : 143;
  interrupted.abort(new Error(`e2e interrupted by ${signal}`));
  for (const child of children) signalGroup(child, "SIGTERM");
}
const onSigint = () => interrupt("SIGINT");
const onSigterm = () => interrupt("SIGTERM");
process.on("SIGINT", onSigint);
process.on("SIGTERM", onSigterm);

async function stopChildren() {
  await Promise.all(
    [...children].map(async (child) => {
      // Signal only live children; a closed group's ID can already be reused.
      signalGroup(child, "SIGTERM");
      if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => signalGroup(child, "SIGKILL"), 5000);
        child.once("close", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }),
  );
}
const secret = randomBytes(32).toString("hex");
const password = randomBytes(24).toString("base64url");
const env = {
  ...process.env,
  DATABASE_URL: testUrl!,
  DATABASE_URL_UNPOOLED: testUrl!,
  AUTH_SECRET: secret,
  ADMIN_PASSWORD_HASH: hashPassword(password),
  E2E_BASE_URL: "http://localhost:3100",
  E2E_BUILD: "true",
};
function run(args: string[]): Promise<void> {
  interrupted.signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", args, { cwd: ROOT, env, stdio: "inherit", detached: true });
    children.add(child);
    child.on("error", reject);
    child.on("close", (code) => {
      children.delete(child);
      if (code === 0) resolve();
      else reject(new Error(`e2e: pnpm ${args[0]} failed (${code})`));
    });
  });
}

try {
  await run(["db:migrate"]);
  await run(["db:import"]);
  interrupted.signal.throwIfAborted();
  fixturesReady = true;
  await db
    .delete(posts)
    .where(
      or(
        like(posts.slug, "e2e-created-%"),
        eq(posts.slug, "e2e-fixture"),
        eq(posts.slug, "e2e-draft"),
      ),
    );
  await db.delete(films).where(like(films.key, "e2e-created-%"));
  await db.delete(moments).where(like(moments.key, "e2e-created-%"));
  await db.delete(idols).where(like(idols.key, "e2e-created-%"));
  await db.delete(resumeExperiences).where(like(resumeExperiences.key, "e2e-created-%"));
  await db.delete(timelineEntries).where(like(timelineEntries.key, "e2e-created-%"));
  interrupted.signal.throwIfAborted();
  await db
    .insert(posts)
    .values([
      {
        slug: "e2e-fixture",
        locale: "zh",
        title: "浏览器测试文章",
        date: "2026-10-12",
        summary: "固定测试数据",
        tags: ["e2e"],
        bodyMd: "测试正文。",
        bodyHtml: "<p>测试正文。</p>",
        readingMinutes: 1,
      },
      {
        slug: "e2e-draft",
        locale: "zh",
        title: "私有测试草稿",
        date: "2026-10-12",
        summary: "不应公开",
        draft: true,
        tags: [],
        bodyMd: "草稿正文。",
        bodyHtml: "<p>草稿正文。</p>",
        readingMinutes: 1,
      },
    ])
    .onConflictDoNothing();
  if (operation === "prepare") {
    console.log(
      "Dedicated test database prepared. pnpm e2e runs the complete production-build flow.",
    );
  } else {
    interrupted.signal.throwIfAborted();
    await writeFile(path.join(state, "session.json"), JSON.stringify({ secret, password }), {
      mode: 0o600,
    });
    // Next still generates the root type entry even with a custom distDir.
    // Restore it after the test; leave the normal build and cache untouched.
    typeSnapshot = {
      content: await readFile(path.join(ROOT, "next-env.d.ts"), "utf8").catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }),
    };
    // A new fixture set must not reuse unstable_cache from the preceding run.
    await rm(path.join(state, "next/cache"), { recursive: true, force: true });
    await run(["build"]);
    interrupted.signal.throwIfAborted();
    server = spawn(
      process.execPath,
      [path.join(ROOT, "node_modules/next/dist/bin/next"), "start", "--port", "3100"],
      {
        cwd: ROOT,
        env,
        stdio: "inherit",
        detached: true,
      },
    );
    children.add(server);
    server.once("close", () => children.delete(server!));
    let startError: Error | undefined;
    server.on("error", (error) => {
      startError = error;
    });
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      interrupted.signal.throwIfAborted();
      if (startError || server.exitCode !== null)
        throw new Error("e2e server exited before becoming ready");
      try {
        const response = await fetch("http://localhost:3100/robots.txt", {
          signal: AbortSignal.any([interrupted.signal, AbortSignal.timeout(1000)]),
        });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        /* Wait only until the bounded readiness deadline. */
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error("e2e server did not become ready");
    if (startError || server.exitCode !== null) throw new Error("e2e server failed to start");
    await run(["exec", "playwright", "test", "--project=chromium", "--project=mobile"]);
  }
} catch (error) {
  if (!interrupted.signal.aborted) throw error;
  console.error("e2e interrupted; stopping child processes and cleaning private test state.");
} finally {
  try {
    try {
      await stopChildren();
    } finally {
      await rm(path.join(state, "session.json"), { force: true });
      if (operation !== "prepare")
        await rm(path.join(state, "next/cache"), { recursive: true, force: true });
      if (typeSnapshot) {
        if (typeSnapshot.content === null)
          await rm(path.join(ROOT, "next-env.d.ts"), { force: true });
        else await writeFile(path.join(ROOT, "next-env.d.ts"), typeSnapshot.content);
      }
      // Keep prepared fixtures for inspection; remove only rows created by tests.
      if (fixturesReady) {
        await db.delete(posts).where(like(posts.slug, "e2e-created-%"));
        await db.delete(films).where(like(films.key, "e2e-created-%"));
        await db.delete(moments).where(like(moments.key, "e2e-created-%"));
        await db.delete(idols).where(like(idols.key, "e2e-created-%"));
        await db.delete(resumeExperiences).where(like(resumeExperiences.key, "e2e-created-%"));
        await db.delete(timelineEntries).where(like(timelineEntries.key, "e2e-created-%"));
      }
    }
  } finally {
    try {
      await lock.close();
      await rm(path.join(state, "lock"), { force: true });
    } finally {
      process.off("SIGINT", onSigint);
      process.off("SIGTERM", onSigterm);
    }
  }
}
