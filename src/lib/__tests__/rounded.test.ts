import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const read = (file: string) => readFileSync(path.join(root, file));
const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const recipe = JSON.parse(read("tools/rounded.gen.json").toString()) as {
  fonttools: string;
  brotli: string;
  folder: string;
  family: string;
  sourceVersion: string;
  axes: { ROND: number; wght: number[] };
  chunks: string[];
  charset: { count: number; sha256: string };
  license: { sha256: string };
  outputs: { file: string; bytes: number; sha256: string }[];
};
const css = read("src/app/rounded.css").toString();
const points = (text: string) =>
  Array.from(text, (char) => char.codePointAt(0)!).sort((a, b) => a - b);
const outputPath = (file: string) =>
  file.startsWith("fonts/")
    ? `public/fonts/rounded/${recipe.folder}/${file.slice(6)}`
    : `src/lib/server/og-fonts/${file.slice(3)}`;

describe("the shared rounded Chinese family", () => {
  it("pins the official source, full rounding, and the variable weight range", () => {
    expect(recipe.sourceVersion).toBe("v1.910");
    expect(recipe.fonttools).toBe("4.66.1");
    expect(recipe.brotli).toBe("1.2.0");
    expect(recipe.family).toBe("FHFS Rounded SC");
    expect(recipe.axes).toEqual({ ROND: 100, wght: [200, 900] });
  });

  it("covers the pinned CJK inventory without substituting Latin or duplicating slices", () => {
    const characters = points(recipe.chunks.join(""));
    expect(characters).toHaveLength(29758);
    expect(recipe.charset.count).toBe(characters.length);
    expect(new Set(characters).size).toBe(characters.length);
    expect(characters.every((point) => point >= 0x2e80)).toBe(true);
    expect(sha(String.fromCodePoint(...characters))).toBe(recipe.charset.sha256);
    expect(recipe.chunks.every((chunk) => Array.from(chunk).length <= 200)).toBe(true);
    for (const char of "中文标签密码引语圆体𠂇") {
      expect(characters).toContain(char.codePointAt(0));
    }
  });

  it("ships the recorded WOFF2 slices and the two static OG weights", () => {
    expect(recipe.outputs).toHaveLength(recipe.chunks.length + 2);
    for (const output of recipe.outputs) {
      const bytes = read(outputPath(output.file));
      expect(bytes.subarray(0, 4).toString("ascii")).toBe(
        output.file.startsWith("fonts/") ? "wOF2" : "wOFF",
      );
      expect(bytes.length).toBe(output.bytes);
      expect(sha(bytes)).toBe(output.sha256);
    }
    expect(
      recipe.outputs.filter((file) => file.file.startsWith("og/")).map((file) => file.file),
    ).toEqual(["og/RoundedSC-400.woff", "og/RoundedSC-600.woff"]);
    expect(
      readdirSync(path.join(root, `public/fonts/rounded/${recipe.folder}`))
        .filter((name) => name.endsWith(".woff2"))
        .sort(),
    ).toEqual(
      recipe.outputs
        .filter((file) => file.file.startsWith("fonts/"))
        .map((file) => file.file.slice(6))
        .sort(),
    );
  });

  it("maps each range exactly once to a self-hosted variable slice", () => {
    const faces = [...css.matchAll(/@font-face\{([^}]+)\}/g)];
    expect(faces).toHaveLength(recipe.chunks.length);
    faces.forEach(([, rule], index) => {
      expect(rule).toContain('font-family:"FHFS Rounded SC";');
      expect(rule).toContain("font-weight:200 900;");
      expect(rule).toContain("font-display:swap;");
      expect(rule).toMatch(
        new RegExp(
          `/fonts/rounded/_[0-9a-f]{8}/${recipe.folder}/cn-${String(index).padStart(3, "0")}\\.woff2`,
        ),
      );
      const ranges = /unicode-range:([^;]+);/.exec(rule!)![1]!.split(",");
      const actual = ranges.flatMap((range) => {
        const [start, end] = range
          .slice(2)
          .split("-")
          .map((hex) => Number.parseInt(hex, 16));
        return Array.from({ length: (end ?? start!) - start! + 1 }, (_, i) => start! + i);
      });
      expect(actual).toEqual(points(recipe.chunks[index]!));
    });
    expect(css).not.toMatch(/src:local\(|https?:\/\//);
    expect(sha(read(`public/fonts/rounded/${recipe.folder}/LICENSE.txt`))).toBe(
      recipe.license.sha256,
    );
    expect(sha(read("src/lib/server/og-fonts/rounded-OFL.txt"))).toBe(recipe.license.sha256);
  });
});
