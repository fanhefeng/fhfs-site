/**
 * Colour plumbing shared by the site's 2D canvas layers.
 *
 * Canvas cannot read a CSS custom property directly, so every canvas that
 * wants to sit on the theme has to resolve the token itself and re-read it
 * when the lamp flips. The parsing is the fiddly half and is identical
 * wherever it happens, so it lives here rather than in each layer.
 */

export type Rgb = [number, number, number];

/**
 * Reads `#rgb`, `#rrggbb` and `rgb()/rgba()` — the two shapes the theme tokens
 * actually take (hex in the stylesheet, `rgb()` once resolved through
 * `getComputedStyle`). Alpha is dropped: callers carry their own.
 */
export function parseColor(input: string, fallback: Rgb): Rgb {
  const value = input.trim();
  if (!value) return fallback;

  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      const n = Number.parseInt(hex, 16);
      if (Number.isNaN(n)) return fallback;
      const r = (n >> 8) & 0xf;
      const g = (n >> 4) & 0xf;
      const b = n & 0xf;
      return [r * 17, g * 17, b * 17];
    }
    if (hex.length >= 6) {
      const n = Number.parseInt(hex.slice(0, 6), 16);
      if (Number.isNaN(n)) return fallback;
      return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
    }
    return fallback;
  }

  const nums = value.match(/-?\d*\.?\d+/g);
  if (!nums || nums.length < 3) return fallback;
  return [Number(nums[0]), Number(nums[1]), Number(nums[2])];
}
