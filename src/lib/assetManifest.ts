/**
 * Builds what `pnpm assets` writes and `assetManifest.test.ts` compares
 * against: the hash manifest (src/lib/assets.gen.json) and the font
 * stylesheet with its slice addresses hashed. Node only — it reads `public/`.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  ASSET_SETS,
  type AssetManifest,
  HASH_LENGTH,
  assetSetOf,
  isImmutable,
  resolveAsset,
} from "./immutable";

/** URL paths (`/lab/lens/sea.jpg`) of every file under `<root>/public`, sorted. */
export function publicFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(path.join(root, "public", dir))) {
      const url = `${dir}/${name}`;
      if (statSync(path.join(root, "public", url)).isDirectory()) walk(url);
      else if (name !== ".DS_Store") out.push(url);
    }
  };
  walk("");
  // Code-unit order, not the locale's: the manifest has to come out the same
  // on this Mac and on the CI runner.
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

const digest = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");

export function buildManifest(root: string): AssetManifest {
  const manifest: AssetManifest = { files: {}, sets: {} };
  const members: Record<string, string[]> = Object.fromEntries(ASSET_SETS.map((set) => [set, []]));
  for (const url of publicFiles(root).filter(isImmutable)) {
    const hash = digest(readFileSync(path.join(root, "public", url)));
    const set = assetSetOf(url);
    if (set === undefined) manifest.files[url] = hash.slice(0, HASH_LENGTH);
    // A set's hash covers names as well as bytes: a file renamed inside it
    // is a different folder to whoever asks for the old name.
    else members[set]!.push(`${url}\0${hash}`);
  }
  for (const set of ASSET_SETS) {
    manifest.sets[set] = digest(members[set]!.join("\n")).slice(0, HASH_LENGTH);
  }
  return manifest;
}

/** What goes on disk: stable key order comes from `publicFiles`, and a final newline. */
export function serializeManifest(manifest: AssetManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * A stylesheet with every `url("/…")` into an immutable folder pointed at its
 * hashed address. An address that is already hashed is brought back to the
 * plain one first, so running this twice — or after the files changed —
 * lands on the same text.
 */
export function hashCssUrls(css: string, manifest: AssetManifest): string {
  const hashed = new RegExp(
    `/_[0-9a-f]{${HASH_LENGTH}}(?=/)|\\.[0-9a-f]{${HASH_LENGTH}}(?=\\.\\w+$)`,
    "g",
  );
  return css.replace(/url\("(\/[^"]+)"\)/g, (whole, url: string) => {
    const plain = url.replace(hashed, "");
    return isImmutable(plain) ? `url("${resolveAsset(manifest, plain)}")` : whole;
  });
}
