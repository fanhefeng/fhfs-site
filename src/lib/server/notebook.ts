import "server-only";
import index from "@/content/notebook/index.json";
import type { NoteBody, NoteSummary } from "@/lib/notebook";

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

export async function getNote(slug: string) {
  const summary = notes.find((note) => note.slug === slug);
  if (!summary) return null;
  const load = bodies[slug];
  if (!load) throw new Error(`Missing notebook body: ${slug}`);
  return { ...summary, ...(await load()).default };
}
