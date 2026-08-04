"use client";

/**
 * The three decisions every WebGL scene on this site has to make before it
 * spends a visitor's battery or bandwidth. They used to live twice — once in
 * `components/about/Workstation.tsx`, once in `components/intro/IntroStage.tsx`
 * — and had already drifted: the intro never checked Save-Data, which is the
 * one setting a multi-megabyte model is most obliged to respect.
 *
 * All three read the live browser, so they belong in an effect, never in a
 * render path that also runs on the server.
 */

/** The visitor asked the OS for less motion. Neither scene refuses outright:
 *  /about parks on a single still frame, /intro serves the plain résumé. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Data Saver is on. Read as an explicit refusal to spend bytes on decoration,
 * not as a guess about connection speed — which is why a scene that trips this
 * skips entirely instead of loading a smaller model.
 */
export function prefersSaveData(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return nav.connection?.saveData === true;
}

/**
 * Whether a WebGL context can be had at all — for callers that have to decide
 * *before* anything is built. Code that is already constructing a
 * `THREE.WebGLRenderer` should keep its own try/catch around that instead: it
 * catches everything this probe does plus the failures that only surface on
 * the real renderer (blocklisted GPUs, a driver that dies mid-construction).
 */
export function hasWebGL(): boolean {
  if (!window.WebGLRenderingContext) return false;
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  try {
    const canvas = document.createElement("canvas");
    gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    return gl !== null;
  } catch {
    return false;
  } finally {
    // Browsers cap live contexts at roughly 16 and silently kill the oldest to
    // hand out a new one. A probe that leaves its context for the garbage
    // collector therefore holds one hostage on a page whose entire purpose is
    // to open a real one moments later. Dropping the reference is not enough —
    // only WEBGL_lose_context releases it now.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
