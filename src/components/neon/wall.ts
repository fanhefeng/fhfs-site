/* ---- the bricks ---- */

/** Brick face and mortar, in CSS pixels. Wide bricks, as on the poster. */
const BRICK = { w: 106, h: 42, mortar: 7 };
/** Pixel budget for the wall: painted once, and the lab's wall is two screens tall. */
const WALL_PIXELS = 6_500_000;

let noiseTile: HTMLCanvasElement | null = null;

/** A small tile of grey noise, made once and repeated over the wall. */
function noise(): HTMLCanvasElement {
  if (noiseTile) return noiseTile;
  const size = 160;
  const tile = document.createElement("canvas");
  tile.width = tile.height = size;
  const ctx = tile.getContext("2d");
  if (ctx) {
    const img = ctx.createImageData(size, size);
    const data = img.data;
    let seed = 91;
    for (let i = 0; i < data.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const v = seed >>> 24;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  noiseTile = tile;
  return tile;
}

/**
 * Paints the wall: rows of bricks, every other row shifted half a brick,
 * each brick its own dark blue-grey, lit along its top edge and shadowed
 * under its bottom, grain over the lot and the corners falling into dark.
 * Deterministic — the same wall every visit — and painted once per resize.
 */
export function paintWall(canvas: HTMLCanvasElement, w: number, h: number) {
  const budget = Math.sqrt(WALL_PIXELS / (w * h));
  const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.max(1, budget));
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Mortar under everything.
  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, w, h);

  const pitchX = BRICK.w + BRICK.mortar;
  const pitchY = BRICK.h + BRICK.mortar;
  const rows = Math.ceil(h / pitchY) + 1;
  const cols = Math.ceil(w / pitchX) + 2;
  let seed = 2016;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let r = 0; r < rows; r++) {
    const y = r * pitchY;
    const shift = r % 2 ? pitchX / 2 : 0;
    for (let c = -1; c < cols; c++) {
      const x = c * pitchX + shift;
      const hue = 226 + rnd() * 16 - 8;
      const sat = 12 + rnd() * 10;
      const light = 12 + rnd() * 6;
      ctx.fillStyle = `hsl(${hue.toFixed(0)} ${sat.toFixed(0)}% ${light.toFixed(1)}%)`;
      ctx.beginPath();
      ctx.roundRect(x, y, BRICK.w, BRICK.h, 2);
      ctx.fill();
      // A hairline of light along the top edge, a shadow under the bottom.
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(x + 1, y, BRICK.w - 2, 1.5);
      ctx.fillStyle = "rgba(0,0,0,0.38)";
      ctx.fillRect(x + 1, y + BRICK.h - 2.5, BRICK.w - 2, 2.5);
      // Now and then a brick that was fired darker.
      if (rnd() < 0.08) {
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(x, y, BRICK.w, BRICK.h);
      }
    }
  }

  const grain = ctx.createPattern(noise(), "repeat");
  if (grain) {
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  // The first screen falls away into the night at its corners; further
  // down the wall it simply stays dim.
  const first = Math.min(h, window.innerHeight || h);
  const vignette = ctx.createRadialGradient(
    w / 2, first * 0.42, Math.min(w, first) * 0.12,
    w / 2, first * 0.42, Math.max(w, first) * 0.72
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(0.5, "rgba(0,0,0,0.42)");
  vignette.addColorStop(1, "rgba(0,0,0,0.9)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, first);
  if (h > first) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, first, w, h - first);
  }
}

/**
 * Lays the stage out around the sign: the light on the bricks is centred on
 * the sign whatever the viewport made of the layout (the spill reads the
 * variables), and the wall is painted at the stage's size. Returns false when
 * the stage has no size yet.
 */
export function layoutWall(stage: HTMLElement, wall: HTMLCanvasElement, sign: HTMLElement): boolean {
  const r = stage.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  const s = sign.getBoundingClientRect();
  const sx = ((s.left + s.width / 2 - r.left) / r.width) * 100;
  const sy = ((s.top + s.height / 2 - r.top) / r.height) * 100;
  stage.style.setProperty("--nb-sx", `${sx.toFixed(2)}%`);
  stage.style.setProperty("--nb-sy", `${sy.toFixed(2)}%`);
  stage.style.setProperty("--nb-sr", `${(s.width * 0.72).toFixed(0)}px`);
  paintWall(wall, r.width, r.height);
  return true;
}

/**
 * The stage's own stylesheet: the brick placeholder until the canvas paints,
 * the canvas, and the blue the sign throws on the bricks — screen over the
 * wall, opacity driven by the score, a static layer once the sign holds.
 */
export const WALL_CSS = `
.nb-stage {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  /* Until the canvas paints: mortar and a plain course of bricks. */
  background-color: #14151d;
  background-image:
    linear-gradient(#0a0a0f 7px, transparent 7px),
    linear-gradient(90deg, #0a0a0f 7px, transparent 7px);
  background-size: 100% 49px, 113px 49px;
}
.nb-wall {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: block;
  width: 100%;
  height: 100%;
}
.nb-spill {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  mix-blend-mode: screen;
  opacity: 0;
  background:
    radial-gradient(
      circle var(--nb-sr, 340px) at var(--nb-sx, 50%) var(--nb-sy, 44%),
      rgba(76, 124, 255, 0.82) 0%,
      rgba(48, 90, 240, 0.42) 36%,
      rgba(24, 48, 170, 0.12) 68%,
      rgba(0, 0, 0, 0) 100%
    );
}
`;
