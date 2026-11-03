import "server-only";
import index from "@/content/notebook/index.json";
import { noteDestination, type NoteBody, type NoteSummary } from "@/lib/notebook";

import type { Locale } from "@/i18n/routing";

const notes: NoteSummary[] = index as NoteSummary[];
const bodies: Record<string, () => Promise<{ default: NoteBody }>> = {
  solitude: () => import("@/content/notebook/pages/solitude.json"),
  "community-canteen": () => import("@/content/notebook/pages/community-canteen.json"),
  "a-career-imagined": () => import("@/content/notebook/pages/a-career-imagined.json"),
  "starting-again": () => import("@/content/notebook/pages/starting-again.json"),
  "kitchen-notes": () => import("@/content/notebook/pages/kitchen-notes.json"),
  "things-i-said": () => import("@/content/notebook/pages/things-i-said.json"),
  ideas: () => import("@/content/notebook/pages/ideas.json"),
  "jobs-stanford": () => import("@/content/notebook/pages/jobs-stanford.json"),
  "a-fathers-back": () => import("@/content/notebook/pages/a-fathers-back.json"),
  "frontend-deployment": () => import("@/content/notebook/pages/frontend-deployment.json"),
  "frontend-interview": () => import("@/content/notebook/pages/frontend-interview.json"),
  "typescript-decorators": () => import("@/content/notebook/pages/typescript-decorators.json"),
  "adaptive-bitrate": () => import("@/content/notebook/pages/adaptive-bitrate.json"),
  "ethers-notes": () => import("@/content/notebook/pages/ethers-notes.json"),
  "solidity-notes": () => import("@/content/notebook/pages/solidity-notes.json"),
  "web3-learning": () => import("@/content/notebook/pages/web3-learning.json"),
  "bitcoin-whitepaper": () => import("@/content/notebook/pages/bitcoin-whitepaper.json"),
  "css-reference-shelf": () => import("@/content/notebook/pages/css-reference-shelf.json"),
  "focused-form-memory": () => import("@/content/notebook/pages/focused-form-memory.json"),
  "web-development-ideas": () => import("@/content/notebook/pages/web-development-ideas.json"),
};

export function getNotes(): NoteSummary[] {
  return notes;
}

export function getImportedSummaries(destination: "/blog" | "/secrets", locale: Locale) {
  return notes
    .filter((note) => noteDestination(note) === destination)
    .map((note) => ({
      slug: note.slug,
      locale: note.locale,
      title: note.title,
      date: note.date ?? null,
      summary: note.summary[locale],
      tags: note.tags,
      format: note.format,
      readingMinutes: note.readingMinutes,
      isFallback: note.locale !== locale,
    }));
}

/** Database ownership includes drafts, even though only public rows are returned. */
export function mergeImported<T extends { slug: string }>(
  rows: T[],
  imported: T[],
  owners: readonly { slug: string }[],
): T[] {
  const slugs = new Set(owners.map((row) => row.slug));
  return [...rows, ...imported.filter((row) => !slugs.has(row.slug))];
}

export async function getImportedArticle(
  destination: "/blog" | "/secrets",
  slug: string,
  locale: Locale,
) {
  const summary = getImportedSummaries(destination, locale).find((note) => note.slug === slug);
  if (!summary) return null;
  const note = await getNote(slug);
  if (!note) return null;
  return {
    ...summary,
    html: note.html,
    note: { format: note.format, context: note.context, source: note.source, toc: note.toc },
  };
}

export async function getNote(slug: string) {
  const summary = notes.find((note) => note.slug === slug);
  if (!summary) return null;
  const load = bodies[slug];
  if (!load) throw new Error(`Missing notebook body: ${slug}`);
  return { ...summary, ...(await load()).default };
}
