/**
 * The media site's two jobs (src/lib/mediaSite.ts, media/):
 *
 *   pnpm media:pull     fetch every file the database points at into media/files/
 *   pnpm media:deploy   upload media/files/ as the Worker's assets
 *
 * media/files/ is not in git — the site is where the files live — so a fresh
 * clone starts with `media:pull`. To add a file: pull, put it under
 * media/files/<folder>/, deploy, then write its address
 * (`${MEDIA_ORIGIN}/<folder>/<name>`) into the admin; deploy prints the
 * line the board's media field wants for each file nothing points at yet.
 *
 * A deploy replaces every asset at once. So it refuses when a file the
 * database points at — drafts included — is missing from media/files/, and
 * when a file is over Cloudflare's 25 MiB. It writes media/sizes.gen.json
 * (the lengths the Worker answers ranges with; commit it) and files/_headers,
 * then runs the global `wrangler` (vp install -g wrangler) from media/.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isTable } from "drizzle-orm";
import { MEDIA_ORIGIN } from "../src/config/csp";
import * as schema from "../src/db/schema";
import { MEDIA_FILE_LIMIT, MEDIA_HEADERS, mediaPaths } from "../src/lib/mediaSite";
import { connect } from "./connect.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mediaDir = path.join(root, "media");
const filesDir = path.join(mediaDir, "files");

/** Every media-site path any row points at, drafts and all — the login throttle aside. */
async function referenced(): Promise<string[]> {
  const db = connect();
  const text: string[] = [];
  for (const [name, table] of Object.entries(schema)) {
    if (!isTable(table) || name === "loginAttempts") continue;
    text.push(JSON.stringify(await db.select().from(table as typeof schema.moments)));
  }
  return mediaPaths(text.join("\n"), MEDIA_ORIGIN);
}

/** Every file under media/files/, as site paths. */
function local(dir = filesDir, prefix = ""): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || entry.name === "_headers") return [];
    const site = `${prefix}/${entry.name}`;
    return entry.isDirectory() ? local(path.join(dir, entry.name), site) : [site];
  });
}

async function pull() {
  const wanted = await referenced();
  let fetched = 0;
  for (const site of wanted) {
    const file = path.join(filesDir, site);
    if (existsSync(file)) continue;
    const response = await fetch(`${MEDIA_ORIGIN}${site}`);
    if (!response.ok) throw new Error(`${site}: ${response.status}`);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(await response.arrayBuffer()));
    fetched++;
  }
  console.log(`media/files: ${wanted.length} files the database points at, ${fetched} fetched now`);
}

/** The line the board's media field wants for a file, measured with ffprobe when it can be. */
function mediaLine(site: string): string {
  const url = `${MEDIA_ORIGIN}${site}`;
  const probe = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_streams",
      "-show_format",
      path.join(filesDir, site),
    ],
    { encoding: "utf8" },
  );
  if (probe.status !== 0) return url;
  const info = JSON.parse(probe.stdout) as {
    streams: { codec_type: string; width?: number; height?: number }[];
    format: { duration?: string };
  };
  const video = info.streams.find((s) => s.codec_type === "video");
  const seconds = `${Math.round(Number(info.format.duration ?? 0) * 10) / 10}s`;
  if (/\.(jpe?g|png|webp|gif|avif)$/i.test(site))
    return `image ${url} ${video?.width}x${video?.height}`;
  if (!video) return `audio ${url} ${seconds}`;
  return `video ${url} ${video.width}x${video.height} ${seconds} poster=…`;
}

async function deploy() {
  const files = local();
  const have = new Set(files);
  const wanted = await referenced();
  const missing = wanted.filter((site) => !have.has(site));
  const tooBig = files.filter(
    (site) => statSync(path.join(filesDir, site)).size > MEDIA_FILE_LIMIT,
  );
  if (missing.length > 0 || tooBig.length > 0) {
    if (missing.length > 0) {
      console.error(
        `Missing from media/files/ — a deploy now would take them off the site (run pnpm media:pull):\n  ${missing.join("\n  ")}`,
      );
    }
    if (tooBig.length > 0) {
      console.error(`Over 25 MiB, which Cloudflare refuses — re-encode:\n  ${tooBig.join("\n  ")}`);
    }
    process.exit(1);
  }

  const sizes = Object.fromEntries(
    files.sort().map((site) => [site, statSync(path.join(filesDir, site)).size]),
  );
  writeFileSync(path.join(mediaDir, "sizes.gen.json"), `${JSON.stringify(sizes, null, 2)}\n`);
  writeFileSync(path.join(filesDir, "_headers"), MEDIA_HEADERS);

  // From media/, so wrangler finds its config there and nothing of the site's.
  const run = spawnSync("wrangler", ["deploy"], { cwd: mediaDir, stdio: "inherit" });
  if (run.error)
    throw new Error("wrangler not found — vp install -g wrangler, then wrangler login");
  if (run.status !== 0) process.exit(run.status ?? 1);

  const fresh = files.filter((site) => !wanted.includes(site));
  console.log(`\n${files.length} files live at ${MEDIA_ORIGIN}; commit media/sizes.gen.json.`);
  if (fresh.length > 0) {
    console.log(
      `Nothing points at these yet — the media field's lines:\n  ${fresh.map(mediaLine).join("\n  ")}`,
    );
  }
}

const job = process.argv[2];
if (job === "pull") await pull();
else if (job === "deploy") await deploy();
else throw new Error("pnpm media:pull | pnpm media:deploy");
