import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const recipe = JSON.parse(readFileSync(path.join(root, "tools/yozai.gen.json"), "utf8")) as {
  version: number;
  folder: string;
  family: string;
  alias: string;
  fonttools: string;
  brotli: string;
  sourceVersion: string;
  charset: { count: number; sha256: string };
  chunks: string[];
  license: { sha256: string };
  legacy: { files: number; sha256: string };
  outputs: { weight: string; file: string; bytes: number; sha256: string }[];
};
const base = path.join(root, "public/fonts/yozai");
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const css = readFileSync(path.join(root, "src/app/yozai.css"), "utf8");
// CSS unicode-range describes code points, rather than grapheme clusters.
const codepoints = (text: string) =>
  Array.from(text, (char) => char.codePointAt(0)!).sort((a, b) => a - b);

describe("reproducible rounded CJK fonts", () => {
  it("pins the build toolchain and a distinct internal name for the derived font", () => {
    expect(recipe.version).toBe(1);
    expect(recipe.fonttools).toBe("4.66.1");
    expect(recipe.brotli).toBe("1.2.0");
    expect(recipe.sourceVersion).toBe("v0.868");
    expect(recipe.family).toBe("FHFS Round CJK");
    expect(recipe.alias).toBe("Yozai");
  });

  it("preserves the complete legacy character inventory without duplicate slices", () => {
    const all = codepoints(recipe.chunks.join(""));
    expect(all).toHaveLength(8542);
    expect(recipe.charset.count).toBe(all.length);
    expect(new Set(all).size).toBe(all.length);
    expect(all.every((cp) => cp < 0xd800 || cp > 0xdfff)).toBe(true);
    expect(sha(String.fromCodePoint(...all))).toBe(recipe.charset.sha256);
    expect(
      recipe.chunks.every((chunk) => {
        const count = Array.from(chunk).length;
        return count > 0 && count <= 100;
      }),
    ).toBe(true);
  });

  it("serves exactly the recorded valid WOFF2 bytes for both weights", () => {
    expect(recipe.outputs).toHaveLength(recipe.chunks.length * 2);
    const recorded: string[] = [];
    for (const output of recipe.outputs) {
      expect(output.file).toMatch(/^(400|500)\/cn-\d{3}\.woff2$/);
      expect(output.file.split("/")[0]).toBe(output.weight);
      const bytes = readFileSync(path.join(base, recipe.folder, output.file));
      expect(bytes.subarray(0, 4).toString("ascii")).toBe("wOF2");
      expect(bytes.length).toBe(output.bytes);
      expect(sha(bytes)).toBe(output.sha256);
      recorded.push(output.file);
    }
    const actual = ["400", "500"].flatMap((weight) =>
      readdirSync(path.join(base, recipe.folder, weight))
        .filter((f) => f.endsWith(".woff2"))
        .map((file) => `${weight}/${file}`),
    );
    expect(actual.sort()).toEqual(recorded.sort());
  });

  it("maps each CSS unicode range to its recorded slice and intended weight", () => {
    const faces = [...css.matchAll(/@font-face\{([^}]+)\}/g)];
    expect(faces).toHaveLength(recipe.outputs.length);
    const used = new Set<string>();
    for (const [, rule] of faces) {
      const url = /url\("([^"]+)"\)/.exec(rule!)![1]!.replace(/\/_[0-9a-f]{8}(?=\/)/g, "");
      const file = url.replace(`/fonts/yozai/${recipe.folder}/`, "");
      expect(recipe.outputs.some((output) => output.file === file)).toBe(true);
      expect(used.has(file)).toBe(false);
      used.add(file);
      const [weight, name] = file.split("/");
      const index = Number(/cn-(\d+)\.woff2/.exec(name!)![1]);
      const ranges = /unicode-range:([^;]+);/.exec(rule!)![1]!.split(",");
      const characters = ranges.flatMap((range) => {
        const bounds = range
          .slice(2)
          .split("-")
          .map((hex) => Number.parseInt(hex, 16));
        const start = bounds[0]!;
        return Array.from({ length: (bounds[1] ?? start) - start + 1 }, (_, i) => start + i);
      });
      expect(characters).toEqual(codepoints(recipe.chunks[index]!));
      expect(rule).toContain(`font-weight:${weight === "400" ? "400" : "500 900"};`);
      expect(rule).toContain('font-family:"Yozai";');
      expect(rule).toContain("font-display:swap;");
    }
  });

  it("retains legacy font bytes so cached old stylesheets remain usable", () => {
    const files = ["400", "500"]
      .flatMap((weight) =>
        readdirSync(path.join(base, weight))
          .filter((f) => f.endsWith(".woff2"))
          .map((file) => `${weight}/${file}`),
      )
      .sort();
    expect(files).toHaveLength(recipe.legacy.files);
    expect(
      sha(files.map((file) => `${file}\0${sha(readFileSync(path.join(base, file)))}`).join("\n")),
    ).toBe(recipe.legacy.sha256);
  });

  it("preserves the full upstream license and uses the pinned self-hosted files", () => {
    expect(sha(readFileSync(path.join(base, recipe.folder, "LICENSE.txt")))).toBe(
      recipe.license.sha256,
    );
    expect(css).not.toMatch(/src:local\(|https?:\/\//);
  });
});
