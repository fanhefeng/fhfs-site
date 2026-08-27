"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import * as THREE from "three";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";
import { hasWebGL, prefersSaveData } from "@/lib/three/guards";
import { releaseRenderer } from "@/lib/three/release";

type Props = {
  /** The photograph. Loaded as a texture, so keep it a plain JPEG. */
  src: string;
  /** Alt text for the poster the page shows without WebGL. */
  alt: string;
  kicker: string;
  headline: string;
  body: string;
  tail: string;
  hint: string;
  fallbackNote: string;
  className?: string;
};

/** The two papers the picture can dissolve into — the site's section
 *  background in each theme (globals.css `--surface`). */
const PAPER = {
  light: new THREE.Color(0.949, 0.941, 0.918),
  dark: new THREE.Color(0.078, 0.078, 0.09),
};

const VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * The lab's dissolve (components/lab/DissolveDemo.tsx), brought into the
 * magazine: the same scalar-field threshold — a vertical gradient bent by
 * low-frequency fbm, flecked by higher octaves — but the photograph keeps its
 * own colour, warmed a touch, instead of being crushed into ink, and the paper
 * it turns into is whichever paper the site is currently printed on.
 */
const FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform sampler2D uTex;
uniform vec2  uTexSize;
uniform vec2  uRes;
uniform float uProgress;   // 0 = photograph intact, 1 = fully turned to paper
uniform float uTime;
uniform float uNoiseScale;
uniform float uNoiseAmp;
uniform float uSoft;
uniform vec3  uPaper;
uniform float uDark;       // 1 when the paper is the dark theme's

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

  float aa = max(fwidth(field), 0.0018) * 1.15 + uSoft;
  float mask = smoothstep(t - aa, t + aa, field);   // 1 = still photograph

  vec3 paper = uPaper;
  float grain = fbm(auv * 7.5);
  paper *= 0.982 + grain * 0.034;

  // A faint warmth just behind the front — the lamp's light, not yet dry.
  float behind = t - field;
  float haze = (1.0 - smoothstep(0.0, 0.26, behind)) * step(0.0, behind);
  haze *= 0.35 + fbm(auv * 2.4 + 11.0) * 0.8;
  vec3 warm = mix(vec3(0.93, 0.80, 0.62), vec3(0.30, 0.22, 0.12), uDark);
  paper = mix(paper, warm, clamp(haze, 0.0, 1.0) * 0.22);

  // The picture drifts up slightly as it goes, so the room reads as leaving.
  vec2 iuv = coverUv(uv + vec2(0.0, uProgress * 0.05), uTexSize);
  vec3 img = texture2D(uTex, iuv).rgb;

  // Keep the photograph's own colour; lift the shadows a little so the room
  // is not a black slab on a paper page, and warm the whole frame toward the
  // lamp.
  img = pow(img, vec3(0.92));
  float lum = dot(img, vec3(0.299, 0.587, 0.114));
  vec3 duo = vec3(0.09, 0.07, 0.05) + lum * vec3(0.98, 0.84, 0.62);
  img = mix(img, duo, 0.28);
  img += vec3(0.03, 0.022, 0.012);

  vec3 col = mix(paper, img, mask);

  float vig = smoothstep(1.3, 0.4, length((uv - 0.5) * vec2(ar, 1.0)));
  col *= mix(1.0, mix(0.78, 1.0, vig), mask);

  gl_FragColor = vec4(col, 1.0);
}
`;

function currentTheme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/**
 * The portfolio's cover: a photograph that scrolling turns into the page.
 *
 * One direction only — the threshold climbs while the scrollbar descends and
 * parks at the far end, so a steady scroll reads as the room dissolving into
 * paper; scrolling back regrows it. Capped short of 1 so the lamp in the top
 * band is the last thing to go and never quite does.
 *
 * Renders only when something changed (`dirty`): a parked WebGL canvas costs
 * nothing while nobody is scrolling (DESIGN.md §5.3). Without WebGL — or
 * under Save-Data — the poster image stands in and the copy sits on it.
 */
export function DissolveHero({
  src,
  alt,
  kicker,
  headline,
  body,
  tail,
  hint,
  fallbackNote,
  className,
}: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
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
      uPaper: { value: PAPER.light.clone() },
      uDark: { value: 0 },
    };

    const applyTheme = () => {
      const theme = currentTheme();
      uniforms.uPaper.value.copy(PAPER[theme]);
      uniforms.uDark.value = theme === "dark" ? 1 : 0;
      renderer.setClearColor(PAPER[theme], 1);
      dirtyRef.current = true;
    };
    applyTheme();
    // The site's theme contract: LightSwitch dispatches this after flipping
    // data-theme (DESIGN.md §1.6).
    window.addEventListener("fhfs:theme", applyTheme);

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

    // One clock for the whole site: gsap.ticker already drives Lenis.
    const tick = (_time: number, delta: number) => {
      if (disposed || !visible) return;

      const sp = Math.min(Math.max(sweep.current.value, 0), 1);
      // Capped so the lamp's band along the top always frames the page.
      const next = sp * 0.82;
      if (next !== uniforms.uProgress.value) {
        uniforms.uProgress.value = next;
        dirtyRef.current = true;
      }

      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      uniforms.uTime.value += delta * 0.001;
      renderer.render(scene, camera);
    };

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      src,
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
      window.removeEventListener("fhfs:theme", applyTheme);
      document.removeEventListener("visibilitychange", onVisibility);
      uniforms.uTex.value?.dispose();
      geometry.dispose();
      material.dispose();
      releaseRenderer(renderer);
    };
  }, [src]);

  useGSAP(
    () => {
      const stage = stageRef.current;
      const sticky = stickyRef.current;
      if (!live || !stage || !sticky) return;

      // The copy sits low, in the band the dissolve turns to paper first, so
      // its ink travels the other way: paper-white over the photograph, the
      // page's own ink once the paper is underneath it. The end colours are
      // CSS variables, so they follow the theme.
      const inkAt = gsap.utils.pipe(
        gsap.utils.mapRange(0.18, 0.46, 0, 1),
        gsap.utils.clamp(0, 1)
      );
      const paintInk = () => {
        const el = copyRef.current;
        if (!el) return;
        el.style.setProperty("--dh-t", String(inkAt(sweep.current.value)));
      };
      paintInk();

      const tween = gsap.to(sweep.current, {
        value: 1,
        ease: "none",
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
    { scope, dependencies: [live], revertOnUpdate: true }
  );

  return (
    <div ref={scope} className={className}>
      <style href="portfolio-dissolve" precedence="medium">
        {CSS}
      </style>

      <div ref={stageRef} className="dh-stage">
        <div ref={stickyRef} className="dh-sticky" data-live={live || undefined}>
          {/* The poster: what the page shows before the texture is up and
              whenever WebGL is not available. */}
          <Image
            src={src}
            alt={alt}
            fill
            sizes="100vw"
            fetchPriority="high"
            className="dh-poster"
          />
          <canvas
            ref={canvasRef}
            className="dh-canvas"
            data-degraded={degraded || undefined}
            aria-hidden="true"
          />

          <div ref={copyRef} className="dh-copy" style={{ "--dh-t": 0 } as CSSProperties}>
            <p className="dh-kicker">{kicker}</p>
            <h1 className="dh-headline">{headline}</h1>
            <p className="dh-body">{body}</p>
            <p className="dh-tail">{tail}</p>
            {degraded && <p className="dh-note">{fallbackNote}</p>}
          </div>

          <p className="dh-hint" aria-hidden="true">
            {hint}
          </p>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.dh-stage { position: relative; height: 240vh; }
.dh-sticky {
  position: relative;
  height: 100svh;
  overflow: hidden;
  background: var(--surface);
  /* Where the copy's ink starts and ends: over the photograph it is paper
     white; once the paper is under it, the page's own ink. */
  --dh-ink-start: #f2efe4;
  --dh-ink-end: var(--fg);
  --dh-glow-start: rgba(0, 0, 0, 0.5);
}
/* next/image with \`fill\` positions it; only the crop and the grade are ours. */
.dh-poster {
  object-fit: cover;
  filter: saturate(0.9) brightness(0.92);
}
.dh-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 0.6s ease-out;
}
.dh-sticky[data-live] .dh-canvas { opacity: 1; }
.dh-canvas[data-degraded] { display: none; }

.dh-copy {
  position: absolute;
  inset: auto 0 11vh;
  margin-inline: auto;
  max-width: min(38ch, 84vw);
  text-align: center;
  color: color-mix(in srgb, var(--dh-ink-end) calc(var(--dh-t) * 100%), var(--dh-ink-start));
  text-shadow: 0 2px 28px color-mix(in srgb, transparent calc(var(--dh-t) * 100%), var(--dh-glow-start));
}
.dh-kicker {
  margin: 0 0 0.9rem;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.78;
}
.dh-headline {
  margin: 0;
  font-size: clamp(2.2rem, 6.5vw, 4.25rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.05;
}
.dh-body {
  margin: 1rem auto 0;
  max-width: 34ch;
  font-size: 0.9375rem;
  line-height: 1.7;
  opacity: 0.86;
}
.dh-tail {
  margin: 1.2rem 0 0;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
  text-shadow: none;
}
.dh-note {
  margin: 1rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.6;
  opacity: 0.7;
}

.dh-hint {
  position: absolute;
  right: clamp(1rem, 4vw, 2.5rem);
  bottom: clamp(1rem, 4vw, 2.5rem);
  margin: 0;
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(242, 239, 228, 0.5);
  mix-blend-mode: difference;
}
`;
