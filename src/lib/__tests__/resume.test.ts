import { describe, expect, it } from "vitest";
import {
  formatProjects,
  formatSkillLines,
  lines,
  parseInline,
  parseProjects,
  parseSkillLines,
} from "@/lib/resume";

describe("lines", () => {
  it("drops blanks and trims the rest", () => {
    expect(lines("  a \n\n b\n   \n")).toEqual(["a", "b"]);
  });
});

describe("parseInline", () => {
  it("leaves plain text as one run", () => {
    expect(parseInline("just words")).toEqual([
      { text: "just words", kind: "text" },
    ]);
  });

  it("splits strong and code spans out of a line", () => {
    expect(parseInline("start **60%** and `zod` end")).toEqual([
      { text: "start ", kind: "text" },
      { text: "60%", kind: "strong" },
      { text: " and ", kind: "text" },
      { text: "zod", kind: "code" },
      { text: " end", kind: "text" },
    ]);
  });

  it("handles a span at either edge", () => {
    expect(parseInline("**Element Plus** — merged")).toEqual([
      { text: "Element Plus", kind: "strong" },
      { text: " — merged", kind: "text" },
    ]);
    expect(parseInline("cases: **446+**")).toEqual([
      { text: "cases: ", kind: "text" },
      { text: "446+", kind: "strong" },
    ]);
  });

  it("keeps malformed markup as the text it is", () => {
    expect(parseInline("a ** b")).toEqual([{ text: "a ** b", kind: "text" }]);
    expect(parseInline("****")).toEqual([{ text: "****", kind: "text" }]);
    expect(parseInline("un`closed")).toEqual([
      { text: "un`closed", kind: "text" },
    ]);
  });

  it("does not let two strong spans swallow the text between them", () => {
    expect(parseInline("**a** b **c**")).toEqual([
      { text: "a", kind: "strong" },
      { text: " b ", kind: "text" },
      { text: "c", kind: "strong" },
    ]);
  });
});

describe("skills", () => {
  it("splits each line at its first pipe, either width", () => {
    expect(parseSkillLines("React | a, b\nWeb3｜c | d")).toEqual([
      { name: "React", items: "a, b" },
      { name: "Web3", items: "c | d" },
    ]);
  });

  it("reads a line without a pipe as items with no heading", () => {
    expect(parseSkillLines("just items")).toEqual([
      { name: "", items: "just items" },
    ]);
  });

  it("round-trips through the formatter", () => {
    const text = "React | a, b\nother items";
    expect(formatSkillLines(parseSkillLines(text))).toBe(text);
  });
});

describe("projects", () => {
  const text = [
    "# Portal | 2025.01 – 至今",
    "- built it",
    "shipped it",
    "",
    "# Desktop",
    "- **Electron** shell",
  ].join("\n");

  it("groups bullets under the heading above them", () => {
    expect(parseProjects(text)).toEqual({
      error: null,
      projects: [
        {
          title: "Portal",
          period: "2025.01 – 至今",
          bullets: ["built it", "shipped it"],
        },
        { title: "Desktop", period: null, bullets: ["**Electron** shell"] },
      ],
    });
  });

  it("treats a trailing pipe as no period", () => {
    expect(parseProjects("# Title |").projects).toEqual([
      { title: "Title", period: null, bullets: [] },
    ]);
  });

  it("refuses a bullet with no heading to belong to", () => {
    const parsed = parseProjects("- orphan\n# Later");
    expect(parsed.projects).toBeNull();
    expect(parsed.error).toContain("orphan");
  });

  it("refuses a heading with no title", () => {
    expect(parseProjects("#\n- bullet").projects).toBeNull();
    const parsed = parseProjects("# | 2024");
    expect(parsed.projects).toBeNull();
    expect(parsed.error).toContain("# | 2024");
  });

  it("parses nothing as no projects", () => {
    expect(parseProjects("\n  \n")).toEqual({ projects: [], error: null });
  });

  it("round-trips through the formatter", () => {
    const parsed = parseProjects(text);
    expect(parsed.projects).not.toBeNull();
    const formatted = formatProjects(parsed.projects!);
    expect(parseProjects(formatted)).toEqual(parsed);
    expect(formatted).toBe(
      [
        "# Portal | 2025.01 – 至今",
        "- built it",
        "- shipped it",
        "",
        "# Desktop",
        "- **Electron** shell",
      ].join("\n")
    );
  });
});
