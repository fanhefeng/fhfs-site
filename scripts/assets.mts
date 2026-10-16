/**
 * Hashes the immutable files in `public/` and writes the two things that
 * carry those hashes: src/lib/assets.gen.json, which `asset()` reads, and the
 * slice addresses in src/app/{yozai,rounded}.css.
 *
 *   pnpm assets     # after adding, replacing or removing a file in public/
 *
 * Both outputs are committed; `pnpm check` fails when either is behind.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildManifest, hashCssUrls, serializeManifest } from "../src/lib/node/assetManifest";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifestFile = `${root}src/lib/assets.gen.json`;
const cssFiles = ["yozai.css", "rounded.css"].map((name) => `${root}src/app/${name}`);

const manifest = buildManifest(root);
writeFileSync(manifestFile, serializeManifest(manifest));
for (const cssFile of cssFiles) {
  writeFileSync(cssFile, hashCssUrls(readFileSync(cssFile, "utf8"), manifest));
}

console.log(
  `assets: ${Object.keys(manifest.files).length} files, ${Object.keys(manifest.sets).length} sets → src/lib/assets.gen.json, font stylesheets`,
);
