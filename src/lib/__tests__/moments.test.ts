import { describe, expect, it } from "vite-plus/test";
import { validKey } from "@/lib/forms";
import {
  collections,
  describeMedia,
  newestSaid,
  momentKey,
  momentCalendar,
  monthColumns,
  dayCell,
  dayDate,
  dayLevel,
  yearGrid,
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

describe("momentCalendar", () => {
  const zone = "Asia/Shanghai";

  it("counts a day's lines and points at its newest", () => {
    const rows = momentCalendar(
      [
        { key: "a", postedAt: "2024-01-02T04:00:00.000Z" },
        { key: "b", postedAt: "2024-01-02T09:00:00.000Z" },
        { key: "c", postedAt: "2024-01-08T04:00:00.000Z" },
      ],
      zone,
    );
    expect(rows).toEqual([
      {
        year: 2024,
        total: 3,
        days: [
          { day: 1, count: 2, newest: "b" },
          { day: 7, count: 1, newest: "c" },
        ],
      },
    ]);
  });

  it("files a line by the zone's day, which can be next year's", () => {
    const rows = momentCalendar([{ key: "a", postedAt: "2023-12-31T17:30:00.000Z" }], zone);
    expect(rows.map((r) => [r.year, r.days[0]?.day])).toEqual([[2024, 0]]);
  });

  it("gives a silent year its place, newest year first", () => {
    const rows = momentCalendar(
      [
        { key: "a", postedAt: "2019-06-01T04:00:00.000Z" },
        { key: "b", postedAt: "2021-06-01T04:00:00.000Z" },
      ],
      zone,
    );
    expect(rows.map((r) => [r.year, r.total])).toEqual([
      [2021, 1],
      [2020, 0],
      [2019, 1],
    ]);
  });

  it("is empty with nothing said", () => {
    expect(momentCalendar([], zone)).toEqual([]);
  });
});

describe("yearGrid", () => {
  it("puts 1 January on its weekday's row and counts the part-weeks at either end", () => {
    expect(yearGrid(2024)).toEqual({ lead: 0, days: 366, columns: 53 }); // starts on a Monday
    expect(yearGrid(2026)).toEqual({ lead: 3, days: 365, columns: 53 }); // a Thursday
    expect(yearGrid(2040)).toEqual({ lead: 6, days: 366, columns: 54 }); // a Sunday, leap
  });
});

describe("dayCell", () => {
  it("runs down a week, Monday to Sunday, then on to the next column", () => {
    const { lead } = yearGrid(2026);
    expect(dayCell(0, lead)).toEqual({ column: 0, row: 3 }); // Thu 1 January
    expect(dayCell(3, lead)).toEqual({ column: 0, row: 6 }); // Sun 4 January
    expect(dayCell(4, lead)).toEqual({ column: 1, row: 0 }); // Mon 5 January
    expect(dayCell(364, lead)).toEqual({ column: 52, row: 3 }); // Thu 31 December
  });
});

describe("dayDate", () => {
  it("is the start of that day of the year, in UTC", () => {
    expect(dayDate(2024, 59).toISOString()).toBe("2024-02-29T00:00:00.000Z");
    expect(dayDate(2026, 364).toISOString()).toBe("2026-12-31T00:00:00.000Z");
  });
});

describe("monthColumns", () => {
  it("is the column each month's first day falls in", () => {
    // 2026: 1 Feb is a Sunday (column 4), 1 Mar a Sunday too (column 8).
    const columns = monthColumns(2026);
    expect(columns).toHaveLength(12);
    expect(columns.slice(0, 3)).toEqual([0, 4, 8]);
    expect(columns[11]).toBe(48); // 1 December, a Tuesday
  });
});

describe("dayLevel", () => {
  it("shades one, two, three and four-or-more apart, and nothing as nothing", () => {
    expect([0, 1, 2, 3, 4, 9, 20].map(dayLevel)).toEqual([0, 1, 2, 3, 4, 4, 4]);
  });
});
