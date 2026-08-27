import type * as THREE from "three";

/**
 * Dispose a renderer and hand its context back clean.
 *
 * The <canvas> outlives the renderer. React keeps the element across
 * StrictMode's mount → cleanup → mount and across Fast Refresh, and
 * `getContext()` then returns the same WebGL context it did the first time —
 * carrying whatever state the last renderer left in it. `dispose()` frees
 * three's objects but never touches that state, so the next
 * `new WebGLRenderer` on the canvas builds its placeholder 3D textures while
 * `UNPACK_FLIP_Y_WEBGL` is still true from the last CanvasTexture upload, and
 * WebGL refuses: "texImage3D: FLIP_Y or PREMULTIPLY_ALPHA isn't allowed for
 * uploading 3D textures". It surfaced the day the grove started baking its
 * bark plates synchronously — an upload now happens before StrictMode's
 * cleanup gets a turn.
 *
 * `resetState()` is three's own way of returning a context to defaults;
 * calling it before dispose is what makes a canvas reusable. Losing the
 * context instead is not an option — a lost context on a persisted canvas is
 * the trap LiquidPill's cleanup notes.
 */
export function releaseRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.resetState();
  renderer.dispose();
}
