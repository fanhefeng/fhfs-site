/**
 * The static assets in `public/` and how they are cached.
 *
 * Nothing in `public/` passes through the bundler, so nothing there gets a
 * content hash for free. The site gives it one: `asset()` (src/lib/asset.ts)
 * turns `/lab/lens/sea.jpg` into `/lab/lens/sea.3fa9c1d2.jpg`, the hash being
 * the file's own (src/lib/assets.gen.json, written by `pnpm assets`). A rewrite
 * in next.config.ts serves that address from the plain file, and only that
 * address carries a year of `immutable` — the plain one revalidates like any
 * other file. Overwriting a file in place is therefore safe: its address
 * changes with it.
 *
 * This module is the shape of those addresses and nothing else — no `fs`, so
 * next.config.ts, the browser and the tests can all read it.
 */

/** Folders in `public/` whose files are served under a hashed address. */
export const IMMUTABLE_DIRS = [
  "/fonts",
  "/lab/scroll-video",
  "/models",
  "/draco",
  "/grove",
  "/lab/dissolve",
  "/lab/lens",
  "/idols",
  "/films",
  "/music",
  "/moments",
] as const;

/**
 * Folders hashed as one: a single hash over every file inside, carried as a
 * path segment (`/draco/_3fa9c1d2/draco_decoder.wasm`) instead of in each file
 * name. For a folder whose file names are not ours to write — three.js asks
 * the decoder path for `draco_decoder.wasm` by that name — or whose files are
 * too many to list to the browser one hash each: the ninety frames, the font
 * slices. Each sits inside one of `IMMUTABLE_DIRS`.
 */
export const ASSET_SETS = ["/draco", "/fonts/yozai", "/lab/scroll-video/frames"] as const;

/**
 * Folders in `public/` that are deliberately left out — a file that must keep
 * one address while its content changes. Empty today; a folder goes here with
 * the reason, never by being left out of both lists.
 */
export const MUTABLE_DIRS: readonly string[] = [];

export const HASH_LENGTH = 8;
const HASH = `:hash([0-9a-f]{${HASH_LENGTH}})`;

/**
 * The hashed addresses, as next.config.ts `source` patterns paired with the
 * plain file each one is served from.
 *
 * Matched by file and not by prefix. Several of these folders share a name
 * with a page: `/films/odyssey` and `/idols/kobe` without a locale are
 * addresses next-intl answers with a *temporary* redirect to the language it
 * negotiated — and a year of `immutable` on that would nail one visitor's
 * language shut for a year, on a reply that is supposed to be reconsidered
 * every time.
 */
export const HASHED_ROUTES: { source: string; destination: string }[] = [
  ...IMMUTABLE_DIRS.map((dir) => ({
    source: `${dir}/:path*.${HASH}.:ext(\\w+)`,
    destination: `${dir}/:path*.:ext`,
  })),
  ...ASSET_SETS.map((set) => ({
    source: `${set}/_${HASH}/:path*`,
    destination: `${set}/:path*`,
  })),
];

export type AssetManifest = {
  /** `/lab/lens/sea.jpg` → its hash; every immutable file outside a set. */
  files: Record<string, string>;
  /** `/draco` → one hash over the folder. */
  sets: Record<string, string>;
};

function under(urlPath: string, dirs: readonly string[]): boolean {
  return dirs.some((dir) => urlPath.startsWith(`${dir}/`));
}

/** The set a URL path belongs to, if any. */
export function assetSetOf(urlPath: string): string | undefined {
  return ASSET_SETS.find((set) => urlPath.startsWith(`${set}/`));
}

/** Whether a URL path is a file that should be reached by a hashed address. */
export function isImmutable(urlPath: string): boolean {
  return under(urlPath, IMMUTABLE_DIRS);
}

/** URL paths of files in `public/` that no list above accounts for. */
export function unclassified(urlPaths: readonly string[]): string[] {
  return urlPaths.filter((url) => !under(url, IMMUTABLE_DIRS) && !under(url, MUTABLE_DIRS));
}

/** `/lab/lens/sea.jpg` + `3fa9c1d2` → `/lab/lens/sea.3fa9c1d2.jpg`. */
export function withFileHash(urlPath: string, hash: string): string {
  const dot = urlPath.lastIndexOf(".");
  if (dot <= urlPath.lastIndexOf("/")) throw new Error(`asset without an extension: ${urlPath}`);
  return `${urlPath.slice(0, dot)}.${hash}${urlPath.slice(dot)}`;
}

/** `/draco/x.wasm` in set `/draco` + `3fa9c1d2` → `/draco/_3fa9c1d2/x.wasm`. */
export function withSetHash(urlPath: string, set: string, hash: string): string {
  return `${set}/_${hash}${urlPath.slice(set.length)}`;
}

/**
 * The hashed address of a file in `public/`. A path outside the immutable
 * folders — an external URL, a cover the database names — comes back as it
 * is; one inside them that the manifest does not know is a typo or a stale
 * manifest, and throws rather than quietly serving the uncached address.
 */
export function resolveAsset(manifest: AssetManifest, urlPath: string): string {
  if (!isImmutable(urlPath)) return urlPath;
  const set = assetSetOf(urlPath);
  if (set !== undefined) {
    const hash = manifest.sets[set];
    if (hash !== undefined) return withSetHash(urlPath, set, hash);
  } else {
    const hash = manifest.files[urlPath];
    if (hash !== undefined) return withFileHash(urlPath, hash);
  }
  throw new Error(`${urlPath} is not in assets.gen.json — check the path, or run \`pnpm assets\``);
}
