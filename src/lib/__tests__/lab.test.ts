import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LAB_ENTRIES,
  LAB_GROUPS,
  labNeighbours,
  newestLabEntry,
  sourceUrl,
} from "@/components/lab/entries";

/**
 * The lab's table of contents against what is actually there: a study that
 * links a file that has moved renders fine and 404s on GitHub, and a study
 * without copy renders a MISSING_MESSAGE only once someone opens it.
 */

const src = fileURLToPath(new URL("../../", import.meta.url));
const messages = (locale: string) =>
  JSON.parse(readFileSync(path.join(src, "..", "messages", `${locale}.json`), "utf8")) as {
    lab: {
      items: Record<string, Record<string, string>>;
      groups: Record<string, Record<string, string>>;
    };
  };

describe("LAB_ENTRIES", () => {
  it("number the studies in order, from 01, with no slug or key twice", () => {
    expect(LAB_ENTRIES.map((e) => e.ordinal)).toEqual(
      LAB_ENTRIES.map((_, i) => String(i + 1).padStart(2, "0")),
    );
    expect(new Set(LAB_ENTRIES.map((e) => e.slug)).size).toBe(LAB_ENTRIES.length);
    expect(new Set(LAB_ENTRIES.map((e) => e.key)).size).toBe(LAB_ENTRIES.length);
  });

  // The index prints one shelf after another; a study filed out of place
  // would show up under the wrong heading with an ordinal from elsewhere.
  it("keep each shelf in one run, in the order the index prints them", () => {
    const groups = LAB_ENTRIES.map((e) => e.group);
    const runs = groups.filter((group, i) => group !== groups[i - 1]);
    expect(runs).toEqual([...LAB_GROUPS]);
  });

  // The grove's lab card picks the newest by comparing these as strings, which
  // only orders dates correctly while every one is a real YYYY-MM-DD.
  it("date every study as a real YYYY-MM-DD, and pick the newest by it", () => {
    for (const e of LAB_ENTRIES) {
      expect([e.slug, /^\d{4}-\d{2}-\d{2}$/.test(e.added)]).toEqual([e.slug, true]);
      expect([e.slug, new Date(`${e.added}T00:00:00Z`).toISOString().slice(0, 10)]).toEqual([
        e.slug,
        e.added,
      ]);
    }
    const latest = LAB_ENTRIES.map((e) => e.added)
      .sort()
      .at(-1);
    expect(newestLabEntry().added).toBe(latest);
    expect(newestLabEntry()).toBe(LAB_ENTRIES.findLast((e) => e.added === latest));
  });

  it("hand a study its neighbours in index order, none past either end", () => {
    const first = LAB_ENTRIES[0]!;
    const last = LAB_ENTRIES[LAB_ENTRIES.length - 1]!;
    expect(labNeighbours(first.slug)).toEqual({ prev: undefined, next: LAB_ENTRIES[1] });
    expect(labNeighbours(last.slug)).toEqual({
      prev: LAB_ENTRIES[LAB_ENTRIES.length - 2],
      next: undefined,
    });
    const middle = LAB_ENTRIES[10]!;
    expect(labNeighbours(middle.slug)).toEqual({ prev: LAB_ENTRIES[9], next: LAB_ENTRIES[11] });
  });

  it("have a title and a lede for every shelf in both catalogues", () => {
    for (const locale of ["zh", "en"]) {
      const groups = messages(locale).lab.groups;
      const gaps = LAB_GROUPS.flatMap((group) =>
        ["title", "lede"]
          .filter((field) => !groups[group]?.[field])
          .map((field) => `${locale}: groups.${group}.${field}`),
      );
      expect(gaps).toEqual([]);
    }
  });

  it("name at least one source each, every one a file under src/", () => {
    const missing = LAB_ENTRIES.flatMap((entry) =>
      (entry.sources.length === 0 ? ["(none)"] : entry.sources)
        .filter((file) => file === "(none)" || !existsSync(path.join(src, file)))
        .map((file) => `${entry.slug}: ${file}`),
    );
    expect(missing).toEqual([]);
  });

  it("list each source once, and never with a leading src/ or slash", () => {
    for (const entry of LAB_ENTRIES) {
      expect(new Set(entry.sources).size).toBe(entry.sources.length);
      expect(entry.sources.filter((f) => /^(src\/|\/)/.test(f))).toEqual([]);
    }
  });

  it("link sources to the repository on main", () => {
    expect(sourceUrl("components/lab/entries.ts")).toBe(
      "https://github.com/fanhefeng/fhfs-site/blob/main/src/components/lab/entries.ts",
    );
  });

  it("have a name, tagline, summary and note in both catalogues", () => {
    for (const locale of ["zh", "en"]) {
      const items = messages(locale).lab.items;
      const gaps = LAB_ENTRIES.flatMap((entry) =>
        ["name", "tagline", "summary", "note"]
          .filter((field) => !items[entry.key]?.[field])
          .map((field) => `${locale}: ${entry.key}.${field}`),
      );
      expect(gaps).toEqual([]);
    }
  });
});
