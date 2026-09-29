import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { statueStandIn } from "@/components/idols/statue";
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

type Picture = { id: string; src: string; width: number; height: number };
type Backup = {
  films: { key: string; stills: Picture[] }[];
  idols: { key: string; photos: Picture[] }[];
};

/** The films' and idols' pictures, as the committed backup has them. */
const backup = JSON.parse(readFileSync(path.join(root, "backup/db.json"), "utf8")) as Backup;
const walls = [
  ...backup.films.map((film) => ({ name: `film ${film.key}`, pictures: film.stills })),
  ...backup.idols.map((idol) => ({ name: `idol ${idol.key}`, pictures: idol.photos })),
];

// The width and height stored beside each picture are what next/image
// reserves the box with. A picture swapped for one of another shape still
// loads — into the old box, cropped or letterboxed, with nothing to notice.
// The films and idols keep theirs in the database, edited in /admin, so this
// reads the backup (`pnpm db:export`); an upload's size is measured by the
// browser that sends it, so only the files in `public/` are checked here.
describe("the pictures the rooms hang", () => {
  it("finds the walls", () => {
    expect(walls.length).toBeGreaterThan(0);
  });

  for (const { name, pictures } of walls) {
    it(`${name}: every file is there, at the size it says`, () => {
      const wrong = pictures
        .filter((picture) => picture.src.startsWith("/"))
        .flatMap((picture) => {
          const file = inPublic(picture.src);
          if (!existsSync(file)) return [`${picture.src}: no such file in public/`];
          const real = jpegSize(file);
          return picture.width === real.width && picture.height === real.height
            ? []
            : [
                `${picture.src}: says ${picture.width}×${picture.height}, is ${real.width}×${real.height}`,
              ];
        });
      expect(wrong).toEqual([]);
    });
  }

  it("the statue's stand-in is the size it says", () => {
    const { src, width, height } = statueStandIn();
    // `src` has been through asset(); the hash comes back off.
    const file = src.replace(/\.[0-9a-f]{8}(?=\.\w+$)/, "");
    expect({ file, ...jpegSize(inPublic(file)) }).toEqual({ file, width, height });
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
