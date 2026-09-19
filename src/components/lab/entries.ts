import { site } from "@/config/site";

/**
 * The lab's table of contents. Thirty-three studies, each on its own route,
 * on three shelves the index prints under their own headings.
 *
 * Slug and message key are kept separate on purpose: the URL wants kebab-case
 * and next-intl namespaces want a plain identifier, and pinning them to one
 * table is what stops the two from drifting apart the way the craft log's ids
 * once did.
 *
 * The first eight are pieces built *for* the lab. From the ninth on, each
 * study is an effect the site itself uses — the sideways passage on /about,
 * the stickers, the entrances, the statue, the screening room — shown on its
 * own so the mechanism can be read apart from the page it serves; the last
 * seven are the shell, what surrounds every page. One effect per study,
 * strictly, even when two share a plugin or a layer: the pill that slides
 * and the grid that reshuffles are both Flip and are two studies; the Latin
 * decode and the Chinese line mask live in one component and are two
 * studies. Two effects on one page read as a comparison neither of them
 * asked for. Every study names the files it is made of (`sources`), and the
 * page links each one to the repository; `lab.test.ts` checks they exist.
 */
export type LabSlug =
  | "scroll-video"
  | "dissolve"
  | "melting-text"
  | "grove"
  | "liquid-metal"
  | "workstation"
  | "lens-slider"
  | "neon"
  | "sideways"
  | "masthead"
  | "reveal"
  | "headline"
  | "unmask"
  | "magnetic"
  | "glint"
  | "die-cut"
  | "sticker-wall"
  | "peel"
  | "scatter"
  | "dot-name"
  | "approach"
  | "segmented"
  | "reshuffle"
  | "statue"
  | "changelog"
  | "screening"
  | "lights"
  | "reading-chip"
  | "radial-fan"
  | "overture"
  | "door"
  | "veil"
  | "island";

/**
 * The three shelves of the index, in the order they are printed. `piece`:
 * built for the lab, serving no page. `site`: an effect the site runs on,
 * shown apart from the page it serves. `shell`: what every page carries.
 * The entries below are kept contiguous by shelf, in this order, so the
 * ordinals run on within one — `lab.test.ts` checks that. Each shelf has a
 * title and a lede under `lab.groups.<group>`.
 */
export const LAB_GROUPS = ["piece", "site", "shell"] as const;
export type LabGroup = (typeof LAB_GROUPS)[number];

export type LabEntry = {
  slug: LabSlug;
  /** Key under the `lab.items` message namespace. */
  key:
    | "scrollVideo"
    | "dissolve"
    | "meltingText"
    | "grove"
    | "liquidMetal"
    | "workstation"
    | "lensSlider"
    | "neon"
    | "sideways"
    | "masthead"
    | "reveal"
    | "headline"
    | "unmask"
    | "magnetic"
    | "glint"
    | "dieCut"
    | "stickerWall"
    | "peel"
    | "scatter"
    | "dotName"
    | "approach"
    | "segmented"
    | "reshuffle"
    | "statue"
    | "changelog"
    | "screening"
    | "lights"
    | "readingChip"
    | "radialFan"
    | "overture"
    | "door"
    | "veil"
    | "island";
  /** The shelf the index prints this study on. */
  group: LabGroup;
  /** Index number printed beside the name, editorial-style. */
  ordinal: string;
  /** Dot + rule colour, from the muted gallery hues used across the site. */
  accent: string;
  /**
   * The files this study is made of, relative to `src/` — the demo first,
   * then the pieces of the site it shows. Each becomes a link to the file on
   * GitHub at the foot of the study, and the first is linked from its head.
   */
  sources: string[];
};

export const LAB_ENTRIES: LabEntry[] = [
  /* ---- built for the lab ---- */

  {
    slug: "scroll-video",
    key: "scrollVideo",
    group: "piece",
    ordinal: "01",
    accent: "#3e6d93",
    sources: ["components/lab/ScrollVideoDemo.tsx", "lib/scrollVideo.ts"],
  },
  {
    slug: "dissolve",
    key: "dissolve",
    group: "piece",
    ordinal: "02",
    accent: "#4c7a5b",
    sources: ["components/lab/DissolveDemo.tsx", "lib/three/guards.ts", "lib/three/release.ts"],
  },
  {
    slug: "melting-text",
    key: "meltingText",
    group: "piece",
    ordinal: "03",
    accent: "#6b5ba8",
    sources: ["components/lab/MeltingTextDemo.tsx", "components/lab/MeltingText.tsx"],
  },
  {
    slug: "grove",
    key: "grove",
    group: "piece",
    ordinal: "04",
    accent: "#4a5d3a",
    sources: [
      "components/lab/GroveDemo.tsx",
      "components/grove/plates.ts",
      "lib/grove/geometry.ts",
      "lib/grove/shaders.ts",
      "lib/grove/bark.ts",
      "lib/grove/palettes.ts",
    ],
  },
  {
    slug: "liquid-metal",
    key: "liquidMetal",
    group: "piece",
    ordinal: "05",
    accent: "#8a93a8",
    sources: [
      "components/lab/LiquidMetalDemo.tsx",
      "components/grove/LiquidPill.tsx",
      "lib/grove/liquidMetal.ts",
    ],
  },
  // The 3D desk from the old portfolio — it lived on /about until the page
  // slimmed down; a draggable, inertial three.js piece is a study by nature.
  {
    slug: "workstation",
    key: "workstation",
    group: "piece",
    ordinal: "06",
    accent: "#b45309",
    sources: ["components/about/Workstation.tsx", "lib/three/draco.ts"],
  },
  // Four photographs and a lens: the next picture arrives inside a growing
  // circle of glass, magnified at the rim, then settles flat.
  {
    slug: "lens-slider",
    key: "lensSlider",
    group: "piece",
    ordinal: "07",
    accent: "#5b7f8a",
    sources: [
      "components/lab/LensSliderDemo.tsx",
      "components/lab/lensRenderer.ts",
      "lib/lensSlider.ts",
    ],
  },
  // The neon over the door of Seb's, re-lettered: brick painted once by a
  // canvas, a brush face traced by its outline in four layers of stroke, and
  // a fixed score of flickers to light it. The music sits under the sign.
  {
    slug: "neon",
    key: "neon",
    group: "piece",
    ordinal: "08",
    accent: "#3f5fd6",
    sources: [
      "components/lab/NeonSignDemo.tsx",
      "components/neon/NeonSignArt.tsx",
      "components/neon/geometry.ts",
      "components/neon/wall.ts",
      "components/home/NeonSplash.tsx",
    ],
  },

  /* ---- from here on: the site's own effects, one per study ---- */

  // The manifesto's passage on /about: a pinned screen, the line riding
  // sideways as the reader scrolls down, each character tumbling into place.
  {
    slug: "sideways",
    key: "sideways",
    group: "site",
    ordinal: "09",
    accent: "#a0522d",
    sources: [
      "components/lab/SidewaysDemo.tsx",
      "components/fx/SidewaysBand.tsx",
      "components/home/ManifestoBand.tsx",
    ],
  },
  // The masthead's line mask: each line rises from behind its own clip.
  {
    slug: "masthead",
    key: "masthead",
    group: "site",
    ordinal: "10",
    accent: "#5c6b73",
    sources: ["components/lab/MastheadDemo.tsx", "components/home/Opening.tsx"],
  },
  // The y:24 reveal every list on the site uses, rows staggered.
  {
    slug: "reveal",
    key: "reveal",
    group: "site",
    ordinal: "11",
    accent: "#6b7a68",
    sources: ["components/lab/RevealDemo.tsx", "components/fx/Reveal.tsx"],
  },
  // A Latin article headline entering: one lowercase ScrambleText pass.
  {
    slug: "headline",
    key: "headline",
    group: "site",
    ordinal: "12",
    accent: "#7a6a5c",
    sources: ["components/lab/HeadlineDemo.tsx", "components/blog/PostTitle.tsx"],
  },
  // A Chinese article headline entering: SplitText's line mask, re-cut when
  // the font lands. The same component's other branch.
  {
    slug: "unmask",
    key: "unmask",
    group: "site",
    ordinal: "13",
    accent: "#6e6458",
    sources: ["components/lab/UnmaskDemo.tsx", "components/blog/PostTitle.tsx"],
  },
  // A button that leans toward the cursor while it is within reach, and
  // springs home when it is not.
  {
    slug: "magnetic",
    key: "magnetic",
    group: "site",
    ordinal: "14",
    accent: "#8b6f3e",
    sources: [
      "components/lab/MagneticDemo.tsx",
      "components/fx/Magnetic.tsx",
      "components/home/AboutTeaser.tsx",
      "components/notfound/NotFoundStage.tsx",
    ],
  },
  // A rim of glass that catches a light the cursor carries — the island's
  // edge, on a card wide enough for the light to follow in both axes.
  {
    slug: "glint",
    key: "glint",
    group: "site",
    ordinal: "15",
    accent: "#9a8a6a",
    sources: [
      "components/lab/GlintDemo.tsx",
      "components/fx/SpecularGlint.tsx",
      "components/layout/Header.tsx",
    ],
  },
  // The die-cut edge: alpha grown outward and filled white, three radii.
  {
    slug: "die-cut",
    key: "dieCut",
    group: "site",
    ordinal: "16",
    accent: "#c2410c",
    sources: ["components/lab/DieCutDemo.tsx", "components/ui/Sticker.tsx"],
  },
  // The wall on /about: stickers that arrive from an arc and can be thrown.
  {
    slug: "sticker-wall",
    key: "stickerWall",
    group: "site",
    ordinal: "17",
    accent: "#b4532a",
    sources: ["components/lab/StickerWallDemo.tsx", "components/about/StickerWall.tsx"],
  },
  // The footer's note that peels off — one boolean, all CSS.
  {
    slug: "peel",
    key: "peel",
    group: "site",
    ordinal: "18",
    accent: "#a05a3c",
    sources: [
      "components/lab/PeelDemo.tsx",
      "components/ui/PeelSticker.tsx",
      "components/layout/Footer.tsx",
    ],
  },
  // The 404's line of dots that scatters under the pointer and springs back.
  {
    slug: "scatter",
    key: "scatter",
    group: "site",
    ordinal: "19",
    accent: "#475569",
    sources: [
      "components/lab/ScatterDemo.tsx",
      "components/notfound/ParticleLine.tsx",
      "lib/canvasColor.ts",
    ],
  },
  // The name on /about that hides in noise until pointed at.
  {
    slug: "dot-name",
    key: "dotName",
    group: "site",
    ordinal: "20",
    accent: "#5a6478",
    sources: [
      "components/lab/DotNameDemo.tsx",
      "components/fx/DotDoodle.tsx",
      "lib/dotGlyphs.ts",
      "lib/canvasColor.ts",
    ],
  },
  // The cover's second and third acts, as they stand on the home page: the
  // window the scroll opens onto the grove, the two paper cards standing in
  // it — one under the canvas, one over — and the paper washing back over it.
  {
    slug: "approach",
    key: "approach",
    group: "site",
    ordinal: "21",
    accent: "#3f5a3a",
    sources: [
      "components/grove/GroveApproach.tsx",
      "components/grove/GroveCard.tsx",
      "components/grove/PaperDissolve.tsx",
      "components/grove/approach.css.ts",
      "components/grove/GroveScene.tsx",
    ],
  },
  // The segmented control's pill: one element Flipping from slot to slot.
  {
    slug: "segmented",
    key: "segmented",
    group: "site",
    ordinal: "22",
    accent: "#2f6f8f",
    sources: ["components/lab/SegmentedDemo.tsx", "components/software/SegmentedFilter.tsx"],
  },
  // The grid whose survivors slide to their new places — Flip, captured
  // before React re-renders and replayed in the layout phase.
  {
    slug: "reshuffle",
    key: "reshuffle",
    group: "site",
    ordinal: "23",
    accent: "#3a7a8a",
    sources: [
      "components/lab/ReshuffleDemo.tsx",
      "lib/flipGrid.ts",
      "components/software/SoftwareGallery.tsx",
    ],
  },
  // The bronze on /idols/kobe, built from capsules and one material — with a
  // wireframe view to count them and a meter for the frames it does not draw.
  {
    slug: "statue",
    key: "statue",
    group: "site",
    ordinal: "24",
    accent: "#8a6a2e",
    sources: [
      "components/lab/StatueDemo.tsx",
      "components/idols/KobeStatueStage.tsx",
      "components/idols/KobeStatue.tsx",
    ],
  },
  // /about's version history: the year rail that rolls as entries pass.
  {
    slug: "changelog",
    key: "changelog",
    group: "site",
    ordinal: "25",
    accent: "#4b6b8a",
    sources: ["components/about/Changelog.tsx"],
  },
  // A film's wall and its screening room, the way /films hangs them.
  {
    slug: "screening",
    key: "screening",
    group: "site",
    ordinal: "26",
    accent: "#b8552e",
    sources: [
      "components/films/FilmStills.tsx",
      "lib/scrollLock.ts",
      "components/films/entries.ts",
    ],
  },

  /* ---- the shell, one piece per study: what surrounds every page ---- */

  // The light switch: the theme flip as a 1.2s view transition, with a click.
  {
    slug: "lights",
    key: "lights",
    group: "shell",
    ordinal: "27",
    accent: "#6d5d4b",
    sources: [
      "components/lab/LightsDemo.tsx",
      "components/ui/LightSwitch.tsx",
      "lib/theme.ts",
      "app/globals.css",
    ],
  },
  // The reading chip, bottom-left on an article, measuring this page instead.
  {
    slug: "reading-chip",
    key: "readingChip",
    group: "shell",
    ordinal: "28",
    accent: "#7d6b55",
    sources: ["components/lab/ReadingChipDemo.tsx", "components/fx/ProgressHud.tsx"],
  },
  // The phone's radial fan: four buttons along a 90° arc, elastic out, reversed in.
  {
    slug: "radial-fan",
    key: "radialFan",
    group: "shell",
    ordinal: "29",
    accent: "#8a6d4e",
    sources: ["components/lab/RadialFanDemo.tsx", "components/fx/RadialFab.tsx"],
  },
  // The lamp that opens a session, replayed by handing back its key.
  {
    slug: "overture",
    key: "overture",
    group: "shell",
    ordinal: "30",
    accent: "#5e5246",
    sources: [
      "components/lab/OvertureDemo.tsx",
      "components/fx/OvertureLight.tsx",
      "lib/overture.ts",
    ],
  },
  // The way in through the sign on a hard landing at the cover.
  {
    slug: "door",
    key: "door",
    group: "shell",
    ordinal: "31",
    accent: "#4b5a7a",
    sources: ["components/lab/DoorDemo.tsx", "components/home/NeonSplash.tsx", "lib/splash.ts"],
  },
  // The veil between routes, played in place by a replay event.
  {
    slug: "veil",
    key: "veil",
    group: "shell",
    ordinal: "32",
    accent: "#6f7a86",
    sources: ["components/lab/VeilDemo.tsx", "components/fx/RouteTransition.tsx", "lib/veil.ts"],
  },
  // The island overhead, folding on 48px of scroll — no mounting needed.
  {
    slug: "island",
    key: "island",
    group: "shell",
    ordinal: "33",
    accent: "#585f6b",
    sources: ["components/lab/IslandDemo.tsx", "components/layout/Header.tsx"],
  },
];

export const labEntry = (slug: string): LabEntry | undefined =>
  LAB_ENTRIES.find((entry) => entry.slug === slug);

/** The studies either side of one, in the index's order — none past an end. */
export function labNeighbours(slug: LabSlug): { prev?: LabEntry; next?: LabEntry } {
  const at = LAB_ENTRIES.findIndex((entry) => entry.slug === slug);
  return { prev: LAB_ENTRIES[at - 1], next: LAB_ENTRIES[at + 1] };
}

/** Where a source file of the site can be read: the repository, on `main`. */
export const sourceUrl = (path: string): string => `${site.repo}/blob/main/src/${path}`;
