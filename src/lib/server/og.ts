import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
/**
 * Open Graph image toolkit — the paper palette.
 *
 * Satori (the renderer behind next/og) only implements flexbox, so every
 * container in an OG route must set `display: "flex"` explicitly. It also
 * cannot read our CSS variables, hence the frozen colour copies below: they
 * mirror the light-theme tokens in globals.css and must be updated together.
 */

/** Palette — the light ("open gallery") theme, hard-copied for satori.
 *  Only the tokens the OG routes actually paint with; add more from
 *  globals.css as they become needed. */
export const OG = {
  paper: "#FAF9F6",
  ink: "#1A1A1A",
  inkSecondary: "rgba(26,26,26,0.72)",
  inkTertiary: "rgba(26,26,26,0.60)",
  /** The single accent: amber. */
  accent: "#B45309",
} as const;

export const OG_SIZE = { width: 1200, height: 630 };

/**
 * Canvas: warm paper with one soft amber glow bleeding in from the top-left
 * — the same "lamp" the site's AuroraLayer casts, flattened to a gradient.
 * Kept to a single gradient layer because that is the shape satori is known
 * to handle here.
 */
export const OG_BG = `radial-gradient(ellipse 110% 85% at 6% -12%, rgba(180,83,9,0.16), transparent 62%), ${OG.paper}`;

/**
 * Font stack for every text node in an OG image: Latin from Nunito, CJK from
 * Resource Han Rounded, matching the site's Chinese. Satori resolves per glyph and falls back family by family,
 * then picks the nearest registered weight inside a family.
 */
export const OG_FONT_FAMILY = "Nunito, RoundedSC";

type OgWeight = 400 | 500 | 600 | 700;

export type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: OgWeight;
  style: "normal";
};

/** Server files, read lazily and shared within each worker. Full CJK coverage
 * also handles titles written after deployment. These files are traced into
 * the Node deployment, never imported into JavaScript or a browser bundle. */
const files = {
  latinBody: () => readFile(path.join(process.cwd(), "src/lib/server/og-fonts/Nunito-400.woff")),
  latinDisplay: () => readFile(path.join(process.cwd(), "src/lib/server/og-fonts/Nunito-700.woff")),
  cjkBody: () => readFile(path.join(process.cwd(), "src/lib/server/og-fonts/RoundedSC-400.woff")),
  cjkDisplay: () =>
    readFile(path.join(process.cwd(), "src/lib/server/og-fonts/RoundedSC-600.woff")),
};

const loaded = new Map<keyof typeof files, Promise<ArrayBuffer>>();

function load(key: keyof typeof files): Promise<ArrayBuffer> {
  let pending = loaded.get(key);
  if (!pending) {
    pending = files[key]().then((data) => Uint8Array.from(data).buffer);
    loaded.set(key, pending);
    // A transient filesystem failure may be retried on the next request.
    void pending.catch(() => loaded.delete(key));
  }
  return pending;
}

/** Latin-extended is in Nunito; CJK and fullwidth punctuation need RoundedSC. */
const CJK_RE = /\p{Script=Han}|[⺀-⿿　-〿︰-﹏＀-￯]/u;

export async function loadOgFonts(displayText: string, bodyText: string): Promise<OgFont[]> {
  const jobs: Promise<OgFont>[] = [];
  const push = (key: keyof typeof files, name: string, weight: OgWeight) => {
    jobs.push(load(key).then((data) => ({ name, data, weight, style: "normal" as const })));
  };
  push("latinDisplay", "Nunito", 700);
  push("latinBody", "Nunito", 400);
  if (CJK_RE.test(displayText)) push("cjkDisplay", "RoundedSC", 600);
  if (CJK_RE.test(bodyText)) push("cjkBody", "RoundedSC", 400);
  return Promise.all(jobs);
}
