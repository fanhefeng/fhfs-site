/**
 * Opens every page the sitemap lists in a real browser and fails on what a
 * unit test cannot see: a request that 404s, an exception, a console error —
 * which is how a Content-Security-Policy violation shows up — or an asset
 * fetched by its plain address instead of its hashed one.
 *
 *   pnpm build && pnpm start &          # or `pnpm dev`
 *   pnpm smoke [base url] [page…]       # default http://localhost:3000, every page
 *
 * No test framework and no browser download: it drives the Chrome already on
 * the machine over the DevTools protocol, with Node's own WebSocket. Set
 * CHROME_PATH if it is somewhere unusual.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { IMMUTABLE_DIRS } from "../src/lib/immutable";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const PORT = 9333;
/** Per page: long enough for the 3D scenes to fetch their models. */
const SETTLE_MS = 6000;

const chrome = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].find((candidate) => candidate && existsSync(candidate));
if (!chrome) {
  console.error("smoke: no Chrome found — set CHROME_PATH");
  process.exit(2);
}

// One language is enough to load every template; both for the home page,
// where the two differ most. The login form is the one page outside the tree.
const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
const listed = [...sitemap.matchAll(/<loc>[^<]*?(\/(?:zh|en)(?:\/[^<]*)?)<\/loc>/g)].map(
  (m) => m[1]!,
);
const everyPage = [
  ...new Set([...listed.filter((p) => p === "/en" || p.startsWith("/zh")), "/admin/login"]),
].sort();
const asked = process.argv.slice(3);
const pages = asked.length > 0 ? asked : everyPage;
if (everyPage.length < 10) {
  console.error(
    `smoke: the sitemap at ${base} lists only ${everyPage.length} pages — is the site up?`,
  );
  process.exit(2);
}

const profile = mkdtempSync(path.join(tmpdir(), "smoke-chrome-"));
const browser = spawn(
  chrome,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-sandbox",
    // Software WebGL, so the 3D scenes run on a machine with no GPU.
    "--enable-unsafe-swiftshader",
    "--autoplay-policy=no-user-gesture-required",
    "about:blank",
  ],
  { stdio: "ignore" },
);
const quit = (code: number): never => {
  browser.kill();
  // Chrome is still writing its profile for a moment after the signal.
  rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  process.exit(code);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let version: Response | undefined;
for (let i = 0; i < 50 && !version?.ok; i++) {
  await sleep(200);
  version = await fetch(`http://localhost:${PORT}/json/version`).catch(() => undefined);
}
if (!version?.ok) {
  console.error("smoke: Chrome did not open its debugging port");
  quit(2);
}

const target = (await (
  await fetch(`http://localhost:${PORT}/json/new?about:blank`, { method: "PUT" })
).json()) as {
  webSocketDebuggerUrl: string;
};
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));

let nextId = 0;
const pending = new Map<number, (result: unknown) => void>();
const send = (method: string, params: object = {}) =>
  new Promise((resolve) => {
    pending.set(++nextId, resolve);
    socket.send(JSON.stringify({ id: nextId, method, params }));
  });

const unhashed = new RegExp(`^(${IMMUTABLE_DIRS.join("|")})/(?!.*[._][0-9a-f]{8}[./]).*\\.\\w+$`);
let problems: string[] = [];

socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data)) as {
    id?: number;
    result?: unknown;
    method?: string;
    params?: any;
  };
  if (message.id !== undefined) {
    pending.get(message.id)?.(message.result);
    pending.delete(message.id);
    return;
  }
  const { method, params } = message;
  if (method === "Network.responseReceived") {
    const { url, status } = params.response as { url: string; status: number };
    if (!url.startsWith(base)) return;
    const pathname = new URL(url).pathname;
    if (status >= 400) problems.push(`${status} ${pathname}`);
    else if (unhashed.test(pathname)) problems.push(`plain address, not asset(): ${pathname}`);
  } else if (method === "Network.loadingFailed" && params.blockedReason) {
    problems.push(`blocked (${params.blockedReason}): request ${params.requestId}`);
  } else if (method === "Runtime.exceptionThrown") {
    const details = params.exceptionDetails;
    problems.push(`exception: ${details.exception?.description?.split("\n")[0] ?? details.text}`);
  } else if (method === "Log.entryAdded" && params.entry.level === "error") {
    problems.push(
      `console: ${params.entry.text}${params.entry.url ? ` (${params.entry.url})` : ""}`,
    );
  } else if (method === "Runtime.consoleAPICalled" && params.type === "error") {
    problems.push(
      `console.error: ${params.args
        .map((arg: any) => arg.value ?? arg.description ?? "")
        .join(" ")
        .slice(0, 300)}`,
    );
  }
});

await send("Network.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});

let failed = 0;
for (const page of pages) {
  problems = [];
  await send("Page.navigate", { url: base + page });
  await sleep(SETTLE_MS);
  // Walk the page once, for whatever waits to be scrolled to.
  await send("Runtime.evaluate", {
    expression:
      "(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=800){scrollTo(0,y);await new Promise(r=>setTimeout(r,100))}})()",
    awaitPromise: true,
  });
  await sleep(1500);
  const found = [...new Set(problems)];
  console.log(`${found.length === 0 ? "ok  " : "FAIL"} ${page}`);
  for (const problem of found) console.log(`       ${problem}`);
  if (found.length > 0) failed++;
}

console.log(
  failed === 0
    ? `smoke: ${pages.length} pages, nothing wrong`
    : `smoke: ${failed} of ${pages.length} pages have problems`,
);
quit(failed === 0 ? 0 : 1);
