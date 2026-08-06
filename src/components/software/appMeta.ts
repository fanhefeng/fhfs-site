import type { App } from "@/lib/content";
import type { Locale } from "@/i18n/routing";

/** The four buckets the segmented filter offers, in display order — the same
 *  union `App["category"]` carries out of the database enum. */
export const APP_CATEGORIES = [
  "desktop",
  "tool",
  "game",
  "website",
] as const satisfies readonly App["category"][];

type AppCategory = App["category"];
export type AppFilter = "all" | AppCategory;

/**
 * A single app, flattened for the client islands: the database rows from
 * `getApps()` carry `{zh,en}` objects, so the page resolves everything
 * (locale, CTA wording key, hue) at render time and ships a plain,
 * serializable payload.
 */
export type SoftwareApp = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: AppCategory;
  website: string;
  platforms: string[];
  /**
   * Accent hue in degrees for the schematic UI mock. There are no real
   * screenshots in the repo, so each app gets one hue and the mock is drawn
   * from it. It is a stored column rather than a function of list position,
   * so reordering the shelf no longer repaints every app on it.
   */
  hue: number;
  /** Which `software.*` message labels the outbound link. */
  cta: "download" | "play" | "open";
};

/**
 * Fallback hues for an app saved without one — picked to sit apart on the
 * wheel yet stay muted enough to live on warm paper: amber-adjacent, teal,
 * violet, green, rose, blue.
 */
const HUES = [42, 195, 285, 150, 15, 245];

/** Two initials at most — the monogram inside the sticker icon. */
export function appMonogram(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Accent color for one of the mock's two tones. */
export function mockAccent(hue: number, tone: "light" | "dark"): string {
  return tone === "light"
    ? `oklch(0.58 0.15 ${hue})`
    : `oklch(0.74 0.15 ${hue})`;
}

export function toSoftwareApp(
  app: App,
  index: number,
  locale: Locale
): SoftwareApp {
  const category = app.category;
  return {
    id: app.key,
    name: app.name,
    tagline: app.tagline[locale],
    description: app.description[locale],
    category,
    website: app.website,
    platforms: app.platforms,
    hue: app.hue ?? HUES[index % HUES.length],
    cta: category === "game" ? "play" : category === "website" ? "open" : "download",
  };
}
