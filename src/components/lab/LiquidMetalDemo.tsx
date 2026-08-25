"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";
import { prefersSaveData } from "@/lib/three/guards";
import {
  VERT,
  FRAG_SCENE,
  FRAG_RIM,
  FRAG_DOWN,
  FRAG_BLUR,
  FRAG_COMP,
  FIELD,
  FIELD_ORDER,
  RIM,
  RIM_ORDER,
  COMPOSITE,
  DISTURB,
  RIPPLE_LIFE,
  RIPPLE_SLOTS,
} from "@/lib/grove/liquidMetal";

type Props = {
  accent: string;
  hint: string;
  headline: string;
  body: string;
  tail: string;
  fallbackNote: string;
  /** The button's own label — it is the subject of the study. */
  label: string;
  stageField: string;
  stageMolten: string;
  stageBloom: string;
};

/** Keep the bloom buffer about this tall, whatever size the button renders at. */
const GLOW_TEX = 129;

type Target = { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number };

/**
 * A button with no gradient, no texture and no image behind it.
 *
 * Raw WebGL2 rather than three, deliberately: every pass here is a full-screen
 * triangle into a framebuffer, which is the one job three's scene graph adds
 * nothing to — and this way the study carries its own context and its own
 * state instead of borrowing the renderer the rest of the lab uses.
 *
 * The scrollbar walks the pipeline. Act one is the bare dispersion field,
 * razor-etched; act two pours the softening blur over it and lights the
 * travelling rim; act three adds the bloom and the contrast curve that turn it
 * back into metal. The button stays live the whole way down — hover it, hold
 * it, tab to it — because a study of a control that cannot be operated is a
 * picture of one.
 *
 * The clock only turns while the button is engaged or still settling, so a
 * study nobody is touching parks on its last frame (DESIGN.md §5.3). The page
 * this came from runs its rim travelling for ever; two of them over a live
 * hero measured at half the frame rate of the page without them.
 */
export function LiquidMetalDemo({
  accent,
  hint,
  headline,
  body,
  tail,
  fallbackNote,
  label,
  stageField,
  stageMolten,
  stageBloom,
}: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLParagraphElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  /** 0 → 1 across the whole study. Read by the render loop. */
  const phase = useRef({ value: 0 });
  const dirtyRef = useRef(true);
  const applyRef = useRef<((p: number) => void) | null>(null);

  const [live, setLive] = useState(false);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const pad = padRef.current;
    const btn = buttonRef.current;
    if (!canvas || !pad || !btn) return;

    if (prefersSaveData()) {
      setDegraded(true);
      return;
    }

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
    if (!gl) {
      setDegraded(true);
      return;
    }

    let disposed = false;

    /* ---- programs ---- */
    const shaders: WebGLShader[] = [];
    const programs: WebGLProgram[] = [];

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(s) ?? "shader failed to compile");
      }
      shaders.push(s);
      return s;
    };

    type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };
    const build = (frag: string): Prog => {
      const p = gl.createProgram()!;
      gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
      gl.bindAttribLocation(p, 0, "position");
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(p) ?? "program failed to link");
      }
      programs.push(p);
      const u: Record<string, WebGLUniformLocation | null> = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i)!;
        // An array uniform reports as "uP[0]"; the location of element zero is
        // what uniform1fv wants, so the suffix is dropped from the key.
        u[info.name.replace("[0]", "")] = gl.getUniformLocation(p, info.name);
      }
      return { p, u };
    };

    let pScene: Prog, pRim: Prog, pDown: Prog, pBlur: Prog, pComp: Prog;
    try {
      pScene = build(FRAG_SCENE);
      pRim = build(FRAG_RIM);
      pDown = build(FRAG_DOWN);
      pBlur = build(FRAG_BLUR);
      pComp = build(FRAG_COMP);
    } catch {
      setDegraded(true);
      return;
    }

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    /* ---- render targets ---- */
    // Half-float where it is available: the metal runs well past 1 before the
    // composite tone-maps it, and an 8-bit chain clips the highlights that the
    // bloom is supposed to be fed by.
    const hasFloat = !!gl.getExtension("EXT_color_buffer_half_float");
    const targets: Target[] = [];

    const makeTarget = (): Target => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const t = { tex, fbo, w: 0, h: 0 };
      targets.push(t);
      return t;
    };
    const sizeTarget = (t: Target, w: number, h: number) => {
      if (t.w === w && t.h === h) return;
      t.w = w;
      t.h = h;
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      if (hasFloat) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    };

    const T_core = makeTarget();
    const T_rim = makeTarget();
    const T_s1 = makeTarget();
    const T_s2 = makeTarget();
    const T_a = makeTarget();
    const T_b = makeTarget();

    let W = 0;
    let H = 0;
    let BW = 0;
    let BH = 0;
    let CX = 0;
    let CY = 0;
    let DOWN = 4;
    let needResize = true;

    const resize = () => {
      const r = pad.getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      if (!r.width || !br.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(2, Math.round(r.width * dpr));
      const h = Math.max(2, Math.round(r.height * dpr));
      if (w !== W || h !== H) {
        W = w;
        H = h;
        canvas.width = W;
        canvas.height = H;
      }
      BW = br.width * dpr;
      BH = br.height * dpr;
      CX = (br.left - r.left) * dpr + BW / 2;
      CY = H - ((br.top - r.top) * dpr + BH / 2); // gl_FragCoord is y-up
      sizeTarget(T_core, W, H);
      sizeTarget(T_rim, W, H);
      const hw = Math.max(2, Math.ceil(W / 2));
      const hh = Math.max(2, Math.ceil(H / 2));
      sizeTarget(T_s1, hw, hh);
      sizeTarget(T_s2, hw, hh);
      // The bloom buffer is downsampled to keep the button about GLOW_TEX
      // texels tall at any size, so one set of blur radii gives a glow of the
      // same RELATIVE extent whether this renders small or as a hero.
      DOWN = Math.max(1, Math.min(4, Math.round(BH / GLOW_TEX)));
      sizeTarget(T_a, Math.max(2, Math.ceil(W / DOWN)), Math.max(2, Math.ceil(H / DOWN)));
      sizeTarget(T_b, Math.max(2, Math.ceil(W / DOWN)), Math.max(2, Math.ceil(H / DOWN)));
      needResize = false;
      dirtyRef.current = true;
    };

    const ro = new ResizeObserver(() => {
      needResize = true;
      dirtyRef.current = true;
    });
    ro.observe(pad);

    const drawTo = (t: Target | null) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null);
      gl.viewport(0, 0, t ? t.w : W, t ? t.h : H);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    /* ---- state ---- */
    const fieldArr = new Float32Array(FIELD_ORDER.length);
    for (let i = 0; i < FIELD_ORDER.length; i++) fieldArr[i] = FIELD[FIELD_ORDER[i]];
    const rimArr = new Float32Array(RIM_ORDER.length);
    for (let i = 0; i < RIM_ORDER.length; i++) rimArr[i] = RIM[RIM_ORDER[i]];

    const slots = Array.from({ length: RIPPLE_SLOTS }, () => ({ x: 0, y: 0, t: -99, on: 0 }));
    const slotArr = new Float32Array(RIPPLE_SLOTS * 4);
    let slotNext = 0;

    let clock = 0;
    let hover = 0;
    let hoverTarget = 0;
    let press = 0;
    let pressTarget = 0;
    const ptr = { x: 0, y: 0 };
    const ptrS = { x: 0, y: 0 };
    let ptrAmt = 0;
    let ptrSpeed = 0;
    const on = { over: false, press: false, focus: false };

    /** Scrubbed by the scrollbar: which passes are in play, and how far. */
    /* base is the metal's floor brightness with nobody touching it.
       High, and deliberately so: the reference only draws its metal on hover,
       because there the button is a control on a page. Here it is the subject
       of the study, so it has to be lit at rest — and it has to be lit HARD,
       because the composite's contrast curve is a power, and a power below 1
       crushes rather than lifts. At the reference's own gain the highlights
       run past 1 into the half-float buffer and punch does what it says; at
       half that they all sit under 1 and act three comes out darker than
       act one. */
    const mix = { rim: 0, soften: 0, glow: 0, punch: 1, base: 0.82 };

    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");

    const addRipple = (x: number, y: number) => {
      const r = slots[slotNext];
      slotNext = (slotNext + 1) % slots.length;
      r.x = x;
      r.y = y;
      r.t = clock;
      r.on = 1;
    };

    /**
     * Pointer position in button-height units from the pill centre, +y down.
     *
     * Written into a target rather than returned as a pair: destructuring a
     * returned tuple straight onto object properties is legal JavaScript that
     * the production compiler rejects, and it does so only in the production
     * build, so dev is no warning at all.
     */
    const readPt = (e: PointerEvent, out: { x: number; y: number }) => {
      const b = btn.getBoundingClientRect();
      out.x = (e.clientX - (b.left + b.width / 2)) / b.height;
      out.y = (e.clientY - (b.top + b.height / 2)) / b.height;
    };

    const sync = () => {
      hoverTarget = on.over || on.press || on.focus ? 1 : 0;
      pressTarget = on.press ? 1 : 0;
      pad.dataset.hot = hoverTarget > 0.5 ? "" : undefined;
      pad.dataset.press = on.press ? "" : undefined;
      dirtyRef.current = true;
    };

    /* ---- the pipeline ---- */
    const render = () => {
      if (needResize) resize();
      if (!W || !H) return;

      const bw = Math.max(1.5, 3.2 * (BH / 516)); // stroke half-width, device px
      for (let i = 0; i < slots.length; i++) {
        const r = slots[i];
        if (r.on && clock - r.t > RIPPLE_LIFE) r.on = 0;
        slotArr[i * 4] = r.x;
        slotArr[i * 4 + 1] = r.y;
        slotArr[i * 4 + 2] = r.t;
        slotArr[i * 4 + 3] = r.on;
      }

      const setShared = (u: Prog["u"]) => {
        gl.uniform2f(u.uC, CX, CY);
        gl.uniform2f(u.uHalf, BW / 2, BH / 2);
        gl.uniform1f(u.uT, clock);
        gl.uniform1f(u.uPress, press);
        gl.uniform4fv(u.uRip, slotArr);
        gl.uniform4f(u.uRipK, DISTURB.speed, DISTURB.width, DISTURB.decay, DISTURB.amp);
        gl.uniform4f(u.uRipK2, DISTURB.facet, DISTURB.lobes, DISTURB.sharp, DISTURB.emit);
        gl.uniform4f(u.uPtr, ptrS.x, ptrS.y, ptrAmt, ptrSpeed);
        gl.uniform4f(u.uPtrK, DISTURB.ptrRad, DISTURB.ptrAmp, DISTURB.ptrFast, DISTURB.ptrRim);
      };

      // 1. the metal field, masked to the pill
      gl.useProgram(pScene.p);
      setShared(pScene.u);
      gl.uniform1f(pScene.u.uHover, Math.min(1, mix.base + (1 - mix.base) * hover));
      gl.uniform1fv(pScene.u.uP, fieldArr);
      drawTo(T_core);

      // 2. the rim, kept out of the softening blur so the outline stays thin
      gl.useProgram(pRim.p);
      setShared(pRim.u);
      gl.uniform1f(pRim.u.uBw, bw);
      gl.uniform1fv(pRim.u.uE, rimArr);
      drawTo(T_rim);

      // 3. soften the metal — half-res box down, then a separable gaussian.
      //    This is what turns the prismatic ribbons molten rather than etched.
      gl.useProgram(pDown.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, T_core.tex);
      gl.uniform1i(pDown.u.uTex, 0);
      gl.uniform1f(pDown.u.uAdd, 0);
      gl.uniform2f(pDown.u.uDstTexel, 1 / T_s1.w, 1 / T_s1.h);
      gl.uniform2f(pDown.u.uSrcTexel, 1 / W, 1 / H);
      drawTo(T_s1);

      gl.useProgram(pBlur.p);
      gl.uniform1i(pBlur.u.uTex, 0);
      gl.uniform2f(pBlur.u.uTexel, 1 / T_s1.w, 1 / T_s1.h);
      // Target sigma in half-res texels, tied to the button so it scales with
      // any size. One very wide 9-tap pass leaves visible comb ghosts — the
      // taps end up further apart than the sigma they describe — so it is
      // split into passes whose radii add in quadrature.
      const sigTex = mix.soften * (BH * 0.5) * 0.95;
      if (sigTex > 0.1) {
        const iters = Math.min(4, Math.max(1, Math.ceil(sigTex / 3)));
        gl.uniform1f(pBlur.u.uR, sigTex / Math.sqrt(iters) / 1.95);
        for (let i = 0; i < iters; i++) {
          gl.bindTexture(gl.TEXTURE_2D, T_s1.tex);
          gl.uniform2f(pBlur.u.uDir, 1, 0);
          drawTo(T_s2);
          gl.bindTexture(gl.TEXTURE_2D, T_s2.tex);
          gl.uniform2f(pBlur.u.uDir, 0, 1);
          drawTo(T_s1);
        }
      }

      // 4. bloom, fed by the softened metal plus the crisp rim
      gl.useProgram(pDown.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, T_s1.tex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, T_rim.tex);
      gl.uniform1i(pDown.u.uTex, 0);
      gl.uniform1i(pDown.u.uTex2, 1);
      gl.uniform1f(pDown.u.uAdd, 1);
      gl.uniform2f(pDown.u.uDstTexel, 1 / T_a.w, 1 / T_a.h);
      gl.uniform2f(pDown.u.uSrcTexel, 1 / T_s1.w, 1 / T_s1.h);
      drawTo(T_a);

      gl.useProgram(pBlur.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(pBlur.u.uTex, 0);
      gl.uniform2f(pBlur.u.uTexel, 1 / T_a.w, 1 / T_a.h);
      const rs = (COMPOSITE.glowR * (BH / DOWN)) / GLOW_TEX;
      for (const r of [1, 2.3, 5.2, 9]) {
        gl.uniform1f(pBlur.u.uR, r * rs);
        gl.bindTexture(gl.TEXTURE_2D, T_a.tex);
        gl.uniform2f(pBlur.u.uDir, 1, 0);
        drawTo(T_b);
        gl.bindTexture(gl.TEXTURE_2D, T_b.tex);
        gl.uniform2f(pBlur.u.uDir, 0, 1);
        drawTo(T_a);
      }

      // 5. composite
      gl.useProgram(pComp.p);
      setShared(pComp.u);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, T_s1.tex);
      gl.uniform1i(pComp.u.uSoft, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, T_rim.tex);
      gl.uniform1i(pComp.u.uRim, 1);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, T_a.tex);
      gl.uniform1i(pComp.u.uGlow, 2);
      gl.uniform2f(pComp.u.uRes, W, H);
      gl.uniform1f(pComp.u.uGlowGain, mix.glow);
      gl.uniform1f(pComp.u.uGlowIn, COMPOSITE.glowIn);
      gl.uniform1f(pComp.u.uOccl, COMPOSITE.occl);
      gl.uniform1f(pComp.u.uDim, FIELD.dim);
      gl.uniform1f(pComp.u.uPunch, mix.punch);
      gl.uniform1f(pComp.u.uRimGain, mix.rim);
      drawTo(null);
    };

    /* ---- the scroll scrubs the pipeline itself ---- */
    const smoothstep = (x: number, a: number, b: number) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };

    const apply = (p: number) => {
      const c = Math.min(Math.max(p, 0), 1);
      // Act one is the bare field: no rim, no blur, no bloom, so the etched
      // dispersion is on show before anything softens it. Act two pours the
      // blur over it and lights the outline. Act three adds the bloom and the
      // contrast curve that put the metal back.
      mix.rim = smoothstep(c, 0.3, 0.52);
      mix.soften = COMPOSITE.soften * smoothstep(c, 0.34, 0.62);
      mix.glow = COMPOSITE.glow * smoothstep(c, 0.6, 0.9);
      mix.punch = 1 + (COMPOSITE.punch - 1) * smoothstep(c, 0.6, 0.9);
      if (copyRef.current) {
        copyRef.current.style.opacity = (1 - smoothstep(c, 0.68, 0.88)).toFixed(3);
      }
    };
    applyRef.current = apply;
    apply(phase.current.value);

    /* ---- interaction ---- */
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      // Land the well where the cursor actually entered, not where it last was.
      readPt(e, ptr);
      ptrS.x = ptr.x;
      ptrS.y = ptr.y;
      ptrSpeed = 0;
      on.over = true;
      sync();
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      on.over = false;
      sync();
    };
    // Tracked on the window so a press can slide off the button, but only
    // measured while the button is actually engaged.
    const onMove = (e: PointerEvent) => {
      if (!on.over && !on.press) return;
      readPt(e, ptr);
      dirtyRef.current = true;
    };
    const onDown = (e: PointerEvent) => {
      readPt(e, ptr);
      on.press = true;
      sync();
      addRipple(ptr.x, ptr.y);
    };
    const onUp = () => {
      on.press = false;
      sync();
    };
    // Only keyboard focus keeps it lit — a mouse click should not leave the
    // button glowing after the pointer has moved away.
    const onFocus = () => {
      on.focus = btn.matches(":focus-visible");
      sync();
    };
    const onBlur = () => {
      on.focus = false;
      sync();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key !== "Enter" && e.key !== " ") || e.repeat) return;
      on.press = true;
      sync();
      addRipple(0, 0);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      on.press = false;
      sync();
    };

    btn.addEventListener("pointerenter", onEnter);
    btn.addEventListener("pointerleave", onLeave);
    btn.addEventListener("pointerdown", onDown);
    btn.addEventListener("focus", onFocus);
    btn.addEventListener("blur", onBlur);
    btn.addEventListener("keydown", onKeyDown);
    btn.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    let visible = !document.hidden;
    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) dirtyRef.current = true;
    };
    document.addEventListener("visibilitychange", onVisibility);

    /* ---- the loop ----
       The clock turns only while the button is engaged or still settling, so a
       study nobody is touching parks on its last frame. Every easing below
       snaps inside its own threshold rather than approaching one for ever,
       which is what gives the loop a last frame at all. */
    const tick = (_time: number, deltaMs: number) => {
      if (disposed || !visible) return;
      const dt = Math.min(deltaMs / 1000, 1 / 20);

      // asymmetric ease: quick to bloom, a touch quicker to die
      const hk = hoverTarget > hover ? 1 - Math.pow(0.0012, dt) : 1 - Math.pow(0.00012, dt);
      hover += (hoverTarget - hover) * hk;
      if (Math.abs(hoverTarget - hover) < 0.0008) hover = hoverTarget;

      // press snaps on and lets go slowly
      const pk = pressTarget > press ? 1 - Math.pow(1e-9, dt) : 1 - Math.pow(0.004, dt);
      press += (pressTarget - press) * pk;
      if (Math.abs(pressTarget - press) < 0.002) press = pressTarget;

      // the well trails the cursor and swells with how fast it is being dragged
      const lag = 1 - Math.pow(DISTURB.ptrLag, dt);
      const dx = (ptr.x - ptrS.x) * lag;
      const dy = (ptr.y - ptrS.y) * lag;
      ptrS.x += dx;
      ptrS.y += dy;
      if (Math.abs(ptr.x - ptrS.x) < 1e-4) ptrS.x = ptr.x;
      if (Math.abs(ptr.y - ptrS.y) < 1e-4) ptrS.y = ptr.y;
      const inst = Math.min(Math.hypot(dx, dy) / Math.max(dt, 1e-3) / DISTURB.ptrVref, 1);
      ptrSpeed += (inst - ptrSpeed) * (1 - Math.pow(inst > ptrSpeed ? 0.001 : 0.02, dt));
      if (Math.abs(inst - ptrSpeed) < 1e-3) ptrSpeed = inst;
      const wantWell = on.over || on.press ? 1 : 0;
      ptrAmt += (wantWell - ptrAmt) * (1 - Math.pow(0.004, dt));
      if (Math.abs(wantWell - ptrAmt) < 0.002) ptrAmt = wantWell;

      const ripLive = slots.some((r) => r.on === 1 && clock - r.t <= RIPPLE_LIFE);
      const engaged = on.over || on.press || on.focus;
      const settling =
        hover !== hoverTarget ||
        press !== pressTarget ||
        ptrAmt !== wantWell ||
        ptrS.x !== ptr.x ||
        ptrS.y !== ptr.y;

      if (engaged || ripLive || settling) {
        if (!calm.matches) clock += dt;
        dirtyRef.current = true;
      }

      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      render();
    };

    resize();
    render();
    gsap.ticker.add(tick);
    setLive(true);
    ScrollTrigger.refresh();

    return () => {
      disposed = true;
      gsap.ticker.remove(tick);
      ro.disconnect();
      applyRef.current = null;
      btn.removeEventListener("pointerenter", onEnter);
      btn.removeEventListener("pointerleave", onLeave);
      btn.removeEventListener("pointerdown", onDown);
      btn.removeEventListener("focus", onFocus);
      btn.removeEventListener("blur", onBlur);
      btn.removeEventListener("keydown", onKeyDown);
      btn.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const t of targets) {
        gl.deleteTexture(t.tex);
        gl.deleteFramebuffer(t.fbo);
      }
      for (const p of programs) gl.deleteProgram(p);
      for (const s of shaders) gl.deleteShader(s);
      gl.deleteBuffer(vbo);
      gl.deleteVertexArray(vao);
      // Deliberately NOT loseContext(). A canvas hands back the same context
      // object every time it is asked, and a lost one stays lost — so under
      // StrictMode's mount/unmount/mount the second pass would pick up a dead
      // context and the study would render nothing, in development only.
      // Deleting the resources is what actually frees them.
    };
  }, []);

  useGSAP(
    () => {
      const stage = stageRef.current;
      const sticky = stickyRef.current;
      if (!live || !stage || !sticky) return;

      const labels = [stageField, stageMolten, stageBloom];
      let shown = -1;

      const tween = gsap.to(phase.current, {
        value: 1,
        ease: "none",
        onUpdate: () => {
          applyRef.current?.(phase.current.value);
          dirtyRef.current = true;
          const act = phase.current.value < 0.34 ? 0 : phase.current.value < 0.66 ? 1 : 2;
          if (act !== shown && labelRef.current) {
            shown = act;
            labelRef.current.textContent = labels[act];
          }
        },
        scrollTrigger: {
          trigger: stage,
          start: "top top",
          end: "bottom bottom",
          pin: sticky,
          pinSpacing: false,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          scrub: 0.8,
        },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
    { scope, dependencies: [live], revertOnUpdate: true }
  );

  return (
    <div ref={scope} style={{ "--lm-accent": accent } as CSSProperties}>
      <style href="lab-liquid-metal" precedence="medium">
        {CSS}
      </style>

      <div ref={stageRef} className="lm-stage" data-degraded={degraded || undefined}>
        <div ref={stickyRef} className="lm-sticky">
          <div ref={padRef} className="lm-pad">
            <div className="lm-plate" aria-hidden="true" />
            <canvas ref={canvasRef} className="lm-canvas" data-degraded={degraded || undefined} aria-hidden="true" />
            <button ref={buttonRef} className="lm-btn" type="button">
              <svg className="lm-ico" viewBox="0 0 115 115" aria-hidden="true">
                <g stroke="currentColor" strokeWidth="11" strokeLinecap="round">
                  <path d="M14 34.5 H101" />
                  <path d="M14 57.5 H101" />
                  <path d="M14 80.5 H68" />
                </g>
              </svg>
              <span className="lm-lbl">{label}</span>
            </button>
          </div>

          <div ref={copyRef} className="lm-copy">
            <h2 className="lm-headline">{headline}</h2>
            <p className="lm-body">{body}</p>
            <p className="lm-tail">{tail}</p>
            {degraded && <p className="lm-note">{fallbackNote}</p>}
          </div>

          <p ref={labelRef} className="lm-act" aria-hidden="true">
            {stageField}
          </p>
          <p className="lm-hint" aria-hidden="true">
            {hint}
          </p>
        </div>
      </div>
    </div>
  );
}

const CSS = `
/* Three acts, one per pass added. */
.lm-stage { position: relative; height: 400vh; }
.lm-stage[data-degraded] { height: 100svh; }
.lm-sticky {
  position: relative;
  height: 100svh;
  overflow: hidden;
  border-block: 1px solid var(--line);
  /* A near-black ground, because the metal is additive light: on a pale field
     the dark half of every ribbon has nothing to be dark against. */
  background:
    radial-gradient(58% 46% at 50% 42%, rgba(150, 168, 196, 0.09) 0%, rgba(150, 168, 196, 0) 70%),
    #0b0d10;
}

/* Everything is expressed off one ergonomic knob: the button's height.
   Bounded by the viewport's WIDTH as well as its height: the pill shrink-wraps
   its label, so on a phone a height-only rule makes a pill wider than the
   screen. */
.lm-pad {
  --lm-h: clamp(40px, min(13vh, 15vw), 150px);
  --lm-u: calc(var(--lm-h) / 516);
  /* The canvas IS the pad, so this has to clear the bloom's full reach —
     about four sigma — or the halo is cut off against a visible rectangle. */
  padding: calc(900 * var(--lm-u));
  /* Centred by transform rather than by the grid it used to sit in: the bloom
     pad is far wider than the pill, and a grid centres an item that overflows
     its track by aligning it to the start — which put the button off the right
     of the screen on a phone. */
  position: absolute;
  left: 50%;
  top: 34%;
  transform: translate(-50%, -50%);
  width: max-content;
  height: max-content;
  display: grid;
  place-items: center;
  touch-action: manipulation;
}

.lm-plate {
  position: absolute;
  inset: calc(900 * var(--lm-u));
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.085), rgba(255, 255, 255, 0.014) 44%, rgba(255, 255, 255, 0) 64%),
    rgba(10, 12, 10, 0.42);
  box-shadow:
    0 calc(var(--lm-h) * 0.08) calc(var(--lm-h) * 0.18) rgba(0, 0, 0, 0.38),
    0 calc(var(--lm-h) * 0.24) calc(var(--lm-h) * 0.5) rgba(0, 0, 0, 0.28),
    0 calc(var(--lm-h) * 0.48) calc(var(--lm-h) * 0.96) rgba(0, 0, 0, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.13);
  transition: box-shadow 0.38s var(--ease-out, cubic-bezier(0.22, 0.61, 0.36, 1)),
              background 0.38s var(--ease-out, cubic-bezier(0.22, 0.61, 0.36, 1));
}
/* Deepen it while the metal is lit, so the bright face keeps its edge. */
.lm-pad[data-hot] .lm-plate {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.105), rgba(255, 255, 255, 0.02) 44%, rgba(255, 255, 255, 0) 64%),
    rgba(8, 10, 8, 0.5);
  box-shadow:
    0 calc(var(--lm-h) * 0.1) calc(var(--lm-h) * 0.22) rgba(0, 0, 0, 0.44),
    0 calc(var(--lm-h) * 0.32) calc(var(--lm-h) * 0.66) rgba(0, 0, 0, 0.34),
    0 calc(var(--lm-h) * 0.66) calc(var(--lm-h) * 1.32) rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.17);
}
/* Pressed: the button settles onto the surface, so the shadow tightens. */
.lm-pad[data-press] .lm-plate {
  box-shadow:
    0 calc(var(--lm-h) * 0.04) calc(var(--lm-h) * 0.11) rgba(0, 0, 0, 0.46),
    0 calc(var(--lm-h) * 0.13) calc(var(--lm-h) * 0.32) rgba(0, 0, 0, 0.36),
    0 calc(var(--lm-h) * 0.27) calc(var(--lm-h) * 0.62) rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transition-duration: 0.1s;
}

.lm-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.lm-canvas[data-degraded] { visibility: hidden; }

.lm-btn {
  position: relative;
  height: var(--lm-h);
  border: 0;
  background: none;
  padding: 0 calc(224 * var(--lm-u)) 0 calc(95 * var(--lm-u));
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(112 * var(--lm-u));
  color: #fff;
  font-family: inherit;
  font-weight: 500;
  font-size: calc(140 * var(--lm-u));
  line-height: 1;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  outline: none;
}
.lm-btn:focus-visible {
  outline: calc(4 * var(--lm-u)) solid rgba(255, 255, 255, 0.55);
  outline-offset: calc(10 * var(--lm-u));
}
.lm-ico { width: calc(150 * var(--lm-u)); height: calc(150 * var(--lm-u)); display: block; flex: none; }
/* Descenders pull the flex box up — nudge back so the cap box, not the em box,
   is what sits centred on the pill. */
.lm-lbl { display: block; transform: translateY(calc(2 * var(--lm-u))); }

.lm-copy {
  position: absolute;
  inset: auto 0 9vh;
  margin-inline: auto;
  max-width: min(34ch, 82vw);
  text-align: center;
  color: #e9ecf2;
  text-shadow: 0 2px 28px rgba(0, 0, 0, 0.65);
  pointer-events: none;
}
.lm-headline { margin: 0; font-size: clamp(1.7rem, 5vw, 3rem); font-weight: 600; letter-spacing: -0.02em; }
.lm-body { margin: 0.9rem 0 0; font-size: 0.9375rem; line-height: 1.7; opacity: 0.82; }
.lm-tail {
  margin: 1.1rem 0 0;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lm-accent);
  text-shadow: none;
}
.lm-note { margin: 1rem 0 0; font-size: 0.8125rem; line-height: 1.6; opacity: 0.66; }

.lm-act,
.lm-hint {
  position: absolute;
  bottom: clamp(1rem, 4vw, 2.5rem);
  margin: 0;
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  pointer-events: none;
}
.lm-act { left: clamp(1rem, 4vw, 2.5rem); color: var(--lm-accent); }
.lm-hint { right: clamp(1rem, 4vw, 2.5rem); color: rgba(233, 236, 242, 0.42); }
`;
