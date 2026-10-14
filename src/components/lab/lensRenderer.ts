import * as THREE from "three";
import { mountCanvasLoop } from "@/lib/client/canvasLoop";
import { releaseRenderer } from "@/lib/client/three/release";
import { LENS_VERT, LENS_FRAG } from "@/lib/lensSlider";

/** How far the rim's rings displace, in device pixels. Zero is the reference's own look. */
const RIPPLE = 5;

/**
 * The lens slider's WebGL half — the only part of that study that needs
 * three.js, and so the only part that is fetched after the Save-Data / WebGL
 * question has been answered yes (`LensSliderDemo` imports this dynamically).
 * Without it the study is still a working slider, a plain change of picture.
 *
 * Returns the teardown, or `null` when no renderer could be built — `onFail`
 * has then already been called. If the pictures fail to load, it tears itself
 * down before calling `onFail`; the teardown it returned is then a no-op.
 */
export function mountLens({
  canvas,
  box,
  srcs,
  progress,
  dirty,
  shown,
  onLive,
  onFail,
}: {
  canvas: HTMLCanvasElement;
  /** The pinned box the canvas fills, measured on every resize. */
  box: () => HTMLElement | null;
  srcs: string[];
  /** 0 → 1 across one lens, written by the choreography. */
  progress: { value: number };
  /** Set by anyone who needs a frame; cleared by the loop when it draws. */
  dirty: { current: boolean };
  /** The slide on screen when the textures land. */
  shown: () => number;
  /** The textures are up; `bind` swaps the pair the next lens runs between. */
  onLive: (bind: (from: number, to: number) => void) => void;
  onFail: () => void;
}): (() => void) | null {
  let renderer: THREE.WebGLRenderer;
  try {
    // The default power preference: a slider that paints only while a lens
    // moves has no business switching a two-GPU Mac onto the discrete one.
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      depth: false,
    });
  } catch {
    onFail();
    return null;
  }
  renderer.setClearColor(0x101210, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const uniforms = {
    uTex1: { value: null as THREE.Texture | null },
    uTex2: { value: null as THREE.Texture | null },
    uTex1Size: { value: new THREE.Vector2(1, 1) },
    uTex2Size: { value: new THREE.Vector2(1, 1) },
    uRes: { value: new THREE.Vector2(1, 1) },
    uProgress: { value: 0 },
    uRipple: { value: RIPPLE },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: LENS_VERT,
    fragmentShader: LENS_FRAG,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  scene.add(new THREE.Mesh(geometry, material));

  const textures: THREE.Texture[] = [];

  const bind = (from: number, to: number) => {
    const a = textures[from];
    const b = textures[to];
    if (!a || !b) return;
    const ia = a.image as { width: number; height: number };
    const ib = b.image as { width: number; height: number };
    uniforms.uTex1.value = a;
    uniforms.uTex2.value = b;
    uniforms.uTex1Size.value.set(ia.width, ia.height);
    uniforms.uTex2Size.value.set(ib.width, ib.height);
    dirty.current = true;
  };

  // One clock for the whole site: gsap.ticker already drives Lenis.
  const tick = () => {
    const p = Math.min(Math.max(progress.value, 0), 1);
    if (p !== uniforms.uProgress.value) {
      uniforms.uProgress.value = p;
      dirty.current = true;
    }
    if (!dirty.current) return;
    dirty.current = false;
    renderer.render(scene, camera);
  };

  const loop = mountCanvasLoop({
    canvas,
    box,
    dirty,
    resize: (width, height, dpr) => {
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      uniforms.uRes.value.set(width * dpr, height * dpr);
    },
    frame: tick,
    release: () => {
      for (const texture of textures) texture?.dispose();
      geometry.dispose();
      material.dispose();
      releaseRenderer(renderer);
    },
  });

  // The photographs go through untouched: no colour space on the texture,
  // so three neither decodes them on the way in nor re-encodes on the way
  // out — this shader has no colorspace pass and would ship linear values.
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  Promise.all(
    srcs.map(
      (src, index) =>
        new Promise<THREE.Texture>((resolve, reject) => {
          loader.load(
            src,
            (texture) => {
              // Track each arrival immediately: one failed image must also
              // release successful siblings and anything arriving after teardown.
              if (loop.disposed) texture.dispose();
              else textures[index] = texture;
              resolve(texture);
            },
            undefined,
            reject,
          );
        }),
    ),
  ).then(
    (loaded) => {
      if (loop.disposed) return;
      for (const t of loaded) {
        t.minFilter = t.magFilter = THREE.LinearFilter;
        t.generateMipmaps = false;
        t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      }
      bind(shown(), shown());
      loop.start();
      onLive(bind);
    },
    () => {
      if (loop.disposed) return;
      // Nothing will be drawn: the context goes back now, not when the
      // reader leaves the page. The slider carries on as a plain slider.
      loop.dispose();
      onFail();
    },
  );

  return loop.dispose;
}
