"use client";

/**
 * The two decisions every WebGL scene on this site has to make before it
 * spends a visitor's battery or bandwidth. They used to live twice — once in
 * `components/about/Workstation.tsx`, once in `components/intro/IntroStage.tsx`
 * — and had already drifted: the intro never checked Save-Data, which is the
 * one setting a multi-megabyte model is most obliged to respect.
 *
 * There used to be a third — a reduced-motion guard. It is gone from here on
 * purpose: the site serves a single full-motion version to everyone, and a 3D
 * scene is never gated on that signal (DESIGN.md §1.5 — the narrow exception
 * that remains covers endless background loops and the scroll hijack, and
 * lives in `lib/gsap.ts`). The reason is empirical, not ideological. On
 * Windows the signal is spelled "Show animations in Windows", and it is
 * switched off by anything
 * that chases speed — the Ease of Access toggle, "Adjust for best
 * performance", battery saver. Visitors arriving that way had never asked for
 * less motion; they were handed a hollowed-out site they could not opt out of,
 * and had no way to know a fuller one existed.
 *
 * Save-Data below is a different kind of signal and stays: it is an explicit,
 * unambiguous refusal to spend bytes, not a side effect of a speed tweak.
 *
 * Both read the live browser, so they belong in an effect, never in a
 * render path that also runs on the server.
 */

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
