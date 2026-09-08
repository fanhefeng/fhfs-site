import { describe, expect, it } from "vitest";
import { groupByYear, yearOfDate } from "@/lib/byYear";

describe("groupByYear", () => {
  it("buckets a newest-first list by year, keeping the order inside each", () => {
    const rows = [
      { key: "c", year: "2024" },
      { key: "b", year: "2023" },
      { key: "a", year: "2023" },
    ];
    expect(groupByYear(rows, (row) => row.year)).toEqual([
      { year: "2024", items: [rows[0]] },
      { year: "2023", items: [rows[1], rows[2]] },
    ]);
  });

  it("is empty for an empty list", () => {
    expect(groupByYear([], () => "")).toEqual([]);
  });

  it("opens a second bucket for a year that comes back, rather than merging", () => {
    // A list that is not sorted the way an index claims should look wrong,
    // not be quietly repaired into one tidy bucket.
    const rows = [{ year: "2024" }, { year: "2023" }, { year: "2024" }];
    expect(groupByYear(rows, (row) => row.year).map((g) => g.year)).toEqual([
      "2024",
      "2023",
      "2024",
    ]);
  });
});

describe("yearOfDate", () => {
  it("reads the year off the string, not through a Date", () => {
    expect(yearOfDate({ date: "2026-01-01" })).toBe("2026");
    // A Date would move this one back a day — and a year — west of UTC.
    expect(yearOfDate({ date: "2024-01-01" })).toBe("2024");
  });
});
