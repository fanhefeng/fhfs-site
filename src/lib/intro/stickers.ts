/**
 * The 3D intro: everything about the avatar that is *not* words.
 *
 * Each sticker is three things at once — a decal on the face, a docking point
 * on the camera's orbit, and the anchor for one resume card. Positions are
 * written as a direction angle, never as coordinates: at runtime a ray is
 * cast from that direction towards the model's centre, and wherever it lands
 * is where the decal goes (see `src/lib/intro/surface.ts`). That is what lets
 * the model be swapped without re-tuning a single number here.
 *
 * The copy for each sticker lives in the `intro_nodes` table, joined by
 * `key` in the /intro page — this file stays language-neutral so the Canvas
 * never has to re-render when the locale changes.
 */

export type StickerShape = "badge" | "circle" | "banner";

export type IntroSticker = {
  id: string;
  /** The word on the sticker itself. Latin on purpose — it reads as a decal
   *  in both locales, and CJK at decal resolution turns to mud. */
  label: string;
  /** Emoji, drawn into the canvas texture. */
  icon: string;
  shape: StickerShape;
  colors: { bg: string; ink: string };
  /** Direction angle in degrees. theta: 0 = dead ahead, positive = right.
   *  phi: 0 = eye level, positive = up. */
  dir: { theta: number; phi: number };
  /** Decal height as a fraction of the model's total height. */
  size: number;
  /** Spin of the decal itself, degrees. */
  rotation: number;
  /** How far the camera parks, in model heights. Smaller = closer. */
  distance: number;
};

export const MODEL_URL = "/models/head.glb";

/**
 * Where the centre of the face sits, measured downwards from the top of the
 * model as a fraction of its total height. This one is a TRELLIS bust
 * (stylised v3): eyes at 40%, nose tip 48%, chin 63% — the geometric centre
 * of the face lands at 44%. A head-only model would be 0.5.
 *
 * Get it wrong and every sticker slides below the chin. Calibrate with
 * `tools/head-preview.html` (orthographic front view with a ruler), never by
 * guessing — see docs/INTRO3D.md §3 for how to serve it, and note that it
 * lives outside `public/` on purpose.
 *
 * Read this number as the *intent*, not as what the renderer currently does:
 * `normalizeModel` bakes a world-space matrix into local geometry and this
 * model's mesh node carries a scale, so the pose actually rendered sits at an
 * effective 0.470. `src/lib/intro/surface.ts` documents why the two cannot be
 * reconciled without re-tuning every angle below.
 */
export const MODEL_ANCHOR_FROM_TOP = 0.44;

/**
 * The glasses are generated as geometry rather than modelled: the source
 * photo was cleaned of them before reconstruction (a single-image rebuild
 * turns lenses into a smear of shadow), and they are the owner's strongest
 * recognisable feature, so they are put back by hand.
 *
 * Measured against the normalised pose (model height 2, face centre at the
 * origin): eyes at y=0.08, front of the face z≈0.49 (bridge of the nose
 * 0.53), temples at |x|≈0.32, widest point of the head |x|≈0.49. Swapping
 * the model means measuring these again.
 */
export const GLASSES = {
  /** Lens centre — a touch below the eyes, so the rim clears the brows. */
  eyeY: 0.08,
  /** The plane the frames live on, just proud of the face. */
  frontZ: 0.545,
  lensW: 0.26,
  lensH: 0.21,
  /** Distance from the centre line to one lens' centre. */
  lensCX: 0.175,
  /** Width of the frame bar — the "thick" in thick black frames. */
  rim: 0.032,
  depth: 0.04,
  /** Where a temple arm disappears into the hair. Keep the splay small or
   *  they read as antlers head-on. */
  earX: 0.42,
  earY: 0.05,
  earZ: -0.18,
} as const;

/**
 * Seven stickers, in the order the camera visits them. Every angle here was
 * placed by hand in `?edit=1` and exported — see `docs/INTRO3D.md` before
 * touching a number.
 */
export const INTRO_STICKERS: IntroSticker[] = [
  {
    id: "frontend",
    label: "FRONTEND",
    icon: "💻",
    shape: "badge",
    colors: { bg: "#FFD84D", ink: "#1A1A1A" },
    dir: { theta: -24, phi: 35 },
    size: 0.155,
    rotation: -8,
    distance: 2.0,
  },
  {
    id: "webgl",
    label: "3D / WEBGL",
    icon: "🧊",
    shape: "badge",
    colors: { bg: "#4DA3FF", ink: "#FFFFFF" },
    dir: { theta: 13, phi: 31 },
    size: 0.15,
    rotation: 10,
    distance: 2.0,
  },
  {
    id: "design",
    label: "DESIGN",
    icon: "🎨",
    shape: "circle",
    colors: { bg: "#FF7A3D", ink: "#FFFFFF" },
    dir: { theta: -28, phi: -22 },
    size: 0.145,
    rotation: -14,
    distance: 1.95,
  },
  {
    id: "ai",
    label: "AI",
    icon: "🤖",
    shape: "badge",
    colors: { bg: "#A78BFA", ink: "#FFFFFF" },
    dir: { theta: 24, phi: -17 },
    size: 0.15,
    rotation: 12,
    distance: 1.95,
  },
  {
    id: "ship",
    label: "SHIP IT",
    icon: "🚀",
    shape: "banner",
    colors: { bg: "#FF5A5F", ink: "#FFFFFF" },
    dir: { theta: -4, phi: -34 },
    size: 0.13,
    rotation: -5,
    distance: 2.05,
  },
  {
    id: "oss",
    label: "OSS",
    icon: "📦",
    shape: "circle",
    colors: { bg: "#3DDC97", ink: "#0F2E22" },
    dir: { theta: 31, phi: -9 },
    size: 0.13,
    rotation: 16,
    distance: 1.9,
  },
  {
    id: "slow",
    label: "SLOW",
    icon: "🕯️",
    shape: "circle",
    colors: { bg: "#F4F1EA", ink: "#3B2A1F" },
    dir: { theta: -26, phi: -11 },
    size: 0.125,
    rotation: -20,
    distance: 1.9,
  },
];

/**
 * The shape of the words — still not the words. This is the contract the
 * Server Component fills and the whole client tree consumes, so it is stated
 * here rather than inside one of the `"use client"` components: types erase,
 * so either home compiles, but the second one quietly hands ownership of what
 * the server must produce to whichever client component declared it first.
 */

/** Copy for one sticker, localized upstream in a Server Component. */
export type IntroCopy = {
  id: string;
  kicker: string;
  title: string;
  period?: string;
  body: string;
  bullets: string[];
};

export type IntroText = {
  name: string;
  role: string;
  meta: string;
  tagline: string;
  scrollHint: string;
  outroTitle: string;
  outroBody: string;
  /** Names the résumé for a screen reader while it is still the hidden,
   *  focus-revealed copy — see IntroResume's `seo` wrapper. */
  resumeRegion: string;
};

export type IntroLink = {
  label: string;
  href: string;
  external?: boolean;
};
