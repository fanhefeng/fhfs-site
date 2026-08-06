/**
 * Open Graph image toolkit — "The Quiet Issue" paper palette.
 *
 * Satori (the renderer behind next/og) only implements flexbox, so every
 * container in an OG route must set `display: "flex"` explicitly. It also
 * cannot read our CSS variables, hence the frozen colour copies below: they
 * mirror the light-theme tokens in globals.css and must be updated together.
 */

/** Palette — the light ("open gallery") theme, hard-copied for satori. */
export const OG = {
  paper: "#FAF9F6",
  surface: "#F2F0EA",
  ink: "#1A1A1A",
  inkSecondary: "rgba(26,26,26,0.62)",
  inkTertiary: "rgba(26,26,26,0.40)",
  /** The single accent: amber. */
  accent: "#B45309",
  line: "rgba(26,26,26,0.10)",
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
 * Font stack for every text node in an OG image: Latin from Inter, CJK from
 * Noto Sans SC. Satori resolves per glyph and falls back family by family,
 * then picks the nearest registered weight inside a family.
 */
export const OG_FONT_FAMILY = "Inter, NotoSansSC";

type OgWeight = 400 | 500 | 600 | 700;

export type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: OgWeight;
  style: "normal";
};

/**
 * A build generates ~30 cards across 13 worker processes, so Google's font
 * endpoints see a burst of parallel requests and occasionally drop one
 * (ECONNRESET before the TLS handshake completes). Every fetch here is
 * therefore retried with exponential backoff plus jitter — one dropped
 * socket must not fail the whole build.
 */
const FETCH_ATTEMPTS = 5;

async function fetchWithRetry(url: string, label: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const backoff = 250 * 2 ** (attempt - 1) + Math.random() * 250;
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`${label}: HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`${label} failed after ${FETCH_ATTEMPTS} attempts`, {
    cause: lastError,
  });
}

/**
 * Fetches a text-subset font (TTF) from the Google Fonts CSS API for use in
 * ImageResponse (satori). The default fetch user agent receives truetype URLs.
 * Runs at build time only — every OG route is `force-static`.
 */
async function loadGoogleFont(
  family: string,
  text: string,
  weight = 400
): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    family
  )}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetchWithRetry(url, `font css ${family}`)).text();
  const resource = css.match(
    /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/
  );
  if (!resource) throw new Error(`No TTF url for font ${family}`);
  const response = await fetchWithRetry(resource[1], `font file ${family}`);
  return response.arrayBuffer();
}

/** CJK + fullwidth punctuation — everything Inter cannot draw. */
const CJK_RE =
  /[⺀-⿿　-〿㐀-䶿一-鿿豈-﫿︰-﹏＀-￯]/;

/** Deduplicated character set — keeps the `&text=` subset URL short. */
function subset(text: string, wantCjk: boolean) {
  const seen = new Set<string>();
  for (const ch of text) {
    if (CJK_RE.test(ch) === wantCjk) seen.add(ch);
  }
  return [...seen].join("");
}

/**
 * Loads exactly the glyphs an image needs, in the two weights the layout
 * uses: `display` text (wordmark / headline) at 700, `body` text (tagline,
 * meta line) at 400. The CJK companion is only fetched when the text
 * actually contains CJK, so English pages pay for two requests, not four.
 */
export async function loadOgFonts(
  displayText: string,
  bodyText: string
): Promise<OgFont[]> {
  const jobs: Promise<OgFont>[] = [];

  const push = (
    family: string,
    name: string,
    text: string,
    weight: OgWeight
  ) => {
    jobs.push(
      loadGoogleFont(family, text, weight).then((data) => ({
        name,
        data,
        weight,
        style: "normal" as const,
      }))
    );
  };

  // Latin is always needed — the wordmark alone guarantees it.
  push("Inter", "Inter", subset(displayText, false) || "fhf", 700);
  push("Inter", "Inter", subset(bodyText, false) || "fhf", 400);

  const displayCjk = subset(displayText, true);
  const bodyCjk = subset(bodyText, true);
  // 600 rather than 700: CJK bold is already dense, and satori snaps a 700
  // request to the nearest registered weight.
  if (displayCjk) push("Noto Sans SC", "NotoSansSC", displayCjk, 600);
  if (bodyCjk) push("Noto Sans SC", "NotoSansSC", bodyCjk, 400);

  return Promise.all(jobs);
}
