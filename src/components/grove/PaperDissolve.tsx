"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { gsap } from "@/lib/gsap";
import { hasWebGL } from "@/lib/three/guards";
import { compileProgram, FULLSCREEN_VERT, watchContextLoss } from "@/lib/webgl";

type Props = {
  /** 0 = nothing painted, 1 = the whole frame turned to paper. Read every
   *  frame; the layer only redraws when the number has actually moved. */
  progressRef: RefObject<number>;
  className?: string;
};

/**
 * The site's two papers, as linear-ish floats — globals.css `--bg` in each
 * theme. Kept here rather than read from the cascade because this layer paints
 * over a canvas, and a computed colour that arrives one frame late shows up as
 * a flash of the wrong paper.
 */
const PAPER = {
  light: [0.980, 0.976, 0.965],
  dark: [0.055, 0.055, 0.067],
} as const;

/**
 * The lab's dissolve, inverted into a paper *overlay*.
 *
 * The field is the one from `/lab/dissolve` — a vertical gradient bent by
 * low-frequency fbm into clumps, flecked by higher octaves — and the threshold
 * sweeps it exactly the same way. What differs is what gets painted: the study
 * mixes paper over an image it samples, this one has no image to sample (the
 * grove is a live scene on the canvas underneath) so it paints paper with the
 * mask as its alpha and lets the compositor do the mixing.
 */
const FRAG = /* glsl */ `#version 300 es
precision highp float;

uniform vec2  uRes;
uniform float uProgress;
uniform float uTime;
uniform vec3  uPaper;

out vec4 fragColor;

float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i),                 hash21(i + vec2(1.0, 0.0)), u.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for(int i = 0; i < 4; i++){
    s += a * vnoise(p);
    p *= 2.07;
    a *= 0.5;
  }
  return s;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float ar = uRes.x / uRes.y;
  vec2 auv = vec2(uv.x * ar, uv.y);

  float lump   = fbm(auv * 2.4 + vec2(0.0, uTime * 0.012)) - 0.5;
  float detail = fbm(auv * 8.4 + 31.0) - 0.5;
  float speck  = fbm(auv * 21.0 + 7.0) - 0.5;

  /* The front climbs from the top here, not the foot: the reader is leaving
     the grove downward, so the paper of the page below has to come down over
     it. Hence 1.0 - uv.y where the study uses uv.y. */
  float field = (1.0 - uv.y) + lump * 0.62 + detail * 0.155 + speck * 0.085;

  float t = mix(-0.35, 1.35, uProgress);
  float aa = max(fwidth(field), 0.0018) * 1.15 + 0.004;
  float mask = smoothstep(t - aa, t + aa, field);   // 1 = grove still showing

  vec3 paper = uPaper;
  paper *= 0.982 + fbm(auv * 7.5) * 0.034;

  fragColor = vec4(paper, 1.0 - mask);
}`;

/**
 * A paper wash that eats the frame beneath it along an organic front.
 *
 * Bare WebGL2 on purpose (DESIGN.md §2.2): one triangle and one fragment
 * shader do not need a scene graph, and the page it lands on is already paying
 * for the grove's own renderer. Draws only when the threshold has moved, so a
 * parked front costs nothing.
 */
export function PaperDissolve({ progressRef, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Bumped when a lost context comes back, so the effect rebuilds on it. */
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasWebGL()) return;

    // Watched before the context is asked for, so a loss during setup is
    // seen too; every early exit below hands the watch's dispose back as
    // the cleanup.
    const ctx = watchContextLoss(canvas, () => setEpoch((n) => n + 1));

    // premultipliedAlpha stays at its default (true): the blend below writes
    // `paper * alpha` into the framebuffer, which is a premultiplied colour,
    // and telling the compositor otherwise makes it multiply by alpha twice.
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: false });
    if (!gl) return ctx.dispose;

    const prog = compileProgram(gl, FULLSCREEN_VERT, FRAG, "PaperDissolve");
    if (!prog) return ctx.dispose;
    gl.useProgram(prog);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uProgress = gl.getUniformLocation(prog, "uProgress");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uPaper = gl.getUniformLocation(prog, "uPaper");

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let dirty = true;

    const applyTheme = () => {
      const paper = document.documentElement.dataset.theme === "dark" ? PAPER.dark : PAPER.light;
      gl.uniform3f(uPaper, paper[0], paper[1], paper[2]);
      dirty = true;
    };
    applyTheme();
    window.addEventListener("fhfs:theme", applyTheme);

    const resize = () => {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      // The front is a silhouette, not a photograph — it holds up fine at 1x
      // on a dense display, and this layer sits on top of a scene that is
      // already spending the frame's budget.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const cw = Math.round(w * dpr);
      const ch = Math.round(h * dpr);
      // Only the backing store is guarded on "did it change" — resizing a
      // canvas clears it, so doing that every call would be a real cost. The
      // uniform is written unconditionally: it belongs to the *program*, and
      // a fresh program on an already-correct canvas would otherwise be left
      // with uRes at (0, 0) — which divides the whole frame to NaN and paints
      // it black. (That is exactly what a StrictMode remount does.)
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      gl.viewport(0, 0, cw, ch);
      gl.uniform2f(uRes, cw, ch);
      dirty = true;
    };
    resize();
    window.addEventListener("resize", resize);

    let last = -1;
    let clock = 0;
    /* A cleared canvas is still a full-viewport layer the compositor has to
       blend over the live scene beneath it, on every frame that scene draws.
       So while there is no paper to show, the layer is taken out of the
       picture altogether rather than left transparent in it. */
    // Read off the element rather than assumed: a rebuild after a context
    // loss inherits whatever the previous run left on the style.
    let shown = canvas.style.visibility !== "hidden";
    const show = (on: boolean) => {
      if (on === shown) return;
      shown = on;
      canvas.style.visibility = on ? "" : "hidden";
    };
    const frame = (_t: number, deltaMs: number) => {
      if (ctx.lost) return;
      const p = progressRef.current ?? 0;
      // Fully transparent and staying there: nothing to draw, and no clock to
      // advance either — a parked front does not shimmer.
      if (p <= 0 && last <= 0 && !dirty) return;
      if (p !== last) dirty = true;
      if (!dirty) return;
      last = p;
      dirty = false;
      show(p > 0);
      clock += deltaMs * 0.001;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      // Before the front has been asked for, the frame is the grove's alone —
      // an empty clear, not a pass whose threshold happens to land off-screen.
      if (p <= 0) return;
      gl.uniform1f(uProgress, p);
      gl.uniform1f(uTime, clock);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    gsap.ticker.add(frame);

    return () => {
      gsap.ticker.remove(frame);
      ctx.dispose();
      window.removeEventListener("resize", resize);
      window.removeEventListener("fhfs:theme", applyTheme);
      // After a loss the program went with the context; nothing to delete.
      if (!ctx.lost) gl.deleteProgram(prog);
      // Deliberately NOT loseContext(). A canvas hands back the same context
      // object every time it is asked and a lost one stays lost, so under
      // StrictMode's mount/unmount/mount the second pass would compile against
      // a dead context and paint nothing — in development only, which is
      // exactly where it is hardest to spot. Same reasoning as LiquidPill.
    };
  }, [progressRef, epoch]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
