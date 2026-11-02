import { describe, expect, it, vi } from "vite-plus/test";
import index from "@/content/notebook/index.json";
import { filterNotes, type NoteBody, type NoteSummary } from "@/lib/notebook";
import { getNote, getNotes } from "@/lib/server/notebook";

vi.mock("server-only", () => ({}));

const notes = index as NoteSummary[];
const pages = import.meta.glob<NoteBody>("../../content/notebook/pages/*.json", {
  eager: true,
  import: "default",
});

describe("published notebook", () => {
  it("resolves every published page through the server loader and rejects unknown slugs", async () => {
    expect(getNotes()).toEqual(notes);
    for (const note of notes) {
      expect(await getNote(note.slug)).toEqual({
        ...note,
        ...pages[`../../content/notebook/pages/${note.slug}.json`],
      });
    }
    expect(await getNote("not-a-note")).toBeNull();
  });

  it("has one readable body per public entry, with matching heading anchors", () => {
    expect(new Set(notes.map((note) => note.slug)).size).toBe(notes.length);
    expect(Object.keys(pages)).toHaveLength(notes.length);
    for (const note of notes) {
      const body = pages[`../../content/notebook/pages/${note.slug}.json`]!;
      expect(body.html.length).toBeGreaterThan(20);
      expect(body.html).not.toMatch(/<script\b|!\[\[|\]\(attachment\//i);
      for (const heading of body.toc) expect(body.html).toContain(`id="${heading.id}"`);
      expect(note.summary.zh).toBeTruthy();
      expect(note.summary.en).toBeTruthy();
    }
  });

  it("keeps editing drafts and trading recommendations out of the selections", () => {
    const canteen = pages["../../content/notebook/pages/community-canteen.json"]!;
    expect(canteen.html).not.toContain("应该加一个标题");
    expect(canteen.html).not.toContain("此处可以继续写");
    const web3 = pages["../../content/notebook/pages/web3-learning.json"]!;
    expect(web3.html).not.toContain("合规性与牌照");
    expect(web3.html).toContain("Interface");
    const fragments = pages["../../content/notebook/pages/things-i-said.json"]!;
    expect(fragments.html.match(/<hr>/g)).toHaveLength(4);
    expect(fragments.html).toContain("河津公车随感");
  });

  it("combines category and multilingual keywords, and accepts whitespace", () => {
    expect(filterNotes(notes, "it", "  ETHERS.JS Ethereum ").map((note) => note.slug)).toEqual([
      "ethers-notes",
    ]);
    expect(filterNotes(notes, "writing", "ethers")).toEqual([]);
    expect(filterNotes(notes, null, "做饭").map((note) => note.slug)).toEqual(["kitchen-notes"]);
    expect(filterNotes(notes, null, "   ")).toHaveLength(notes.length);
  });
});
