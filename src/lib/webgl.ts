"use client";

/**
 * What every raw-WebGL2 layer on this site has to do besides its own shader.
 *
 * DESIGN.md §2.2 says a new full-screen effect goes to bare WebGL2 before it
 * goes to three. Three layers already did (the paper wash, the liquid pill,
 * the liquid-metal study), each with its own compile/link and none with a
 * plan for the context being taken away — which mobile Safari does to a
 * backgrounded tab, and every browser does when too many contexts are open.
 * This is the shared floor under them: compiling a program, and noticing
 * when the GPU has gone and come back.
 */

/**
 * The one vertex shader a single-pass effect needs: an oversized triangle
 * that covers the clip space, with no buffers. Pair it with a fragment
 * shader that reads `gl_FragCoord`.
 */
export const FULLSCREEN_VERT = /* glsl */ `#version 300 es
void main(){
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * Compile and link one program. Returns null on failure, with the driver's
 * message in the console outside production — a shader that does not build
 * is a bug to read about, not an exception to catch. The shaders are
 * released once linked; the program is the caller's to delete.
 */
export function compileProgram(
  gl: WebGL2RenderingContext,
  vert: string,
  frag: string,
  tag = "webgl"
): WebGLProgram | null {
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[${tag}] shader failed:`, gl.getShaderInfoLog(sh));
      }
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };

  const vs = compile(gl.VERTEX_SHADER, vert);
  const fs = compile(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  const prog = gl.createProgram();
  if (!prog) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[${tag}] program failed to link:`, gl.getProgramInfoLog(prog));
    }
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

export type ContextWatch = {
  /** True from the moment the context is lost until the effect rebuilds. */
  readonly lost: boolean;
  dispose(): void;
};

/**
 * Watch a canvas for its WebGL context being lost and restored.
 *
 * `webglcontextlost` is answered with `preventDefault()`, which is the only
 * way to be offered `webglcontextrestored` at all; without it the loss is
 * final. While `lost` is true the caller's frame loop should draw nothing —
 * every GL call on a lost context is a silent no-op, so a loop that keeps
 * running is not wrong, only pointless.
 *
 * When the context comes back every resource on it is gone, so rather than
 * ask each layer to rebuild in place, `onRestored` is expected to re-run the
 * whole effect — bump a state counter the effect depends on. Its cleanup then
 * runs against the restored context, where deleting the stale handles is
 * harmless, and the fresh run asks the same canvas for its context and gets
 * the restored one back.
 */
export function watchContextLoss(
  canvas: HTMLCanvasElement,
  onRestored: () => void
): ContextWatch {
  let lost = false;
  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
  };
  const onRestore = () => {
    onRestored();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestore);
  return {
    get lost() {
      return lost;
    },
    dispose() {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestore);
    },
  };
}
