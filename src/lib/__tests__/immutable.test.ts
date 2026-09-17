import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { publicFiles } from "@/lib/assetManifest";
import {
  ASSET_SETS,
  type AssetManifest,
  HASHED_ROUTES,
  IMMUTABLE_DIRS,
  MUTABLE_DIRS,
  assetSetOf,
  resolveAsset,
  unclassified,
  withFileHash,
  withSetHash,
} from "@/lib/immutable";

const root = fileURLToPath(new URL("../../../", import.meta.url));

describe("the folder lists", () => {
  // /lab/lens sat outside the list for three weeks because adding a folder to
  // public/ and adding it here were two separate things to remember.
  it("account for every file in public/", () => {
    const all = publicFiles(root);
    expect(all.length).toBeGreaterThan(0);
    expect(unclassified(all)).toEqual([]);
  });

  it("name only folders that exist", () => {
    const missing = [...IMMUTABLE_DIRS, ...MUTABLE_DIRS, ...ASSET_SETS].filter(
      (dir) => !statSync(path.join(root, "public", dir), { throwIfNoEntry: false })?.isDirectory()
    );
    expect(missing).toEqual([]);
  });

  it("put no folder in two lists, nor one inside another", () => {
    const dirs = [...IMMUTABLE_DIRS, ...MUTABLE_DIRS];
    expect(dirs.filter((a, i) => dirs.some((b, j) => i !== j && `${a}/`.startsWith(`${b}/`)))).toEqual([]);
    expect(ASSET_SETS.filter((a, i) => ASSET_SETS.some((b, j) => i !== j && `${a}/`.startsWith(`${b}/`)))).toEqual(
      []
    );
  });

  it("keep every set inside an immutable folder", () => {
    expect(ASSET_SETS.filter((set) => !IMMUTABLE_DIRS.some((dir) => `${set}/`.startsWith(`${dir}/`)))).toEqual([]);
  });
});

describe("unclassified", () => {
  it("reports a file outside every list", () => {
    expect(unclassified(["/films/odyssey/01.jpg", "/new-room/a.jpg", "/robots.txt"])).toEqual([
      "/new-room/a.jpg",
      "/robots.txt",
    ]);
  });

  it("does not take a prefix for a folder", () => {
    expect(unclassified(["/films-old/a.jpg"])).toEqual(["/films-old/a.jpg"]);
  });
});

describe("hashed addresses", () => {
  it("put a file's hash before its extension", () => {
    expect(withFileHash("/lab/lens/sea.jpg", "3fa9c1d2")).toBe("/lab/lens/sea.3fa9c1d2.jpg");
    expect(withFileHash("/models/a.b/head.glb", "3fa9c1d2")).toBe("/models/a.b/head.3fa9c1d2.glb");
  });

  it("refuse a file with no extension, which the rewrite could not match", () => {
    expect(() => withFileHash("/music/theme", "3fa9c1d2")).toThrow();
    expect(() => withFileHash("/lab.v2/theme", "3fa9c1d2")).toThrow();
  });

  it("put a set's hash right under the set's folder", () => {
    expect(withSetHash("/fonts/yozai/400/yz-87.woff2", "/fonts/yozai", "3fa9c1d2")).toBe(
      "/fonts/yozai/_3fa9c1d2/400/yz-87.woff2"
    );
    expect(withSetHash("/draco/", "/draco", "3fa9c1d2")).toBe("/draco/_3fa9c1d2/");
  });

  it("find the set by folder, not by prefix", () => {
    expect(assetSetOf("/draco/draco_decoder.wasm")).toBe("/draco");
    expect(assetSetOf("/draconic/a.jpg")).toBeUndefined();
    expect(assetSetOf("/lab/scroll-video/manifest.json")).toBeUndefined();
  });

  it("have one route per folder and per set", () => {
    expect(HASHED_ROUTES).toHaveLength(IMMUTABLE_DIRS.length + ASSET_SETS.length);
    expect(HASHED_ROUTES).toContainEqual({
      source: "/lab/lens/:path*.:hash([0-9a-f]{8}).:ext(\\w+)",
      destination: "/lab/lens/:path*.:ext",
    });
    expect(HASHED_ROUTES).toContainEqual({ source: "/draco/_:hash([0-9a-f]{8})/:path*", destination: "/draco/:path*" });
  });
});

describe("resolveAsset", () => {
  const manifest: AssetManifest = {
    files: { "/lab/lens/sea.jpg": "11111111" },
    sets: { "/draco": "22222222", "/fonts/yozai": "33333333", "/lab/scroll-video/frames": "44444444" },
  };

  it("hashes a file by its own hash and a set member by the set's", () => {
    expect(resolveAsset(manifest, "/lab/lens/sea.jpg")).toBe("/lab/lens/sea.11111111.jpg");
    expect(resolveAsset(manifest, "/draco/")).toBe("/draco/_22222222/");
    expect(resolveAsset(manifest, "/lab/scroll-video/frames/0001.webp")).toBe(
      "/lab/scroll-video/frames/_44444444/0001.webp"
    );
  });

  it("hands back what is not ours to hash", () => {
    expect(resolveAsset(manifest, "https://example.com/films/a.jpg")).toBe("https://example.com/films/a.jpg");
    expect(resolveAsset(manifest, "/covers/a.jpg")).toBe("/covers/a.jpg");
  });

  it("throws on an immutable path the manifest lacks", () => {
    expect(() => resolveAsset(manifest, "/lab/lens/see.jpg")).toThrow(/pnpm assets/);
    expect(() => resolveAsset({ files: {}, sets: {} }, "/draco/")).toThrow(/pnpm assets/);
  });
});
