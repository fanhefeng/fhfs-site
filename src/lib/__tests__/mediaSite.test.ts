import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { MEDIA_ORIGIN } from "@/config/csp";
import { mediaPaths } from "@/lib/mediaSite";

const root = path.resolve(import.meta.dirname, "../../..");

describe("mediaPaths", () => {
  const origin = "https://media.example.dev";

  it("finds every address on the media site, once, as a site path", () => {
    const text = JSON.stringify([
      { kind: "image", src: `${origin}/moments/a.jpg` },
      { kind: "video", src: `${origin}/moments/b.mp4`, poster: `${origin}/moments/b.jpg` },
      { kind: "image", src: `${origin}/moments/a.jpg` },
    ]);
    expect(mediaPaths(text, origin)).toEqual([
      "/moments/a.jpg",
      "/moments/b.jpg",
      "/moments/b.mp4",
    ]);
  });

  it("reads them out of markdown and prose too", () => {
    expect(mediaPaths(`![x](${origin}/posts/c.png) and ${origin}/posts/d.mp3.`, origin)).toEqual([
      "/posts/c.png",
      "/posts/d.mp3",
    ]);
  });

  it("ignores a lookalike host and this site's own paths", () => {
    expect(mediaPaths(`${origin}.evil.com/a.jpg /moments/e.jpg`, origin)).toEqual([]);
  });
});

// The Worker answers a voice note's or a video's ranges by the length the
// deploy wrote down (media/worker.ts). A file the database points at with no
// length was not in the last deploy — it is missing from the site, or the
// table was not committed after it.
describe("the media site's size table", () => {
  it("has every file the committed backup points at", () => {
    const backup = readFileSync(path.join(root, "backup/db.json"), "utf8");
    const sizes = JSON.parse(
      readFileSync(path.join(root, "media/sizes.gen.json"), "utf8"),
    ) as Record<string, number>;
    const referenced = mediaPaths(backup, MEDIA_ORIGIN);
    expect(referenced.length).toBeGreaterThan(0);
    expect(referenced.filter((p) => !(p in sizes))).toEqual([]);
  });
});
