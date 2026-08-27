import * as THREE from "three";
import { BARK_V_MAX } from "./geometry";
import { BARK_BAKE_VERT, BARK_BAKE_FRAG } from "./shaders";

/**
 * The bark plates, baked on the GPU the moment a scene has a renderer.
 *
 * Two full-screen passes into two render targets — one quad, a few
 * milliseconds, once per page — replace what used to be some fifty noise
 * lookups per bark pixel per frame (see BARK_BAKE_FRAG for what goes where).
 * Mipmapped, so the plate is also correctly filtered at every distance the
 * root is seen from, where the live evaluation aliased.
 *
 * Half-float where the context can render to it, which is everywhere that
 * matters; the 8-bit fallback is what the relief's 0..1 offset is for.
 * The plate is roughly square in bark-domain units (7 across, 0.62 × BARK_V_MAX
 * along), so the texel is isotropic and one LOD number serves both axes.
 */
export type BarkPlates = {
  /** RGBA: relief (offset), grain, mottle, fissures */
  plate: THREE.Texture;
  /** R: lichen field */
  lichen: THREE.Texture;
  /** for the bark material's own uniforms */
  uniforms: { uBark: { value: THREE.Texture }; uBarkLich: { value: THREE.Texture }; uBarkV: { value: number } };
  dispose: () => void;
};

export function bakeBarkPlates(renderer: THREE.WebGLRenderer, small: boolean): BarkPlates {
  const w = small ? 384 : 768;
  const h = small ? 1024 : 2048;
  const halfFloat =
    renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float");

  const target = () =>
    new THREE.WebGLRenderTarget(w, h, {
      type: halfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      colorSpace: THREE.NoColorSpace,
    });
  const plateRT = target();
  const lichenRT = target();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPass: { value: 0 },
      uBarkV: { value: BARK_V_MAX },
      uTexel: { value: new THREE.Vector2(7 / w, (0.62 * BARK_V_MAX) / h) },
    },
    vertexShader: BARK_BAKE_VERT,
    fragmentShader: BARK_BAKE_FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.PlaneGeometry(2, 2);
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(quad, material));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const previous = renderer.getRenderTarget();
  for (const [pass, rt] of [[0, plateRT], [1, lichenRT]] as const) {
    material.uniforms.uPass.value = pass;
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
  }
  renderer.setRenderTarget(previous);
  material.dispose();
  quad.dispose();

  return {
    plate: plateRT.texture,
    lichen: lichenRT.texture,
    uniforms: {
      uBark: { value: plateRT.texture },
      uBarkLich: { value: lichenRT.texture },
      uBarkV: { value: BARK_V_MAX },
    },
    dispose: () => {
      plateRT.dispose();
      lichenRT.dispose();
    },
  };
}
