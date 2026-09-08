/**
 * The wall of idols — who hangs on it, and where. One so far. The copy for
 * each lives under `idols.<key>` in the message catalogues; what is here is
 * the part that is not copy: the route, the accent, the picture on the
 * index card.
 */
export type IdolSlug = "kobe";

export type IdolEntry = {
  slug: IdolSlug;
  /** Key under the `idols` message namespace. */
  key: "kobe";
  /**
   * The card's picture on /idols, from `public/idols/<slug>/`. `altKey` is the
   * full key under the `idols` namespace for its description — it travels with
   * the picture rather than being spelled out at the call site, or a second
   * idol would inherit the first one's photo id.
   */
  cover: { src: string; width: number; height: number; altKey: string };
  /** Dot + rule colour — the Lakers' purple, muted to the site's palette. */
  accent: string;
};

export const IDOLS: IdolEntry[] = [
  {
    slug: "kobe",
    key: "kobe",
    cover: {
      src: "/idols/kobe/kobe-bryant-8.jpg",
      width: 1071,
      height: 1600,
      altKey: "kobe.photos.hawaii8.alt",
    },
    accent: "#5b3f8a",
  },
];
