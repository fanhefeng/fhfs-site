import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { asset } from "@/lib/asset";
import { buildManifest, hashCssUrls, serializeManifest } from "@/lib/assetManifest";
import { IMMUTABLE_DIRS, type AssetManifest } from "@/lib/immutable";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

/** Every .ts/.tsx/.css under `dir`, recursively, tests aside. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) {
      if (name !== "__tests__") out.push(...sourceFiles(file));
    } else if (/\.(tsx?|css)$/.test(name)) out.push(file);
  }
  return out;
}

describe("the committed hashes", () => {
  // Both are generated and committed. A file replaced in public/ without
  // `pnpm assets` would keep its old address — and its year-old copy in
  // every returning browser.
  it("match public/ — run `pnpm assets` if not", () => {
    expect(read("src/lib/assets.gen.json")).toBe(serializeManifest(buildManifest(root)));
  });

  it("are the ones yozai.css asks for — run `pnpm assets` if not", () => {
    const css = read("src/app/yozai.css");
    expect(css).toBe(hashCssUrls(css, buildManifest(root)));
  });
});

describe("hashCssUrls", () => {
  const manifest: AssetManifest = {
    files: { "/grove/moss.webp": "11111111" },
    sets: { "/fonts/yozai": "22222222" },
  };

  it("hashes what is ours and leaves the rest", () => {
    expect(
      hashCssUrls(
        'a{src:url("/fonts/yozai/400/yz-1.woff2")}b{background:url("/grove/moss.webp"),url("/other/x.png")}',
        manifest,
      ),
    ).toBe(
      'a{src:url("/fonts/yozai/_22222222/400/yz-1.woff2")}b{background:url("/grove/moss.11111111.webp"),url("/other/x.png")}',
    );
  });

  it("replaces a hash that has gone stale instead of stacking a second one", () => {
    const stale =
      'a{src:url("/fonts/yozai/_aaaaaaaa/400/yz-1.woff2")}b{background:url("/grove/moss.bbbbbbbb.webp")}';
    const fresh = hashCssUrls(stale, manifest);
    expect(fresh).toBe(
      'a{src:url("/fonts/yozai/_22222222/400/yz-1.woff2")}b{background:url("/grove/moss.11111111.webp")}',
    );
    expect(hashCssUrls(fresh, manifest)).toBe(fresh);
  });
});

describe("asset", () => {
  it("resolves against the committed manifest", () => {
    expect(asset("/lab/lens/sea.jpg")).toMatch(/^\/lab\/lens\/sea\.[0-9a-f]{8}\.jpg$/);
    expect(asset("/draco/")).toMatch(/^\/draco\/_[0-9a-f]{8}\/$/);
  });

  // An address written out by hand still loads — the plain file is there —
  // but revalidates on every visit, with nothing to notice. So the source is
  // checked, not remembered: a quoted path into an immutable folder that ends
  // in a file extension (or is a set's folder) must sit inside `asset(`.
  it("is how every source file reaches an immutable folder", () => {
    const dirs = IMMUTABLE_DIRS.map((dir) => dir.slice(1)).join("|");
    const literal = new RegExp(`(.{0,6})(["'\`])/(?:${dirs})/(?:[^"'\`]*\\.\\w+)?\\2`, "g");
    const bare: string[] = [];
    let seen = 0;
    for (const file of sourceFiles(path.join(root, "src"))) {
      // The three modules that define the scheme quote addresses in their
      // comments, as examples.
      if (file.endsWith(".css") || /\/lib\/(asset|assetManifest|immutable)\.ts$/.test(file))
        continue;
      for (const m of readFileSync(file, "utf8").matchAll(literal)) {
        seen++;
        if (!m[1]!.endsWith("asset("))
          bare.push(`${path.relative(root, file)}: ${m[0].slice(m[1]!.length)}`);
      }
    }
    expect(seen).toBeGreaterThan(10);
    expect(bare).toEqual([]);
  });

  it("is what every stylesheet's url() already went through", () => {
    const dirs = IMMUTABLE_DIRS.map((dir) => dir.slice(1)).join("|");
    const plain = new RegExp(`url\\(["']?/(?:${dirs})/(?![^)]*[._][0-9a-f]{8}[./])[^)]*\\)`, "g");
    const bare = sourceFiles(path.join(root, "src"))
      .filter((file) => file.endsWith(".css"))
      .flatMap((file) =>
        [...readFileSync(file, "utf8").matchAll(plain)].map(
          (m) => `${path.relative(root, file)}: ${m[0]}`,
        ),
      );
    expect(bare).toEqual([]);
  });
});
