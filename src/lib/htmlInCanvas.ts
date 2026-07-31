/**
 * HTML-in-Canvas (WICG) — capability detection, typings and helpers.
 *
 * The API lets a canvas draw a *live* DOM subtree (`layoutsubtree` +
 * `ctx.drawElementImage`) while the elements keep native hit testing,
 * focus and accessibility. As of 2026-07 it ships behind a Chrome origin
 * trial only (Safari/Firefox: no implementation announced), so everything
 * built on it must be a pure enhancement layer:
 *
 *   1. SSR always emits the plain, complete DOM.
 *   2. The client checks `supportsHtmlInCanvas()` in an effect (never during
 *      render — a server/client split here would desync hydration).
 *   3. Only then is the canvas mounted and `layoutsubtree` added by JS, so
 *      non-supporting browsers never hide content inside canvas fallback
 *      content.
 *   4. Anything that throws at draw time must fall back to the CSS path.
 *
 * TODO(origin trial): register a token for the production domain and
 * localhost at chromestatus.com/feature/5172548013916160 and emit it as a
 * <meta http-equiv="origin-trial"> from the root layout. Without a token the
 * detection below simply returns false and every consumer takes the CSS
 * fallback — nothing breaks.
 */

declare global {
  interface CanvasRenderingContext2D {
    /** Draws a live element from the canvas' layout subtree. */
    drawElementImage?: (
      element: Element,
      dx: number,
      dy: number,
      dw?: number,
      dh?: number
    ) => void;
  }

  interface HTMLCanvasElement {
    /** Maps a drawn element back to page coordinates (for hit alignment). */
    getElementTransform?: (element: Element, transform?: DOMMatrix) => DOMMatrix;
    /** Asks for one more paint event on the next frame. */
    requestPaint?: () => void;
  }
}

/** A 2D context known to carry the HTML-in-Canvas draw primitive. */
export type ElementDrawingContext = CanvasRenderingContext2D & {
  drawElementImage: NonNullable<CanvasRenderingContext2D["drawElementImage"]>;
};

// The probe allocates a throwaway canvas + context; cache the verdict so
// several enhanced components on one page pay for it once.
let cached: boolean | null = null;

/**
 * True when this browser can draw live DOM into a 2D canvas. Always false on
 * the server, so callers can use it directly inside an effect.
 */
export function supportsHtmlInCanvas(): boolean {
  if (typeof document === "undefined") return false;
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement("canvas");
    if (!("getElementTransform" in canvas)) {
      cached = false;
      return cached;
    }
    const ctx = canvas.getContext("2d");
    cached = typeof ctx?.drawElementImage === "function";
  } catch {
    cached = false;
  }
  return cached;
}

/**
 * Returns the canvas' 2D context narrowed to the enhanced type, or null when
 * the API is unavailable — the single place consumers assert support.
 */
export function getElementDrawingContext(
  canvas: HTMLCanvasElement
): ElementDrawingContext | null {
  if (!supportsHtmlInCanvas()) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx || typeof ctx.drawElementImage !== "function") return null;
  return ctx as ElementDrawingContext;
}

/**
 * Opts the canvas' children into layout (and out of direct painting). Added
 * by JS on purpose: in a browser without the API the same children must stay
 * visible as ordinary canvas fallback content.
 */
export function enableLayoutSubtree(canvas: HTMLCanvasElement): void {
  canvas.setAttribute("layoutsubtree", "");
}
