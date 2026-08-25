"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import * as THREE from "three";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";
import { hasWebGL, prefersSaveData } from "@/lib/three/guards";

type Props = {
  accent: string;
  hint: string;
  headline: string;
  body: string;
  tail: string;
  fallbackNote: string;
};

const IMAGE = "/lab/dissolve/forest.jpg";

const VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * The dissolve is a threshold sweeping across a scalar field, not a wipe:
 *
 *   field = y + fbm(low) + fbm(mid) + fbm(high)
 *
 * A vertical gradient decides the overall direction, low-frequency fbm bends
 * that straight line into moss-shaped clumps, and the higher octaves throw
 * isolated flecks out ahead of the front. Nothing is quantised to a grid, so
 * the edge stays an organic curve at any resolution.
 */
const FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform sampler2D uTex;
uniform vec2  uTexSize;
uniform vec2  uRes;
uniform float uProgress;   // 0 = image intact, 1 = fully turned to paper
uniform float uTime;
uniform float uNoiseScale; // clump size — smaller value, bigger clumps
uniform float uNoiseAmp;   // how far the front undulates
uniform float uSoft;       // extra edge softening (0 = razor silhouette)
uniform vec3  uPaper;

float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i),                hash21(i + vec2(1.0, 0.0)), u.x),
             mix(hash21(i + vec2(0.0,1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
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

vec2 coverUv(vec2 uv, vec2 imgSize){
  float ca = uRes.x / uRes.y;
  float ia = imgSize.x / imgSize.y;
  vec2 r = vec2(min(ca / ia, 1.0), min(ia / ca, 1.0));
  return (uv - 0.5) * r + 0.5;
}

void main(){
  vec2 uv = vUv;
  float ar = uRes.x / uRes.y;
  vec2 auv = vec2(uv.x * ar, uv.y);

  float lump   = fbm(auv * uNoiseScale + vec2(0.0, uTime * 0.012)) - 0.5;
  float detail = fbm(auv * 8.4 + 31.0) - 0.5;
  float speck  = fbm(auv * 21.0 + 7.0) - 0.5;

  float field = uv.y + lump * uNoiseAmp + detail * 0.155 + speck * 0.085;

  float t = mix(-0.35, 1.35, uProgress);

  // fwidth-based AA keeps the edge silhouette-sharp without stair-stepping.
  float aa = max(fwidth(field), 0.0018) * 1.15 + uSoft;
  float mask = smoothstep(t - aa, t + aa, field);   // 1 = still image

  vec3 paper = uPaper;
  float grain = fbm(auv * 7.5);
  paper *= 0.982 + grain * 0.034;

  // A faint tint just behind the front, as if the pigment has not dried.
  float behind = t - field;
  float haze = (1.0 - smoothstep(0.0, 0.26, behind)) * step(0.0, behind);
  haze *= 0.35 + fbm(auv * 2.4 + 11.0) * 0.8;
  paper = mix(paper, paper * vec3(0.80, 0.85, 0.76), clamp(haze, 0.0, 1.0) * 0.32);

  // The picture drifts up slightly as it goes, so the forest reads as leaving.
  vec2 iuv = coverUv(uv + vec2(0.0, uProgress * 0.05), uTexSize);
  vec3 img = texture2D(uTex, iuv).rgb;

  // Crush the photo into an ink-wash palette: push contrast, then remap the
  // whole ramp into greens so sky-blue and sunlight-yellow drop out.
  img = pow(img, vec3(1.75));
  float lum = dot(img, vec3(0.299, 0.587, 0.114));
  vec3 duo = vec3(0.048, 0.072, 0.052) + lum * vec3(0.30, 0.375, 0.265);
  img = mix(img * vec3(0.50, 0.66, 0.52), duo, 0.82);
  img = mix(img, vec3(dot(img, vec3(0.299, 0.587, 0.114))), 0.16);
  img += vec3(0.05, 0.062, 0.048) * smoothstep(0.1, 0.95, uv.y);

  vec3 col = mix(paper, img, mask);

  // Vignette rides the image only — the paper stays flat.
  float vig = smoothstep(1.3, 0.4, length((uv - 0.5) * vec2(ar, 1.0)));
  col *= mix(1.0, mix(0.72, 1.0, vig), mask);

  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Scroll-driven dissolve, one direction only: the threshold climbs while the
 * scrollbar descends and stops at the far end. It used to fold the sweep in
 * half — eat the image away, then grow it back over the second half — which
 * meant scrolling steadily down played the dissolve in reverse from the
 * midpoint. Scrolling *back up* still regrows it, because scrub runs the tween
 * backwards; that is the reverse the copy promises, and it stays.
 *
 * Renders only when something changed (`dirty`), and drops to one frame in
 * four while the threshold is parked, which is what keeps a pinned WebGL
 * canvas from costing anything while the reader is not scrolling.
 */
export function DissolveDemo({
  accent,
  hint,
  headline,
  body,
  tail,
  fallbackNote,
}: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  /** 0 → 1: intact to fully eaten away. Read by the render loop. */
  const sweep = useRef({ value: 0 });
  const dirtyRef = useRef(true);

  const [live, setLive] = useState(false);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (prefersSaveData() || !hasWebGL()) {
      setDegraded(true);
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
        depth: false,
      });
    } catch {
      setDegraded(true);
      return;
    }
    renderer.setClearColor(0x16211a, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const uniforms = {
      uTex: { value: null as THREE.Texture | null },
      uTexSize: { value: new THREE.Vector2(1, 1) },
      uRes: { value: new THREE.Vector2(1, 1) },
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uNoiseScale: { value: 2.6 },
      uNoiseAmp: { value: 0.62 },
      uSoft: { value: 0.004 },
      uPaper: { value: new THREE.Color(0.949, 0.937, 0.894) },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    scene.add(new THREE.Mesh(geometry, material));

    const resize = () => {
      const el = stickyRef.current;
      const w = el?.clientWidth || window.innerWidth;
      const h = el?.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, w * h > 2_600_000 ? 1.5 : 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w * dpr, h * dpr);
      dirtyRef.current = true;
    };
    resize();

    const onResize = () => {
      resize();
      ScrollTrigger.refresh();
    };
    window.addEventListener("resize", onResize, { passive: true });

    let visible = true;
    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) dirtyRef.current = true;
    };
    document.addEventListener("visibilitychange", onVisibility);

    let disposed = false;

    // One clock for the whole site: gsap.ticker already drives Lenis, and
    // adding a second rAF loop here would fight it for frames.
    const tick = (_time: number, delta: number) => {
      if (disposed || !visible) return;

      const sp = Math.min(Math.max(sweep.current.value, 0), 1);
      // Capped at 0.78 so a band of canopy always frames the top — the
      // composition falls apart once the image is allowed to vanish entirely.
      const next = sp * 0.78;
      if (next !== uniforms.uProgress.value) {
        uniforms.uProgress.value = next;
        dirtyRef.current = true;
      }

      // Parked: stop dead on the last frame (DESIGN.md §5.3 — a canvas layer
      // costs nothing while nobody is scrolling). This used to fall back to
      // rendering every 4th frame so the noise field could keep drifting,
      // which on a 120Hz display is a permanent 30fps GPU load for a drift
      // nobody can see. uTime therefore only advances on frames we draw.
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      uniforms.uTime.value += delta * 0.001;
      renderer.render(scene, camera);
    };

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      IMAGE,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
        uniforms.uTex.value = texture;
        uniforms.uTexSize.value.set(texture.image.width, texture.image.height);
        dirtyRef.current = true;
        renderer.render(scene, camera);
        gsap.ticker.add(tick);
        setLive(true);
        ScrollTrigger.refresh();
      },
      undefined,
      () => {
        if (!disposed) setDegraded(true);
      }
    );

    return () => {
      disposed = true;
      gsap.ticker.remove(tick);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      uniforms.uTex.value?.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  useGSAP(
    () => {
      const stage = stageRef.current;
      const sticky = stickyRef.current;
      if (!live || !stage || !sticky) return;

      // The copy sits low on the screen, which is exactly the band the
      // dissolve turns to paper first — so its ink has to travel the other
      // way, from paper-white over the photo to near-black once the paper is
      // underneath it. Without this the text is invisible for half the scroll.
      const ink = gsap.utils.interpolate("#f2efe4", "#232a21");
      const glow = gsap.utils.interpolate("rgba(0,0,0,0.55)", "rgba(0,0,0,0)");
      const inkAt = gsap.utils.pipe(
        gsap.utils.mapRange(0.2, 0.48, 0, 1),
        gsap.utils.clamp(0, 1)
      );

      const paintInk = () => {
        const el = copyRef.current;
        if (!el) return;
        const t = inkAt(sweep.current.value);
        el.style.setProperty("--dz-ink", ink(t));
        el.style.setProperty("--dz-glow", glow(t));
      };
      paintInk();

      const tween = gsap.to(sweep.current, {
        value: 1,
        ease: "none",
        // The tween's own onUpdate, not the ScrollTrigger's: with `scrub` the
        // catch-up tween keeps running after the scrollbar stops, and a
        // ScrollTrigger callback stops firing at that moment — which left the
        // ink frozen at whatever mid-transition colour it had reached.
        onUpdate: () => {
          dirtyRef.current = true;
          paintInk();
        },
        scrollTrigger: {
          trigger: stage,
          start: "top top",
          end: "bottom bottom",
          pin: sticky,
          pinSpacing: false,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          scrub: 0.9,
        },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
    { scope, dependencies: [live] }
  );

  return (
    <div ref={scope} style={{ "--dz-accent": accent } as CSSProperties}>
      <style href="lab-dissolve" precedence="medium">
        {CSS}
      </style>

      <div ref={stageRef} className="dz-stage">
        <div ref={stickyRef} className="dz-sticky">
          <canvas ref={canvasRef} className="dz-canvas" data-degraded={degraded || undefined} aria-hidden="true" />

          <div ref={copyRef} className="dz-copy">
            <h2 className="dz-headline">{headline}</h2>
            <p className="dz-body">{body}</p>
            <p className="dz-tail">{tail}</p>
            {degraded && <p className="dz-note">{fallbackNote}</p>}
          </div>

          <p className="dz-hint" aria-hidden="true">
            {hint}
          </p>
        </div>
      </div>
    </div>
  );
}

const CSS = `
/* 520vh back when the sweep folded in half — that was ~260vh per act. One act
   now, so the height follows it down rather than halving the dissolve's pace. */
.dz-stage { position: relative; height: 300vh; }
.dz-sticky {
  position: relative;
  height: 100svh;
  overflow: hidden;
  border-block: 1px solid var(--line);
  /* Also the backdrop when WebGL is unavailable, so the copy stays legible. */
  background: #16211a;
}
.dz-canvas { display: block; width: 100%; height: 100%; }
/* No context: hide the dead canvas and let the tinted backdrop carry it. */
.dz-canvas[data-degraded] { visibility: hidden; }

.dz-copy {
  position: absolute;
  inset: auto 0 12vh;
  margin-inline: auto;
  max-width: min(34ch, 82vw);
  text-align: center;
  /* Both are driven from JS as the dissolve passes under the text; these are
     the over-the-photo starting values, and also what a no-JS render keeps. */
  --dz-ink: #f2efe4;
  --dz-glow: rgba(0, 0, 0, 0.55);
  color: var(--dz-ink);
}
.dz-headline {
  margin: 0;
  font-size: clamp(1.7rem, 5vw, 3rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  text-shadow: 0 2px 28px var(--dz-glow);
}
.dz-body {
  margin: 0.9rem 0 0;
  font-size: 0.9375rem;
  line-height: 1.7;
  color: var(--dz-ink);
  opacity: 0.82;
  text-shadow: 0 1px 18px var(--dz-glow);
}
.dz-tail {
  margin: 1.1rem 0 0;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--dz-accent);
}
.dz-note {
  margin: 1rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--dz-ink);
  opacity: 0.66;
}

.dz-hint {
  position: absolute;
  right: clamp(1rem, 4vw, 2.5rem);
  bottom: clamp(1rem, 4vw, 2.5rem);
  margin: 0;
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(242, 239, 228, 0.42);
}
`;
