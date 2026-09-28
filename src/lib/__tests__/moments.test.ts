import { describe, expect, it } from "vite-plus/test";
import { validKey } from "@/lib/forms";
import {
  collections,
  describeMedia,
  newestSaid,
  momentKey,
  shouldFold,
  stampInZone,
  type MomentMedia,
} from "@/lib/moments";

describe("stampInZone", () => {
  it("prints the instant in the given zone, dots and a 24-hour clock", () => {
    // 11:28 UTC is 19:28 in Shanghai.
    expect(stampInZone("2017-07-29T11:28:12.000Z", "Asia/Shanghai")).toEqual({
      year: "2017",
      time: "2017.07.29 19:28",
    });
  });

  it("lets the zone move the calendar day, and the year with it", () => {
    expect(stampInZone("2023-12-31T17:30:00.000Z", "Asia/Shanghai")).toEqual({
      year: "2024",
      time: "2024.01.01 01:30",
    });
    expect(stampInZone("2024-01-01T00:10:00.000Z", "Asia/Shanghai").time).toBe("2024.01.01 08:10");
  });
});

describe("momentKey", () => {
  it("is the second in the given zone, in the grammar every key obeys", () => {
    const key = momentKey("2026-09-18T15:15:07.000Z", "Asia/Shanghai");
    expect(key).toBe("m-20260918-231507");
    expect(validKey(key)).toBe(true);
  });
});

describe("collections", () => {
  it("counts the notebooks in order of first appearance", () => {
    const rows = [
      { collection: "峰言峰语" },
      { collection: "默认文集" },
      { collection: "峰言峰语" },
      { collection: null },
    ];
    expect(collections(rows)).toEqual([
      { name: "峰言峰语", count: 2 },
      { name: "默认文集", count: 1 },
    ]);
  });

  it("does not make a notebook out of no notebook", () => {
    expect(collections([{ collection: null }, { collection: "" }])).toEqual([]);
  });
});

describe("shouldFold", () => {
  it("folds by line count before it folds by length", () => {
    expect(shouldFold(Array.from({ length: 11 }, () => "一行").join("\n"))).toBe(true);
    expect(shouldFold(Array.from({ length: 10 }, () => "一行").join("\n"))).toBe(false);
  });

  it("folds a long paragraph even on one line", () => {
    expect(shouldFold("字".repeat(361))).toBe(true);
    expect(shouldFold("字".repeat(360))).toBe(false);
  });
});

describe("describeMedia", () => {
  const image: MomentMedia = { kind: "image", src: "/moments/a.jpg", width: 10, height: 20 };
  const audio: MomentMedia = { kind: "audio", src: "/moments/b.m4a", duration: 65.4 };
  const video: MomentMedia = {
    kind: "video",
    src: "/moments/c.mp4",
    poster: "/moments/c.jpg",
    width: 720,
    height: 1280,
    duration: 30,
  };

  it("names a lone file by its kind, with the length of anything that plays", () => {
    expect(describeMedia([image])).toBe("图片");
    expect(describeMedia([audio])).toBe("语音 1:05");
    expect(describeMedia([video])).toBe("视频 0:30");
  });

  it("counts a kind that repeats, and keeps the kinds in the order they appear", () => {
    expect(describeMedia([image, image, image])).toBe("图片 ×3");
    expect(describeMedia([audio, image, image])).toBe("语音 1:05 · 图片 ×2");
  });

  it("is empty for a line with nothing under it", () => {
    expect(describeMedia([])).toBe("");
  });
});

describe("newestSaid", () => {
  const line = (content: string, postedAt: string) => ({ content, postedAt });

  it("is the newest line with words, whatever order the board keeps", () => {
    const pinned = line("置顶的旧话", "2024-01-01T00:00:00.000Z");
    const newest = line("最新的一句", "2026-09-20T08:00:00.000Z");
    const older = line("早一点的", "2026-09-01T08:00:00.000Z");
    expect(newestSaid([pinned, older, newest])).toBe(newest);
  });

  it("passes over a line that is only a picture", () => {
    const words = line("有字", "2026-09-01T00:00:00.000Z");
    expect(newestSaid([words, line("", "2026-09-28T00:00:00.000Z")])).toBe(words);
  });

  it("is undefined for a board with nothing to quote", () => {
    expect(newestSaid([])).toBeUndefined();
    expect(newestSaid([line("", "2026-09-28T00:00:00.000Z")])).toBeUndefined();
  });
});
