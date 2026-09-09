/**
 * The grove in four dresses.
 *
 * One geometry, four sets of colours. Nothing here changes what is modelled —
 * the same two roots, the same quarter-million blades, the same butterfly —
 * only what they are made of and what the air between them is doing.
 *
 * Every triple is LINEAR space, because that is what the shaders work in and
 * what the original green was solved in: the moss channel ratios come from a
 * photographic reference (hue 77°, sat 56%, value 23%), not from a colour
 * picker. Squaring an sRGB swatch to get here loses that, so each dress was
 * built by moving the reference's hue and keeping its ratios, which is why the
 * numbers look nothing like the hex you would name them by.
 *
 * `living-green` is the original and is reproduced here to the digit. The home
 * page's hero draws with these same shaders, so the uniforms have to be fed
 * from somewhere on both pages — feeding it this entry is what keeps the cover
 * pixel-identical to what it was before the other three existed.
 */

export type RGB = readonly [number, number, number];

/** Colour and thickness of the air, per depth band. */
export type GroveAir = {
  hazeCol: RGB;
  haze: number;
  fog: number;
  hazeLift: number;
};

export type GrovePalette = {
  key: GrovePaletteKey;
  /** Message key under `lab.items.grove`, holding this dress's name. */
  label: string;
  /** The swatch the picker paints its dot with — sRGB, for CSS. */
  swatch: string;

  /* ---- light ---- */
  keyCol: RGB;
  fillCol: RGB;
  ambCol: RGB;

  /* ---- air: the root you stand at, and the ridge behind it ---- */
  near: GroveAir;
  far: GroveAir;

  /* ---- what grows ---- */
  /** The cushion on the bark, in shadow and in the light. */
  mossDeep: RGB;
  mossLit: RGB;
  /** The pale crust where bare wood faces up. */
  lichen: RGB;
  /** A blade, root to tip; `grassTipHi` is the sunlit crown added after shading. */
  grassDeep: RGB;
  grassMid: RGB;
  grassTip: RGB;
  grassTipHi: RGB;
  /** Frond, untinted and tinted. */
  fernDeep: RGB;
  fernLit: RGB;
  /** The glow riding the survey front, and the brighter ring on the front itself. */
  scanGlow: RGB;
  scanRim: RGB;

  /* ---- the painted plates (canvas, so sRGB strings) ---- */
  /** Petal fill; the alpha is supplied per floret by the plate. */
  petal: string;
  /** The floret's eye. */
  heart: string;
  /** Pollen: the grain's core, and the colour it fades out through. */
  moteCore: string;
  moteEdge: string;
  /** The pool of light on the floor: its centre, and the tone it falls off to. */
  poolInner: string;
  poolOuter: string;
  /**
   * The stage behind the canvas — the sky, in other words, since nothing is
   * modelled up there. It has to move with the dress or the render sits on a
   * backdrop from a different season; it is also what the fallback still is
   * seen against, which is why it is a solid rather than a gradient.
   */
  backdrop: string;
};

export const GROVE_PALETTES = {
  /**
   * The original. Wet spring understory: cold silver light, moss at its most
   * saturated, white florets, and just enough haze to keep the ridge back.
   */
  "living-green": {
    key: "living-green",
    label: "dressLivingGreen",
    swatch: "#4a5d3a",

    keyCol: [1.14, 1.06, 0.88],
    fillCol: [0.78, 0.78, 0.62],
    ambCol: [0.086, 0.09, 0.08],

    near: { hazeCol: [0.176, 0.195, 0.145], haze: 0.15, fog: 0, hazeLift: 0.2 },
    far: { hazeCol: [0.088, 0.098, 0.072], haze: 0.16, fog: 0.26, hazeLift: 0.9 },

    mossDeep: [0.0204, 0.0311, 0.005],
    mossLit: [0.0914, 0.1392, 0.0227],
    lichen: [0.162, 0.176, 0.132],
    grassDeep: [0.0126, 0.0192, 0.0031],
    grassMid: [0.0488, 0.0744, 0.0121],
    grassTip: [0.1222, 0.186, 0.0304],
    grassTipHi: [0.26, 0.39, 0.064],
    fernDeep: [0.027, 0.045, 0.0099],
    fernLit: [0.069, 0.115, 0.0253],
    scanGlow: [0.3, 0.72, 0.46],
    scanRim: [0.86, 1.0, 0.9],

    petal: "255,255,251",
    heart: "#f0e7bd",
    moteCore: "255,255,255",
    moteEdge: "236,244,224",
    poolInner: "226,236,212",
    poolOuter: "214,226,200",
    backdrop: "#4a4d44",
  },

  /**
   * Late light through blossom. The key turns pink and the ambient goes violet,
   * so the moss warms without being repainted — most of this dress is in the
   * air, which is how dusk actually works. The florets are the one part that
   * really changes colour.
   */
  sakura: {
    key: "sakura",
    label: "dressSakura",
    swatch: "#b3707f",

    keyCol: [1.26, 0.94, 0.92],
    fillCol: [0.88, 0.68, 0.68],
    ambCol: [0.110, 0.084, 0.104],

    near: { hazeCol: [0.260, 0.180, 0.205], haze: 0.34, fog: 0.06, hazeLift: 0.3 },
    far: { hazeCol: [0.140, 0.098, 0.115], haze: 0.3, fog: 0.34, hazeLift: 0.92 },

    mossDeep: [0.0250, 0.0300, 0.0090],
    mossLit: [0.1080, 0.1320, 0.0400],
    lichen: [0.186, 0.164, 0.148],
    grassDeep: [0.0158, 0.0186, 0.0056],
    grassMid: [0.0580, 0.0700, 0.0196],
    grassTip: [0.1440, 0.1740, 0.0500],
    grassTipHi: [0.3100, 0.3500, 0.1100],
    fernDeep: [0.0318, 0.0432, 0.0150],
    fernLit: [0.0812, 0.1088, 0.0384],
    scanGlow: [0.74, 0.4, 0.53],
    scanRim: [1.0, 0.9, 0.94],

    petal: "255,214,226",
    heart: "#e2919f",
    moteCore: "255,246,248",
    moteEdge: "248,220,228",
    poolInner: "240,214,220",
    poolOuter: "228,202,210",
    backdrop: "#4f4249",
  },

  /**
   * The turn. Chlorophyll withdraws before the leaf falls, so the greens go
   * yellow-ochre from the tip down rather than uniformly brown — the blade's
   * crown moves furthest, its root least, which is the one thing that keeps
   * this from reading as a sepia filter over the spring dress.
   */
  maple: {
    key: "maple",
    label: "dressMaple",
    swatch: "#9c5a28",

    keyCol: [1.18, 1.0, 0.78],
    fillCol: [0.86, 0.73, 0.52],
    ambCol: [0.092, 0.084, 0.07],

    near: { hazeCol: [0.196, 0.172, 0.128], haze: 0.16, fog: 0, hazeLift: 0.22 },
    far: { hazeCol: [0.1, 0.087, 0.062], haze: 0.17, fog: 0.27, hazeLift: 0.9 },

    mossDeep: [0.0262, 0.0284, 0.0060],
    mossLit: [0.1180, 0.1186, 0.0248],
    lichen: [0.186, 0.170, 0.118],
    grassDeep: [0.0168, 0.0166, 0.0036],
    grassMid: [0.0624, 0.0602, 0.0126],
    grassTip: [0.1560, 0.1420, 0.0318],
    grassTipHi: [0.3300, 0.2800, 0.0660],
    fernDeep: [0.0342, 0.0358, 0.0102],
    fernLit: [0.0880, 0.0872, 0.0262],
    scanGlow: [0.88, 0.47, 0.2],
    scanRim: [1.0, 0.92, 0.78],

    petal: "255,158,102",
    heart: "#c9541f",
    moteCore: "255,240,220",
    moteEdge: "244,214,172",
    poolInner: "236,216,178",
    poolOuter: "224,204,166",
    backdrop: "#4d4738",
  },

  /**
   * Coast fog in old-growth. The light loses its warmth, the darks lift, and
   * the ridge nearly goes: this is the one dress where the air is doing more
   * than the surfaces, so `fog` and `haze` carry it and the moss only cools.
   */
  sequoia: {
    key: "sequoia",
    label: "dressSequoia",
    swatch: "#5c7470",

    keyCol: [0.98, 1.02, 1.06],
    fillCol: [0.66, 0.72, 0.74],
    ambCol: [0.078, 0.086, 0.094],

    near: { hazeCol: [0.158, 0.178, 0.168], haze: 0.32, fog: 0.1, hazeLift: 0.34 },
    far: { hazeCol: [0.086, 0.097, 0.093], haze: 0.3, fog: 0.44, hazeLift: 0.95 },

    mossDeep: [0.0160, 0.0272, 0.0080],
    mossLit: [0.0716, 0.1216, 0.0304],
    lichen: [0.150, 0.170, 0.146],
    grassDeep: [0.0100, 0.0168, 0.0044],
    grassMid: [0.0384, 0.0650, 0.0148],
    grassTip: [0.0960, 0.1626, 0.0372],
    grassTipHi: [0.2044, 0.3408, 0.0784],
    fernDeep: [0.0212, 0.0394, 0.0120],
    fernLit: [0.0542, 0.1004, 0.0308],
    scanGlow: [0.3, 0.68, 0.74],
    scanRim: [0.86, 0.98, 1.0],

    petal: "240,248,252",
    heart: "#cbdde4",
    moteCore: "246,252,255",
    moteEdge: "216,232,238",
    poolInner: "206,224,224",
    poolOuter: "196,212,212",
    backdrop: "#444a48",
  },
} as const satisfies Record<string, GrovePalette>;

export type GrovePaletteKey = "living-green" | "sakura" | "maple" | "sequoia";

/** Picker order — the year's, starting where the study always started. */
export const GROVE_PALETTE_KEYS = [
  "living-green",
  "sakura",
  "maple",
  "sequoia",
] as const satisfies readonly GrovePaletteKey[];

/** The dress the hero wears, and the study opens on. */
export const DEFAULT_PALETTE: GrovePaletteKey = "living-green";

/**
 * Which uniform each colour in a dress is fed to.
 *
 * Written out rather than derived from the field name so that renaming either
 * side is a type error instead of a colour that silently stops changing — and
 * so the list of what a dress actually reaches is readable in one place.
 */
export const DRESS_COLOURS = {
  uKeyCol: "keyCol",
  uFillCol: "fillCol",
  uAmbCol: "ambCol",
  uMossDeep: "mossDeep",
  uMossLit: "mossLit",
  uLichen: "lichen",
  uGrassDeep: "grassDeep",
  uGrassMid: "grassMid",
  uGrassTip: "grassTip",
  uGrassTipHi: "grassTipHi",
  uFernDeep: "fernDeep",
  uFernLit: "fernLit",
  uScanGlow: "scanGlow",
  uScanRim: "scanRim",
} as const satisfies Record<string, keyof GrovePalette>;

export type DressColourUniform = keyof typeof DRESS_COLOURS;

export const grovePalette = (key: GrovePaletteKey): GrovePalette => GROVE_PALETTES[key];
