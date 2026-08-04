import * as THREE from "three";
import type { StickerShape } from "@/lib/intro/stickers";

/**
 * Sticker textures, drawn procedurally into a canvas.
 *
 * Deliberately no PNG assets: the word, the colours and the icon all live in
 * `src/lib/intro/stickers.ts`, and changing one is a refresh rather than a
 * re-export. The look is retro pop — fat white outline, hard offset shadow.
 *
 * Fonts are named explicitly rather than taken from the site's stack: these
 * glyphs are rasterized by the 2D canvas, which cannot see next/font's
 * generated family names.
 */

const W = 512;

const HEIGHT_BY_SHAPE: Record<StickerShape, number> = {
  badge: 384,
  circle: 512,
  banner: 240,
};

const TEXT_FONT = '"Helvetica Neue", "PingFang SC", Helvetica, Arial, sans-serif';
const EMOJI_FONT =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export type StickerTexture = {
  texture: THREE.CanvasTexture;
  /** width / height — used to derive the decal's real size. */
  aspect: number;
};

function tracePath(
  ctx: CanvasRenderingContext2D,
  shape: StickerShape,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.beginPath();
  if (shape === "circle") {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else {
    // Badges get a generous radius, banners are near-capsules.
    const r = shape === "banner" ? h / 2 : Math.min(w, h) * 0.22;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
  }
  ctx.closePath();
}

/** Shrink the type until it fits the available width. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: string,
  startPx: number,
  maxWidth: number
) {
  let px = startPx;
  for (;;) {
    ctx.font = `${weight} ${px}px ${TEXT_FONT}`;
    if (ctx.measureText(text).width <= maxWidth || px <= 12) return px;
    px -= 2;
  }
}

export function createStickerTexture(opts: {
  label: string;
  icon: string;
  shape: StickerShape;
  bg: string;
  ink: string;
}): StickerTexture {
  const { label, icon, shape, bg, ink } = opts;
  const H = HEIGHT_BY_SHAPE[shape];

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");

  // Room for the outline and the shadow.
  const pad = 34;
  const bx = pad;
  const by = pad;
  const bw = W - pad * 2;
  const bh = H - pad * 2;

  // 1. Hard shadow — the retro-pop tell: offset and solid, never blurred.
  ctx.save();
  ctx.translate(9, 11);
  tracePath(ctx, shape, bx, by, bw, bh);
  ctx.fillStyle = "rgba(20,16,12,0.30)";
  ctx.fill();
  ctx.restore();

  // 2. The white die-cut border.
  tracePath(ctx, shape, bx, by, bw, bh);
  ctx.lineJoin = "round";
  ctx.lineWidth = 34;
  ctx.strokeStyle = "#FFFFFF";
  ctx.stroke();

  // 3. Fill.
  ctx.fillStyle = bg;
  ctx.fill();

  // 4. A dark inner keyline, for the printed feel.
  ctx.lineWidth = 7;
  ctx.strokeStyle = "rgba(26,22,18,0.55)";
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = ink;

  const cx = W / 2;
  // A circle narrows towards the bottom, so the usable text width shrinks
  // with it — otherwise a long word gets clipped by the curve.
  const maxTextW = bw * (shape === "circle" ? 0.62 : 0.78);

  if (shape === "banner") {
    // Banner: icon and word side by side.
    ctx.textBaseline = "middle";
    const iconPx = bh * 0.5;
    ctx.font = `${iconPx}px ${EMOJI_FONT}`;
    const iconW = ctx.measureText(icon).width;

    const labelPx = fitFont(ctx, label, "800", bh * 0.42, maxTextW - iconW - 20);
    const labelW = ctx.measureText(label).width;

    const totalW = iconW + 18 + labelW;
    const startX = cx - totalW / 2;

    ctx.textAlign = "left";
    ctx.font = `${iconPx}px ${EMOJI_FONT}`;
    ctx.fillText(icon, startX, H / 2 + 2);

    ctx.font = `800 ${labelPx}px ${TEXT_FONT}`;
    ctx.fillStyle = ink;
    ctx.fillText(label, startX + iconW + 18, H / 2 + 2);
  } else {
    // Badge / circle: icon above, word below.
    const iconPx = bh * (shape === "circle" ? 0.4 : 0.44);
    ctx.textBaseline = "alphabetic";
    ctx.font = `${iconPx}px ${EMOJI_FONT}`;
    ctx.fillText(icon, cx, by + bh * 0.56);

    const labelPx = fitFont(ctx, label, "800", bh * 0.19, maxTextW);
    ctx.font = `800 ${labelPx}px ${TEXT_FONT}`;
    ctx.fillStyle = ink;
    ctx.fillText(label, cx, by + bh * 0.84);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  return { texture, aspect: W / H };
}
