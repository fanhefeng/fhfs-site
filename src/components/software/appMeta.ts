import type { App } from "@/lib/server/content";
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
   * Hue in degrees for the app's sleeve and record label. It is a stored
   * column rather than a function of list position, so reordering the shelf
   * does not repaint every app on it.
   */
  hue: number;
  /** Which `software.*` message labels the outbound link. */
  cta: "download" | "play" | "open";
  /** "v0.12.0" — the repo's latest GitHub release, when it has one. */
  version?: string;
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
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** The two ends of a record label's gradient. */
export function appAccent(hue: number, tone: "light" | "dark"): string {
  return tone === "light" ? `oklch(0.58 0.15 ${hue})` : `oklch(0.74 0.15 ${hue})`;
}

/**
 * A sleeve's printed colour, the same in both themes — it is a thing on the
 * shelf, not a surface of the page. Quieter than the label, so the record
 * coming out of it is the brighter of the two.
 */
export function sleeveInk(hue: number): string {
  return `linear-gradient(160deg, oklch(0.62 0.11 ${hue}), oklch(0.46 0.12 ${hue}))`;
}

/** "01", "02", … — the catalogue number printed on a sleeve. */
export const catalogueNumber = (index: number): string => String(index + 1).padStart(2, "0");

export function toSoftwareApp(app: App, index: number, locale: Locale): SoftwareApp {
  const category = app.category;
  return {
    id: app.key,
    name: app.name,
    tagline: app.tagline[locale],
    description: app.description[locale],
    category,
    website: app.website,
    platforms: app.platforms,
    hue: app.hue ?? HUES[index % HUES.length]!,
    cta: category === "game" ? "play" : category === "website" ? "open" : "download",
  };
}
