/**
 * The lens slider's two halves that have nothing to do with React: the shader
 * pair, and the scroll → slide arithmetic.
 *
 * The transition is a lens. A circle grows out of the centre of the frame;
 * inside it is the *next* picture, and the closer a pixel sits to the rim of
 * the circle the harder it is pulled toward the centre, so the edge of the
 * lens magnifies the way the edge of a glass sphere does. Once the circle has
 * swallowed the frame the pull relaxes and the picture settles flat. The
 * reference is Oscar Pico's project slider (oscarpico.es), by way of TTTISE's
 * breakdown of it; the ripple term is the one thing added here, a nod to the
 * water rings the original shows around its rim.
 */

export const LENS_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const LENS_FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform sampler2D uTex1;     // the picture on screen
uniform sampler2D uTex2;     // the picture the lens brings in
uniform vec2  uTex1Size;
uniform vec2  uTex2Size;
uniform vec2  uRes;          // canvas size, device pixels
uniform float uProgress;     // 0 = uTex1 intact, 1 = uTex2 flat and settled
uniform float uRipple;       // ripple amplitude at the rim, device pixels

/* object-fit: cover, in uv space — the image's own aspect never shows. */
vec2 coverUv(vec2 uv, vec2 size){
  vec2 s = uRes / size;
  float k = max(s.x, s.y);
  vec2 scaled = size * k;
  vec2 off = (uRes - scaled) * 0.5;
  return (uv * uRes - off) / scaled;
}

void main(){
  vec2 p = vUv * uRes;
  vec2 c = uRes * 0.5;
  float d = length(p - c);
  vec2 dir = (p - c) / max(d, 1e-4);

  /* The lens has covered the frame once its radius passes the half-diagonal,
     at progress ≈ 1/3; the remaining two thirds are the distortion letting go
     as the radius keeps growing and the pull, which scales with 1/radius at
     any given pixel, thins out. */
  float radius = uProgress * length(uRes) * 1.5;
  float focusR = radius * 0.25;            // the flat centre of the lens
  float strength = radius / 3000.0;        // how far the rim pulls, uv units

  float sphereSdf = d - radius;
  float inside = smoothstep(0.0, 1.0, -sphereSdf / max(radius * 0.001, 1.0));

  /* 0 at the focus radius, 1 at the rim, then raised to the fifth so the pull
     is a narrow band hugging the edge rather than a whole-lens zoom. */
  float mag = (d - focusR) / max(radius - focusR, 1.0);
  float mF = pow(clamp(mag * inside, 0.0, 1.0), 5.0);
  float factor = mF * strength;

  /* A pixel-space direction turned into a uv-space one that moves the same
     number of pixels on both axes. */
  vec2 dirUv = dir * vec2(uRes.y / uRes.x, 1.0);

  /* Rings running outward from the centre, only while the lens is still
     small; they die with the same curve the pull does. */
  float wave = sin(d * 0.05 - uProgress * 16.0) * uRipple * inside * (1.0 - uProgress);

  vec2 uv1 = coverUv(vUv, uTex1Size);
  vec2 uv2 = coverUv(vUv, uTex2Size) - dirUv * factor + dirUv * (wave / uRes.y);

  vec4 cur = texture2D(uTex1, uv1);
  vec4 nxt = texture2D(uTex2, uv2);

  /* One pixel of anti-aliasing on the rim; the reference uses a hard step. */
  float mask = smoothstep(radius - 1.0, radius + 1.0, d);   // 1 = outside the lens
  float finalMask = max(mask, 1.0 - inside);

  gl_FragColor = mix(nxt, cur, finalMask);
}
`;

/** One transition, in seconds. The breakdown runs 2.5s; that is long under a scrollbar. */
export const LENS_DURATION = 1.7;

/**
 * Which slide a scroll progress lands on. Slides are equal bands along the
 * pinned distance, with the first and last band half-width: the stage is
 * `count` viewports tall, so that is half a viewport for the first slide,
 * a full one for each in the middle, half for the last.
 */
export function slideIndexAt(progress: number, count: number): number {
  if (count <= 1) return 0;
  const p = Math.min(Math.max(progress, 0), 1);
  return Math.min(count - 1, Math.round(p * (count - 1)));
}

/** The scroll progress at the centre of a slide's band — the inverse of `slideIndexAt`. */
export function bandCentre(index: number, count: number): number {
  if (count <= 1) return 0;
  const i = Math.min(Math.max(index, 0), count - 1);
  return i / (count - 1);
}
