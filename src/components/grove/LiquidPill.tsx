"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { gsap } from "@/lib/gsap";
import {
  VERT, FRAG_SCENE, FRAG_RIM, FRAG_DOWN, FRAG_BLUR, FRAG_COMP,
  FIELD, FIELD_ORDER, RIM, RIM_ORDER, COMPOSITE, DISTURB, RIPPLE_LIFE, RIPPLE_SLOTS,
} from "@/lib/grove/liquidMetal";

/**
 * How much of the pipeline is switched on.
 *
 * The hero runs it at full; the lab study scrubs these with the scrollbar so
 * you can watch the metal being poured one pass at a time. Held in a mutable
 * object rather than in state on purpose — it is read inside the render loop
 * up to 120 times a second, and a re-render per frame is not a price worth
 * paying to describe a number that only the GPU ever sees.
 */
export type LiquidMix = {
  /** how far the travelling rim is lit */
  rim: number;
  /** blur on the metal, in button heights — the "molten" knob */
  soften: number;
  /** outer-glow gain */
  glow: number;
  /** contrast curve on the softened metal; 1 is off */
  punch: number;
  /** the metal's floor brightness with nobody touching it */
  base: number;
};

export const FULL_MIX: LiquidMix = {
  rim: 1,
  soften: COMPOSITE.soften,
  glow: COMPOSITE.glow,
  punch: COMPOSITE.punch,
  base: 0.82,
};

type Props = {
  children: ReactNode;
  /** Button height in CSS pixels, as a CSS length. Everything else follows it. */
  height: string;
  className?: string;
  label?: string;
  href?: string;
  /**
   * How much bloom pad to leave around the button, in button heights. The
   * canvas IS the pad, so this has to clear the halo's full reach or it is cut
   * off against a visible rectangle.
   */
  pad?: number;
  /** Live pipeline settings. Mutate through the ref to scrub it. */
  mixRef?: RefObject<LiquidMix>;
  /**
   * The metal's floor brightness with nobody touching it.
   *
   * Zero on a page where the control is one element among many: it rests as
   * dark glass and pours only under the pointer, which is what keeps it from
   * competing with the headline for the eye. The lab study lights it at rest
   * instead, because there the control IS the subject.
   */
  base?: number;
  /** Fired on press, with the pointer's page coordinates. */
  onPress?: (clientX: number, clientY: number) => void;
};

/** Keep the bloom buffer about this tall, whatever size the button renders at. */
const GLOW_TEX = 129;

type Target = { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number };

/**
 * A control with no gradient, no texture and no image behind it.
 *
 * A scalar field is painted through a soft plateau, sampled once per
 * wavelength at a slightly different height in the field, so every ribbon's
 * lower edge fringes warm and its upper edge fringes cool. Five passes turn
 * that into metal: the field, the travelling rim (kept out of the blur so the
 * outline stays thin), a softening blur, a four-radius bloom, and a composite
 * that puts the contrast back.
 *
 * The clock only turns while the control is engaged or still settling, so one
 * nobody is touching parks on its last frame. The page this came from runs its
 * rim travelling for ever; two of these over a live hero measured at half the
 * frame rate of the same page without them.
 */
export function LiquidPill({ children, height, className, label, href, pad = 1.744, mixRef, base, onPress }: Props) {
  const padRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const btnRef = useRef<HTMLElement>(null);
  const fallbackMix = useRef<LiquidMix>({ ...FULL_MIX, base: base ?? FULL_MIX.base });

  useEffect(() => {
    const canvas = canvasRef.current;
    const padEl = padRef.current;
    const btn = btnRef.current;
    if (!canvas || !padEl || !btn) return;

    const gl = canvas.getContext("webgl2", {
      alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "high-performance",
    });
    if (!gl) return;

    let disposed = false;
    fallbackMix.current.base = base ?? FULL_MIX.base;
    const mix = () => mixRef?.current ?? fallbackMix.current;

    const shaders: WebGLShader[] = [];
    const programs: WebGLProgram[] = [];
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
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
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
      programs.push(p);
      const u: Record<string, WebGLUniformLocation | null> = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i)!;
        // An array uniform reports as "uP[0]"; element zero's location is what
        // uniform1fv wants, so the suffix is dropped from the key.
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
      return;
    }

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Half-float where it is available: the metal runs well past 1 before the
    // composite tone-maps it, and an 8-bit chain clips the highlights the bloom
    // is supposed to be fed by.
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

    const T_core = makeTarget(), T_rim = makeTarget();
    const T_s1 = makeTarget(), T_s2 = makeTarget();
    const T_a = makeTarget(), T_b = makeTarget();

    let W = 0, H = 0, BW = 0, BH = 0, CX = 0, CY = 0, DOWN = 4;
    let needResize = true;
    let dirty = true;

    const resize = () => {
      const r = padEl.getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      if (!r.width || !br.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(2, Math.round(r.width * dpr));
      const h = Math.max(2, Math.round(r.height * dpr));
      if (w !== W || h !== H) { W = w; H = h; canvas.width = W; canvas.height = H; }
      BW = br.width * dpr;
      BH = br.height * dpr;
      CX = (br.left - r.left) * dpr + BW / 2;
      CY = H - ((br.top - r.top) * dpr + BH / 2); // gl_FragCoord is y-up
      sizeTarget(T_core, W, H);
      sizeTarget(T_rim, W, H);
      const hw = Math.max(2, Math.ceil(W / 2)), hh = Math.max(2, Math.ceil(H / 2));
      sizeTarget(T_s1, hw, hh);
      sizeTarget(T_s2, hw, hh);
      DOWN = Math.max(1, Math.min(4, Math.round(BH / GLOW_TEX)));
      const dw = Math.max(2, Math.ceil(W / DOWN)), dh = Math.max(2, Math.ceil(H / DOWN));
      sizeTarget(T_a, dw, dh);
      sizeTarget(T_b, dw, dh);
      needResize = false;
      dirty = true;
    };
    const ro = new ResizeObserver(() => { needResize = true; dirty = true; });
    ro.observe(padEl);

    const drawTo = (t: Target | null) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null);
      gl.viewport(0, 0, t ? t.w : W, t ? t.h : H);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const fieldArr = new Float32Array(FIELD_ORDER.length);
    for (let i = 0; i < FIELD_ORDER.length; i++) fieldArr[i] = FIELD[FIELD_ORDER[i]];
    const rimArr = new Float32Array(RIM_ORDER.length);
    for (let i = 0; i < RIM_ORDER.length; i++) rimArr[i] = RIM[RIM_ORDER[i]];

    const slots = Array.from({ length: RIPPLE_SLOTS }, () => ({ x: 0, y: 0, t: -99, on: 0 }));
    const slotArr = new Float32Array(RIPPLE_SLOTS * 4);
    let slotNext = 0;
    let clock = 0, hover = 0, hoverTarget = 0, press = 0, pressTarget = 0;
    const ptr = { x: 0, y: 0 }, ptrS = { x: 0, y: 0 };
    let ptrAmt = 0, ptrSpeed = 0, lastMove = 0;
    const on = { over: false, press: false, focus: false };
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");

    const addRipple = (x: number, y: number) => {
      const r = slots[slotNext];
      slotNext = (slotNext + 1) % slots.length;
      r.x = x; r.y = y; r.t = clock; r.on = 1;
    };
    /**
     * Pointer position in button-height units from the pill centre, +y down.
     * Written into a target rather than returned as a pair: destructuring a
     * returned tuple onto object properties is legal JavaScript that the
     * production compiler rejects, and only there — dev gives no warning.
     */
    const readPt = (e: PointerEvent, out: { x: number; y: number }) => {
      const b = btn.getBoundingClientRect();
      out.x = (e.clientX - (b.left + b.width / 2)) / b.height;
      out.y = (e.clientY - (b.top + b.height / 2)) / b.height;
    };
    const sync = () => {
      hoverTarget = on.over || on.press || on.focus ? 1 : 0;
      pressTarget = on.press ? 1 : 0;
      padEl.dataset.hot = hoverTarget > 0.5 ? "" : undefined;
      padEl.dataset.press = on.press ? "" : undefined;
      lastMove = clock;
      dirty = true;
    };

    const render = () => {
      if (needResize) resize();
      if (!W || !H) return;
      const m = mix();
      const bw = Math.max(1.5, 3.2 * (BH / 516));
      for (let i = 0; i < slots.length; i++) {
        const r = slots[i];
        if (r.on && clock - r.t > RIPPLE_LIFE) r.on = 0;
        slotArr[i * 4] = r.x; slotArr[i * 4 + 1] = r.y;
        slotArr[i * 4 + 2] = r.t; slotArr[i * 4 + 3] = r.on;
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

      gl.useProgram(pScene.p);
      setShared(pScene.u);
      gl.uniform1f(pScene.u.uHover, Math.min(1, m.base + (1 - m.base) * hover));
      gl.uniform1fv(pScene.u.uP, fieldArr);
      drawTo(T_core);

      gl.useProgram(pRim.p);
      setShared(pRim.u);
      gl.uniform1f(pRim.u.uBw, bw);
      gl.uniform1fv(pRim.u.uE, rimArr);
      drawTo(T_rim);

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
      // One very wide 9-tap pass leaves comb ghosts — the taps end up further
      // apart than the sigma they describe — so it is split into passes whose
      // radii add in quadrature.
      const sigTex = m.soften * (BH * 0.5) * 0.95;
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
      gl.uniform1f(pComp.u.uGlowGain, m.glow);
      gl.uniform1f(pComp.u.uGlowIn, COMPOSITE.glowIn);
      gl.uniform1f(pComp.u.uOccl, COMPOSITE.occl);
      gl.uniform1f(pComp.u.uDim, FIELD.dim);
      gl.uniform1f(pComp.u.uPunch, m.punch);
      gl.uniform1f(pComp.u.uRimGain, m.rim);
      drawTo(null);
    };

    /* ---- interaction ---- */
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      readPt(e, ptr);
      ptrS.x = ptr.x; ptrS.y = ptr.y; ptrSpeed = 0;
      on.over = true;
      sync();
    };
    const onLeave = (e: PointerEvent) => { if (e.pointerType === "mouse") { on.over = false; sync(); } };
    const onMove = (e: PointerEvent) => {
      if (!on.over && !on.press) return;
      readPt(e, ptr);
      lastMove = clock;
      dirty = true;
    };
    const onDown = (e: PointerEvent) => {
      readPt(e, ptr);
      on.press = true;
      sync();
      addRipple(ptr.x, ptr.y);
      onPress?.(e.clientX, e.clientY);
    };
    const onUp = () => { on.press = false; sync(); };
    const onFocus = () => { on.focus = btn.matches(":focus-visible"); sync(); };
    const onBlur = () => { on.focus = false; sync(); };
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
    const onVisibility = () => { visible = !document.hidden; dirty = true; };
    document.addEventListener("visibilitychange", onVisibility);

    /* The clock turns only while the control is engaged or still settling.
       Every easing snaps inside its own threshold rather than approaching one
       for ever, which is what gives the loop a last frame at all. */
    const tick = (_t: number, deltaMs: number) => {
      if (disposed || !visible) return;
      const dt = Math.min(deltaMs / 1000, 1 / 20);

      const hk = hoverTarget > hover ? 1 - Math.pow(0.0012, dt) : 1 - Math.pow(0.00012, dt);
      hover += (hoverTarget - hover) * hk;
      if (Math.abs(hoverTarget - hover) < 0.0008) hover = hoverTarget;

      const pk = pressTarget > press ? 1 - Math.pow(1e-9, dt) : 1 - Math.pow(0.004, dt);
      press += (pressTarget - press) * pk;
      if (Math.abs(pressTarget - press) < 0.002) press = pressTarget;

      const lag = 1 - Math.pow(DISTURB.ptrLag, dt);
      const dx = (ptr.x - ptrS.x) * lag, dy = (ptr.y - ptrS.y) * lag;
      ptrS.x += dx; ptrS.y += dy;
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
        hover !== hoverTarget || press !== pressTarget || ptrAmt !== wantWell ||
        ptrS.x !== ptr.x || ptrS.y !== ptr.y;

      if (engaged || ripLive || settling || clock - lastMove < 0.25) {
        if (!calm.matches) clock += dt;
        dirty = true;
      }
      if (!dirty) return;
      dirty = false;
      render();
    };

    resize();
    render();
    gsap.ticker.add(tick);

    return () => {
      disposed = true;
      gsap.ticker.remove(tick);
      ro.disconnect();
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
      for (const t of targets) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); }
      for (const p of programs) gl.deleteProgram(p);
      for (const s of shaders) gl.deleteShader(s);
      gl.deleteBuffer(vbo);
      gl.deleteVertexArray(vao);
      // Deliberately NOT loseContext(). A canvas hands back the same context
      // object every time it is asked, and a lost one stays lost — so under
      // StrictMode's mount/unmount/mount the second pass would pick up a dead
      // context and render nothing, in development only.
    };
  }, [mixRef, onPress, base]);

  const style = { "--lp-h": height, "--lp-pad": `calc(${pad} * var(--lp-h))` } as React.CSSProperties;
  const inner = (
    <>
      <span className="lp-plate" aria-hidden="true" />
      <canvas ref={canvasRef} className="lp-canvas" aria-hidden="true" />
    </>
  );

  return (
    <span ref={padRef} className={`lp-pad${className ? ` ${className}` : ""}`} style={style}>
      {inner}
      {href ? (
        <a ref={btnRef as RefObject<HTMLAnchorElement>} className="lp-btn" href={href} aria-label={label}>
          {children}
        </a>
      ) : (
        <button ref={btnRef as RefObject<HTMLButtonElement>} className="lp-btn" type="button" aria-label={label}>
          {children}
        </button>
      )}
    </span>
  );
}
