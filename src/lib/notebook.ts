import type { Locale } from "@/i18n/routing";

export const NOTE_SECTIONS = ["writing", "life", "it"] as const;
export type NoteSection = (typeof NOTE_SECTIONS)[number];
export type NoteFormat = "essay" | "fragment" | "study" | "reference" | "observation";
export type NoteText = Record<Locale, string>;

export type NoteSummary = {
  slug: string;
  title: string;
  section: NoteSection;
  format: NoteFormat;
  locale: Locale;
  summary: NoteText;
  tags: string[];
  date?: string;
  context?: NoteText;
  source?: { author: string; title: string; url?: string };
  readingMinutes: number;
};

export type NoteBody = {
  html: string;
  toc: { id: string; title: string }[];
};

/** Search and filters share one predicate, including an empty query. */
export function filterNotes(notes: NoteSummary[], section: string | null, query: string) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return notes.filter((note) => {
    if (section && note.section !== section) return false;
    const text = [note.title, note.summary.zh, note.summary.en, ...note.tags]
      .join(" ")
      .toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
}
