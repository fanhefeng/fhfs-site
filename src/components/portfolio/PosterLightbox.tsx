"use client";

import { useRef, useState } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

const POSTER_W = 896;
const POSTER_H = 1152;
const POSTER_COUNT = 4;
const AUTO_ADVANCE_MS = 9000;
const TRANSITION_S = 1.1;

/* ------------------------------------------------------------------ */
/* Procedural posters                                                   */
/* ------------------------------------------------------------------ */

/**
 * Poster palette is INTENTIONALLY fixed dark and does not follow the site
 * theme: the lightbox is a lit poster case outside a theatre — the print
 * inside stays a night print even during a daytime (light-theme) visit.
 * Hues echo the site's neon tokens but are baked in as screen-print inks.
 */
const INKS = [
  { field: "#e8b44f", accent: "#ff4d6d" }, // gold field, red accent
  { field: "#ff4d6d", accent: "#4cc9f0" }, // red field, blue accent
  { field: "#4cc9f0", accent: "#e8b44f" }, // blue field, gold accent
];

const POSTER_COPY = [
  { word: "MIDNIGHT SET", date: "FRI · DEC 05 · 1AM SET" },
  { word: "BLUE ROOM", date: "SAT · JAN 17 · DOORS 11PM" },
  { word: "CITY OF STARS", date: "THU · FEB 26 · TWO SETS" },
  { word: "LAST CALL", date: "SUN · MAR 08 · TIL CLOSE" },
];

/** Draw one 896x1152 screen-print style show poster onto a 2D canvas. */
function makePoster(seed: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = POSTER_W;
  canvas.height = POSTER_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const ink = INKS[seed % INKS.length];
  const copy = POSTER_COPY[seed % POSTER_COPY.length];
  const W = POSTER_W;
  const H = POSTER_H;

  // Deep night ground.
  ctx.fillStyle = "#0e1020";
  ctx.fillRect(0, 0, W, H);

  // Large colour field — placement rotates with the seed so each sheet
  // reads as its own print run.
  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = ink.field;
  if (seed % 4 === 0) {
    ctx.beginPath();
    ctx.arc(W * 0.62, H * 0.3, W * 0.42, 0, Math.PI * 2);
    ctx.fill();
  } else if (seed % 4 === 1) {
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.32);
    ctx.fillRect(-W, -H * 0.16, W * 2, H * 0.32);
  } else if (seed % 4 === 2) {
    ctx.fillRect(0, H * 0.56, W, H * 0.44);
  } else {
    ctx.beginPath();
    ctx.arc(W * 0.3, H * 0.68, W * 0.48, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Accent stripe / half moon, slightly off-register like a cheap print.
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = ink.accent;
  if (seed % 2 === 0) {
    ctx.fillRect(W * 0.08, H * 0.08, W * 0.035, H * 0.5);
  } else {
    ctx.beginPath();
    ctx.arc(W * 0.78, H * 0.78, W * 0.16, Math.PI * 0.5, Math.PI * 1.5);
    ctx.fill();
  }
  ctx.restore();

  // Headliner: giant FHF'S — vertical stack on even seeds, banner on odd.
  ctx.fillStyle = "#f5efe2";
  ctx.textBaseline = "middle";
  if (seed % 2 === 0) {
    ctx.textAlign = "center";
    ctx.font = `900 ${Math.floor(H * 0.16)}px Georgia, "Times New Roman", serif`;
    const letters = ["F", "H", "F", "'S"];
    letters.forEach((ch, i) => {
      ctx.fillText(ch, W * 0.24, H * (0.2 + i * 0.185));
    });
  } else {
    ctx.textAlign = "left";
    ctx.font = `900 ${Math.floor(W * 0.24)}px Georgia, "Times New Roman", serif`;
    ctx.fillText("FHF'S", W * 0.07, H * 0.26);
  }

  // Show word in accent-over-dark, positioned opposite the headliner.
  ctx.textAlign = "left";
  ctx.font = `700 ${Math.floor(W * 0.062)}px Georgia, serif`;
  ctx.fillStyle = "#0e1020";
  const wordY = seed % 2 === 0 ? H * 0.835 : H * 0.68;
  ctx.fillText(copy.word, W * 0.09, wordY);
  ctx.fillStyle = "#f5efe2";
  ctx.fillText(copy.word, W * 0.09 - 4, wordY - 4);

  // Mono metadata block — kept clear of the lightbox caption strip below.
  ctx.font = `400 ${Math.floor(W * 0.025)}px "Courier New", monospace`;
  ctx.fillStyle = "rgba(245, 239, 226, 0.85)";
  ctx.fillText("LIVE · AFTER HOURS", W * 0.09, H * 0.895);
  ctx.fillText(copy.date, W * 0.09, H * 0.923);
  ctx.textAlign = "right";
  ctx.fillText(`NO.${String(seed + 1).padStart(2, "0")}`, W * 0.91, H * 0.923);

  // Halftone-ish grain: sparse random dots, two tones.
  for (let i = 0; i < 2200; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const dark = Math.random() > 0.5;
    ctx.fillStyle = dark ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.08)";
    ctx.fillRect(x, y, 2, 2);
  }

  // Vignette so the sheet sits back into the box.
  const vg = ctx.createRadialGradient(
    W / 2,
    H / 2,
    H * 0.32,
    W / 2,
    H / 2,
    H * 0.78
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.52)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // Hairline frame inside the sheet.
  ctx.strokeStyle = "rgba(245,239,226,0.28)";
  ctx.lineWidth = 2;
  ctx.strokeRect(W * 0.045, H * 0.035, W * 0.91, H * 0.93);

  return canvas;
}

/* ------------------------------------------------------------------ */
/* WebGL ripple transition (faithful port of MOTION LAB S7)             */
/* ------------------------------------------------------------------ */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// S7 recipe: radial wave * spatial+temporal decay, UV push away from the
// click point, expanding smoothstep ring as the reveal mask, and per-channel
// offset multipliers (1.00/1.04/1.08) for lens dispersion at the wavefront.
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uPrev, uNext;
uniform vec2 uRes, uImg, uMouse;
uniform float uProgress;

// object-fit: cover sampling coordinates.
vec2 coverUv(vec2 uv, vec2 res, vec2 img) {
  float rs = res.x / res.y;
  float ri = img.x / img.y;
  vec2 s = rs > ri ? vec2(1.0, ri / rs) : vec2(rs / ri, 1.0);
  return (uv - 0.5) / s + 0.5;
}

void main() {
  vec2 uv = coverUv(vUv, uRes, uImg);

  float d = distance(vUv, uMouse);
  float wave = sin(d * 34.0 - uProgress * 16.0)
             * exp(-d * 5.5)
             * (1.0 - uProgress);

  // 0.09 distortion amplitude — above ~0.15 the image tears apart.
  vec2 dir = normalize(vUv - uMouse + vec2(1e-5));
  vec2 off = dir * wave * 0.09;

  float edge = smoothstep(uProgress * 1.5 - 0.28, uProgress * 1.5, d);

  vec4 nR = texture2D(uNext, uv + off * 1.00);
  vec4 nG = texture2D(uNext, uv + off * 1.04);
  vec4 nB = texture2D(uNext, uv + off * 1.08);
  vec4 pR = texture2D(uPrev, uv + off * 1.00);
  vec4 pG = texture2D(uPrev, uv + off * 1.04);
  vec4 pB = texture2D(uPrev, uv + off * 1.08);

  vec3 col = mix(vec3(nR.r, nG.g, nB.b), vec3(pR.r, pG.g, pB.b), edge);

  // Warm crest highlight so the ripple has volume (poster is fixed dark,
  // so this gold is baked in on purpose — see INKS note above).
  col += vec3(0.91, 0.72, 0.34) * abs(wave) * 0.22;

  gl_FragColor = vec4(col, 1.0);
}`;

type Props = {
  /** Localized caption line, e.g. "POSTER BOX · CLICK TO SHUFFLE". */
  kicker: string;
};

/**
 * Theatre poster lightbox: four procedural show posters cross-fade through
 * a click-centred ripple distortion (native WebGL1, one fullscreen triangle,
 * two textures). Renders only while a transition runs — the tween's onUpdate
 * is the render loop, so a static poster costs zero frames. Auto-advances
 * every 9s while on screen; reduced motion gets instant cuts and no autoplay.
 */
export function PosterLightbox({ kicker }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef<HTMLCanvasElement>(null);
  const [index, setIndex] = useState(0);
  const [lost, setLost] = useState(false);

  // Imperative bridge from the WebGL setup into React event handlers.
  const advanceRef = useRef<(u: number, v: number) => void>(() => {});

  useGSAP(
    (_, contextSafe) => {
      const root = rootRef.current;
      const canvas = glCanvasRef.current;
      if (!root || !canvas) return;

      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      const posters = Array.from({ length: POSTER_COUNT }, (_, i) =>
        makePoster(i)
      );

      const gl = canvas.getContext("webgl", {
        antialias: false,
        alpha: false,
      });

      const showFallback = (posterIndex: number) => {
        const fb = fallbackRef.current;
        const ctx = fb?.getContext("2d");
        if (fb && ctx) {
          fb.width = POSTER_W;
          fb.height = POSTER_H;
          ctx.drawImage(posters[posterIndex], 0, 0);
        }
        setLost(true);
      };

      if (!gl) {
        showFallback(0);
        return;
      }

      /* --- program ------------------------------------------------- */
      const compile = (type: number, src: string) => {
        const s = gl.createShader(type);
        if (!s) return null;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          // eslint-disable-next-line no-console
          console.error(gl.getShaderInfoLog(s));
          gl.deleteShader(s);
          return null;
        }
        return s;
      };
      const vs = compile(gl.VERTEX_SHADER, VERT);
      const fs = compile(gl.FRAGMENT_SHADER, FRAG);
      const prog = gl.createProgram();
      if (!vs || !fs || !prog) {
        showFallback(0);
        return;
      }
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      gl.useProgram(prog);

      // Fullscreen single triangle.
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW
      );
      const aPos = gl.getAttribLocation(prog, "aPos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      const U = (n: string) => gl.getUniformLocation(prog, n);
      const uPrev = U("uPrev");
      const uNext = U("uNext");
      const uRes = U("uRes");
      const uImg = U("uImg");
      const uMouse = U("uMouse");
      const uProgress = U("uProgress");

      /* --- textures: NPOT, so CLAMP_TO_EDGE + LINEAR, no mipmaps ---- */
      const makeTex = () => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        return t;
      };
      const texA = makeTex(); // previous poster
      const texB = makeTex(); // next poster
      const upload = (tex: WebGLTexture | null, src: HTMLCanvasElement) => {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
      };

      const state = {
        i: 0,
        progress: 1,
        mouse: [0.5, 0.5] as [number, number],
        animating: false,
        contextLost: false,
      };

      const draw = () => {
        if (state.contextLost) return;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texA);
        gl.uniform1i(uPrev, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, texB);
        gl.uniform1i(uNext, 1);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform2f(uImg, POSTER_W, POSTER_H);
        gl.uniform2f(uMouse, state.mouse[0], state.mouse[1]);
        gl.uniform1f(uProgress, state.progress);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };

      // Size cache — clientWidth/Height read only on init/resize.
      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(canvas.clientWidth * dpr);
        canvas.height = Math.floor(canvas.clientHeight * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
        draw();
      };
      window.addEventListener("resize", resize);

      /* --- transitions ---------------------------------------------- */
      // contextSafe: the tween is created from event/timer callbacks after
      // the useGSAP scope has run, so register it for cleanup on unmount.
      const advance = contextSafe!((mx: number, my: number) => {
        if (state.animating || state.contextLost) return;
        const nextIndex = (state.i + 1) % POSTER_COUNT;

        if (reduce) {
          // Hard cut: no ripple, information identical.
          state.i = nextIndex;
          state.progress = 1;
          upload(texA, posters[nextIndex]);
          upload(texB, posters[nextIndex]);
          setIndex(nextIndex);
          draw();
          return;
        }

        state.animating = true;
        upload(texB, posters[nextIndex]);
        state.mouse = [mx, my];
        state.progress = 0;
        setIndex(nextIndex);

        // onUpdate IS the render loop: gsap ticks on rAF, so this renders
        // exactly one frame per tick and zero frames while idle.
        gsap.to(state, {
          progress: 1,
          duration: TRANSITION_S,
          ease: "power2.inOut",
          onUpdate: draw,
          onComplete: () => {
            upload(texA, posters[nextIndex]);
            state.i = nextIndex;
            state.animating = false;
            draw();
          },
        });
      });
      advanceRef.current = advance;

      /* --- auto-advance, gated by viewport visibility ---------------- */
      let timer = 0;
      const stopTimer = () => {
        if (timer) window.clearInterval(timer);
        timer = 0;
      };
      const startTimer = () => {
        if (reduce || timer || state.contextLost) return;
        timer = window.setInterval(() => {
          // Drift the origin a little so the auto ripple isn't robotic.
          advance(0.35 + Math.random() * 0.3, 0.35 + Math.random() * 0.3);
        }, AUTO_ADVANCE_MS);
      };
      const io = new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting) startTimer();
        else stopTimer();
      });
      io.observe(root);

      /* --- context loss: swap in the static 2D fallback -------------- */
      const onLost = (e: Event) => {
        e.preventDefault();
        state.contextLost = true;
        stopTimer();
        showFallback(state.i);
      };
      canvas.addEventListener("webglcontextlost", onLost);

      /* --- first frame ------------------------------------------------ */
      upload(texA, posters[0]);
      upload(texB, posters[0]);
      resize();

      return () => {
        stopTimer();
        io.disconnect();
        window.removeEventListener("resize", resize);
        canvas.removeEventListener("webglcontextlost", onLost);
        advanceRef.current = () => {};
        if (!gl.isContextLost()) {
          gl.deleteTexture(texA);
          gl.deleteTexture(texB);
          gl.deleteBuffer(buf);
          gl.deleteProgram(prog);
          gl.deleteShader(vs);
          gl.deleteShader(fs);
        }
      };
    },
    { scope: rootRef }
  );

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // One rect read per click — never per frame.
    const r = e.currentTarget.getBoundingClientRect();
    advanceRef.current(
      (e.clientX - r.left) / r.width,
      1 - (e.clientY - r.top) / r.height
    );
  };

  return (
    <div className="mx-auto mb-16 w-full max-w-md">
      <div
        ref={rootRef}
        role="button"
        tabIndex={0}
        aria-label={kicker}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            advanceRef.current(0.5, 0.5);
          }
        }}
        className="glass relative aspect-[7/9] w-full cursor-pointer touch-manipulation select-none overflow-hidden rounded-lg"
        style={{
          // Faint marquee glow around the case — themed via tokens.
          boxShadow:
            "0 0 44px color-mix(in srgb, var(--gold) 14%, transparent), 0 0 12px color-mix(in srgb, var(--neon-red) 8%, transparent)",
        }}
      >
        <canvas
          ref={glCanvasRef}
          className={"absolute inset-0 h-full w-full" + (lost ? " hidden" : "")}
          aria-hidden="true"
        />
        {/* Static 2D fallback shown if WebGL is unavailable or the context is lost. */}
        <canvas
          ref={fallbackRef}
          className={
            "absolute inset-0 h-full w-full object-cover" +
            (lost ? "" : " hidden")
          }
          aria-hidden="true"
        />
        {/* Caption sits on the poster, which is always dark — fixed light ink
            over a soft scrim so it stays readable on bright colour fields. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-4 pb-3 pt-10"
          style={{
            background:
              "linear-gradient(to top, rgba(8, 9, 18, 0.72), transparent)",
          }}
        >
          <p
            className="font-mono text-[11px] tracking-[0.18em]"
            style={{ color: "rgba(245, 239, 226, 0.78)" }}
          >
            {kicker}
          </p>
          <p
            className="font-mono text-[11px] tracking-[0.18em] tabular-nums"
            style={{ color: "rgba(245, 239, 226, 0.78)" }}
          >
            {String(index + 1).padStart(2, "0")} /{" "}
            {String(POSTER_COUNT).padStart(2, "0")}
          </p>
        </div>
      </div>
    </div>
  );
}
