/**
 * Encodes a record for the jukebox the way the four in public/music were.
 *
 *   pnpm media:music <source file> <name>     # → public/music/<name>.mp3
 *
 * The recipe used to live in README.md as a sentence, to be retyped from:
 * metadata stripped (a purchased file carries the buyer's name), LAME VBR
 * `-q:a 5` at 44.1 kHz — about 112 kbps, a third of a 320 kbps source and
 * inaudibly different behind a page. The players loop, so silence at either
 * end is a gap on every lap; it is measured here and reported rather than
 * trimmed, because how much of a fade-out to keep is a judgement.
 *
 * Needs ffmpeg on PATH (`brew install ffmpeg`). Finishes with `pnpm assets`,
 * so the new file has its hashed address; wiring it to a room is
 * src/lib/tracks.ts.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const [source, name] = process.argv.slice(2);
if (!source || !name || process.argv.length > 4) {
  console.error("usage: pnpm media:music <source file> <name>");
  process.exit(2);
}
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
  console.error(`"${name}": lowercase words joined by hyphens, no extension — it becomes a URL.`);
  process.exit(2);
}
if (!existsSync(source)) {
  console.error(`${source}: no such file`);
  process.exit(2);
}

const root = fileURLToPath(new URL("../", import.meta.url));
const out = `${root}public/music/${name}.mp3`;

execFileSync(
  "ffmpeg",
  ["-hide_banner", "-loglevel", "error", "-y", "-i", source, "-vn", "-map_metadata", "-1", "-c:a", "libmp3lame", "-q:a", "5", "-ar", "44100", out],
  { stdio: "inherit" }
);

// silencedetect writes to stderr; -60 dB for half a second is silence, not a quiet bar.
const probe = spawnSync("ffmpeg", ["-hide_banner", "-i", out, "-af", "silencedetect=noise=-60dB:d=0.5", "-f", "null", "-"], {
  encoding: "utf8",
});
const duration = Number(/Duration: (\d+):(\d+):([\d.]+)/.exec(probe.stderr)?.slice(1).reduce((t, part) => t * 60 + Number(part), 0));
const silences = [...probe.stderr.matchAll(/silence_start: (-?[\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map((m): [number, number] => [
  Math.max(0, Number(m[1])),
  Number(m[2]),
]);
const lead = silences.find(([start]) => start < 0.05);
const tail = silences.find(([, end]) => duration - end < 0.05);

const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;
console.log(`${out.slice(root.length)}  ${mb(statSync(source).size)} → ${mb(statSync(out).size)}  ${duration.toFixed(1)} s`);
if (lead) console.warn(`  silent for the first ${(lead[1] - lead[0]).toFixed(1)} s — a gap on every loop; trim the source and run again`);
if (tail) console.warn(`  silent for the last ${(tail[1] - tail[0]).toFixed(1)} s — a gap on every loop; trim the source and run again`);

execFileSync("pnpm", ["-s", "assets"], { cwd: root, stdio: "inherit" });
