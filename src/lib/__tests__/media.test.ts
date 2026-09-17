import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ODYSSEY_STILLS } from "@/components/films/odysseyStills";
import { SECRET_STILLS } from "@/components/films/secretStills";
import { IDOLS } from "@/components/idols/entries";
import { KOBE_PHOTOS } from "@/components/idols/kobePhotos";
import { NEON_STILLS } from "@/components/lab/neonStills";
import frames from "../../../public/lab/scroll-video/manifest.json";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const inPublic = (file: string) => path.join(root, "public", file);

/** Width and height out of a JPEG's start-of-frame segment. */
function jpegSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1]!;
    // SOF0–SOF15, minus the three in that range that are not frame headers.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: bytes.readUInt16BE(i + 7), height: bytes.readUInt16BE(i + 5) };
    }
    i += 2 + bytes.readUInt16BE(i + 2);
  }
  throw new Error(`no frame header in ${file}`);
}

const jpegsIn = (dir: string) =>
  readdirSync(inPublic(dir))
    .filter((name) => /\.jpe?g$/.test(name))
    .sort();

// The width and height written next to each file name are what next/image
// reserves the box with. A picture swapped for one of another shape still
// loads — into the old box, cropped or letterboxed, with nothing to notice.
describe("the pictures listed in code", () => {
  const galleries = [
    {
      name: "odyssey stills",
      dir: "films/odyssey",
      items: ODYSSEY_STILLS.map((s) => ({ ...s, file: `${s.file}.jpg` })),
    },
    {
      name: "secret stills",
      dir: "films/secret",
      items: SECRET_STILLS.map((s) => ({ ...s, file: `${s.file}.jpg` })),
    },
    {
      name: "neon stills",
      dir: "lab/neon",
      items: NEON_STILLS.map((s) => ({ ...s, file: `${s.file}.jpg` })),
    },
    { name: "kobe photos", dir: "idols/kobe", items: KOBE_PHOTOS },
  ];

  for (const { name, dir, items } of galleries) {
    it(`${name}: every size is the file's own`, () => {
      const wrong = items
        .map((item) => ({ item, real: jpegSize(inPublic(`${dir}/${item.file}`)) }))
        .filter(({ item, real }) => item.width !== real.width || item.height !== real.height)
        .map(
          ({ item, real }) =>
            `${item.file}: says ${item.width}×${item.height}, is ${real.width}×${real.height}`,
        );
      expect(wrong).toEqual([]);
    });

    it(`${name}: the list and the folder hold the same files`, () => {
      expect(items.map((item) => item.file).sort()).toEqual(jpegsIn(dir));
    });
  }

  it("idol covers: every size is the file's own", () => {
    for (const idol of IDOLS) {
      // `src` has been through asset(); the hash comes back off.
      const file = idol.cover.src.replace(/\.[0-9a-f]{8}(?=\.\w+$)/, "");
      expect({ file, ...jpegSize(inPublic(file)) }).toEqual({
        file,
        width: idol.cover.width,
        height: idol.cover.height,
      });
    }
  });
});

describe("the scroll-video manifest", () => {
  it("counts the frames that are there, under the names it gives them", () => {
    const names = Array.from({ length: frames.frameCount }, (_, i) =>
      frames.pattern.replace("%d", String(i + 1).padStart(frames.padding, "0")),
    );
    expect(
      readdirSync(inPublic("lab/scroll-video/frames"))
        .filter((name) => name !== ".DS_Store")
        .sort(),
    ).toEqual(names.sort());
  });
});
