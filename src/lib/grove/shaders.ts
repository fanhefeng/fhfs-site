/**
 * The moss scene's shaders, shared by the lab study and the grove hero.
 *
 * Two gates let one set of materials serve both pages. `uScanR` drives the
 * survey pulse — a front the form only exists behind — and pushing it past the
 * far corner is what "the survey is over" means, so no separate switch is
 * needed. `uMaskOn` turns on a two-axis dissolve for a form that has to
 * disappear into the page rather than end: the ridge in the distance has to be
 * gone before it reaches the cards, and gone again into the floor light below.
 *
 * Nothing here executes on import — these are strings. The price of one home
 * is that each consumer carries a few uniforms only the other one uses; two
 * copies that drift apart is the more expensive mistake.
 */

/* ────────────────────────────────────────────────────────────────────────
   shared GLSL
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Two directional lights and a sky term, written out rather than pulled from
 * three's lighting chunks: these materials carry a moss cushion, a scan front
 * and a growth parameter that none of the built-in materials know about, so
 * they are ShaderMaterials anyway and the chunk plumbing would buy nothing.
 */
export const LIGHT_GLSL = /* glsl */ `
uniform vec3 uKeyDir, uKeyCol, uFillDir, uFillCol, uAmbCol, uHazeCol;
uniform float uHaze, uFog, uHazeLift, uBoxH;
/* x: local midpoint, y: how far out the form is kept, z: how long it takes to go */
uniform vec3 uCut;
/* x,y: local x the form dissolves across; z,w: the same up the box, as a
   fraction of its height. Off unless uMaskOn says otherwise, so a page that
   frames its whole subject pays nothing for it. */
uniform vec4 uMask;
uniform float uMaskOn;

/* The other way a form can stop.
   endFade() below cuts a shape short at both ends because its own geometry
   runs out; this cuts it short because the PAGE runs out — the ridge in the
   distance has to be gone before it reaches the cards on the right, and gone
   again into the pool of light along the bottom. Two independent ramps rather
   than one radial falloff, because those are two different edges of the
   composition and they are nowhere near the same distance away. */
float maskAt(vec3 lp, float boxH){
  if (uMaskOn < 0.5) return 1.0;
  float e = 1.0 - smoothstep(uMask.x, uMask.y, lp.x);
  float l = smoothstep(uMask.z, uMask.w, lp.y / boxH + 0.5);
  return clamp(e * l, 0.0, 1.0);
}

/* A swept tube is open at both ends, and a tube end inside the frame reads as
   a severed length of pipe however good the moss on it is. Running the ridge
   wide enough to clear the frustum is the obvious answer and the wrong one:
   the blades scale with it, so the far fur ends up coarser on screen than the
   near root's despite being four times further away. Dissolving the last of it
   into the haze instead keeps both — a landform that carries on into mist. */
float endFade(float lx){
  return 1.0 - smoothstep(uCut.y - uCut.z, uCut.y, abs(lx - uCut.x));
}

vec3 litSurface(vec3 N, vec3 albedo, float ao){
  float k = max(dot(N, uKeyDir), 0.0);
  float f = max(dot(N, uFillDir), 0.0);
  float sky = 0.5 + 0.5 * N.y;
  return albedo * (uKeyCol * (0.09 + 1.05 * k)
                 + uFillCol * (0.04 + 0.34 * f)
                 + uAmbCol * (0.35 + 0.65 * sky)) * ao;
}

/* Aerial perspective, weighted by the surface's own luminance. A flat mix
   toward the haze colour puts a floor under every shadow, which is what
   collapses a moss render into one flat mid-tone: the darks lift, the range
   closes, and no amount of light direction gets it back.

   uHazeLift is what re-opens that floor for the ridge in the distance — at
   that range air really does lift the darks, and holding the ridge to the near
   root's setting leaves it reading as a cut-out rather than as a landform
   several hundred metres back. */
vec3 aerial(vec3 c, float h){
  float amt = clamp(uFog + uHaze * smoothstep(0.05, 0.95, h), 0.0, 1.0);
  float gain = smoothstep(0.003, 0.075, dot(c, vec3(0.30, 0.59, 0.11)));
  return mix(c, uHazeCol, amt * mix(uHazeLift, 1.0, gain));
}
`;

/**
 * The survey pulse. A wavefront expands from one point and the root only
 * exists behind it, so the branch is drawn in as the front passes over it
 * rather than faded in as a whole. `lag` holds each material a beat behind the
 * others, and the front is wobbled by two long sines so it never reads as a
 * clean circle sweeping the screen.
 */
export const SCAN_GLSL = /* glsl */ `
uniform vec3 uScanO;
uniform float uScanR;
/* The one thing in these shaders that cannot be written in local units: the
   front is a distance in WORLD space, and the two pages disagree about what a
   world unit is by two orders of magnitude — the study measures in root
   widths, the hero in CSS pixels, so that one unit of geometry is one pixel
   and the moss can be pinned to the layout. x rescales the wobble's
   frequencies, y its amplitude, and the lag is how far the solid trails the
   cage. */
uniform vec2 uScanW;
uniform float uScanLag;

float scanEdge(vec3 w){
  vec3 q = w * uScanW.x;
  float wob = (sin(q.y * 0.9 + q.x * 0.6) * 0.30 + sin(q.z * 1.7 + q.y * 1.1) * 0.14) * uScanW.y;
  return uScanR - uScanLag + wob - distance(w, uScanO);
}
`;

/** Gradient noise — value noise puts its extrema on the lattice, which on a
    tube shows up as blobs in rows. */
export const NOISE_GLSL = /* glsl */ `
vec2 hash22(vec2 p){
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float gnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash22(i + vec2(0,0)), f - vec2(0,0)),
                 dot(hash22(i + vec2(1,0)), f - vec2(1,0)), u.x),
             mix(dot(hash22(i + vec2(0,1)), f - vec2(0,1)),
                 dot(hash22(i + vec2(1,1)), f - vec2(1,1)), u.x), u.y);
}
const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);
float gfbm(vec2 p){
  float a = 0.5, s = 0.0;
  for(int i = 0; i < 5; i++){ s += a * gnoise(p); p = ROT * p * 2.03; a *= 0.5; }
  return s;
}
float ridged(vec2 p){
  float a = 0.5, s = 0.0;
  for(int i = 0; i < 4; i++){ s += a * (1.0 - abs(gnoise(p) * 2.0)); p = ROT * p * 2.11; a *= 0.5; }
  return s;
}

/* The same two, anti-aliased for baking. px is one output texel measured in
   the noise's own units; an octave whose features are finer than about two
   texels is faded out rather than sampled, because sampled it is not detail,
   it is aliasing — sparkle frozen into the plate. gnoise puts roughly one
   feature per two units, so the base octave sits at half a cycle per unit. */
float octW(float px, float freq){ return 1.0 - smoothstep(0.25, 0.5, px * freq); }
float gfbmAA(vec2 p, float px){
  float a = 0.5, s = 0.0, f = 0.5;
  for(int i = 0; i < 5; i++){
    float w = octW(px, f);
    if (w <= 0.0) break;
    s += a * w * gnoise(p); p = ROT * p * 2.03; a *= 0.5; f *= 2.03;
  }
  return s;
}
float ridgedAA(vec2 p, float px){
  float a = 0.5, s = 0.0, f = 0.5;
  for(int i = 0; i < 4; i++){
    float w = octW(px, f);
    if (w <= 0.0) break;
    s += a * w * (1.0 - abs(gnoise(p) * 2.0)); p = ROT * p * 2.11; a *= 0.5; f *= 2.11;
  }
  return s;
}
`;

/**
 * Wind runs on `uPhase`, and what drives that is the caller's business.
 *
 * The lab study hands it the scrollbar, which is its whole conceit and also
 * what buys its performance budget: with nothing driven by time, a parked
 * scene has nothing left to update and the renderer stops dead on its last
 * frame rather than idling at 60fps to sway grass nobody is looking at
 * (DESIGN.md §5.3). The hero hands it a clock, because a hero that only
 * breathes while you scroll is not a hero. Same sway either way.
 */
export const WIND_GLSL = /* glsl */ `
uniform float uPhase;
vec3 windOffset(vec3 p){
  float ph = p.x * 0.42 + p.y * 0.30 + p.z * 0.70;
  float a = 0.030;
  return vec3((sin(uPhase * 0.58 + ph) + 0.45 * sin(uPhase * 1.37 + ph * 2.3)) * a,
              sin(uPhase * 0.79 + ph * 1.7) * a * 0.42,
              sin(uPhase * 0.51 + ph * 0.9) * a * 0.55);
}
`;

/** ACES + sRGB done here rather than through three's chunks: the chunk names
    moved in r152 and again later, and this scene does not need any of the rest
    of the pipeline those includes drag in. */
export const OUTPUT_GLSL = /* glsl */ `
vec3 acesFilm(vec3 x){
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec4 finish(vec3 lit, float alpha){
  return vec4(pow(acesFilm(lit * 1.30), vec3(1.0 / 2.2)), alpha);
}
`;

/* ────────────────────────────────────────────────────────────────────────
   the bark plates
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Everything about the bark that is a function of (u, v) alone — the relief,
 * the grain, the mottle, the fissures and the lichen — baked once into two
 * plates, so the fragment shader reads them back instead of evaluating some
 * fifty gradient-noise lookups per pixel per frame. Measured on the hero at
 * 60fps, that evaluation was two thirds of everything the scene asked of the
 * GPU; the fur, all quarter-million blades of it, was a tenth of that.
 *
 * u is the mirrored coordinate around the limb (0..1), v runs 0..BARK_V_MAX
 * along it, and the domain is the same barkDomain the live shader used, so
 * the plate is the old picture, not a new one. Pass 0 writes relief, grain,
 * mottle and fissures; pass 1 the lichen field. The relief is offset into
 * 0..1 so the plate survives an 8-bit target where half-float is unavailable.
 */
export const BARK_BAKE_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const BARK_BAKE_FRAG = /* glsl */ `
precision highp float;
uniform float uPass, uBarkV;
/* one texel, in the units of the bark domain */
uniform vec2 uTexel;
varying vec2 vUv;
${NOISE_GLSL}
vec2 barkDomain(vec2 uv){ return vec2(uv.x * 7.0, uv.y * 0.62); }
void main(){
  vec2 q = barkDomain(vec2(vUv.x, vUv.y * uBarkV));
  float px = max(uTexel.x, uTexel.y);
  if (uPass > 0.5) {
    float lich = gfbmAA(q * 0.62 + 31.0, px * 0.62) * 0.5 + 0.5;
    gl_FragColor = vec4(lich, 0.0, 0.0, 1.0);
    return;
  }
  vec2 w = vec2(gfbmAA(q * 0.5, px * 0.5), gfbmAA(q * 0.5 + 9.1, px * 0.5));
  vec2 p = q + w * 0.60;                 // meander the fissures
  float ridge = ridgedAA(p, px);
  float plate = smoothstep(-0.25, 0.45, gfbmAA(q * 0.34, px * 0.34));
  float crack = smoothstep(0.30, 0.86, ridgedAA(p * 1.9 + 4.0, px * 1.9));
  float fine  = gfbmAA(p * 5.5, px * 5.5) * 0.5 + 0.5;
  float h = (ridge - 0.5) * 1.85 * mix(0.35, 1.0, plate) - crack * 0.42 + fine * 0.20;
  float grain  = gfbmAA(q * 1.25, px * 1.25) * 0.5 + 0.5;
  float mottle = gfbmAA(q * 0.28 + 21.0, px * 0.28) * 0.5 + 0.5;
  gl_FragColor = vec4((h + 1.5) / 3.0, grain, mottle, crack);
}
`;

/* ────────────────────────────────────────────────────────────────────────
   bark + cushion
   ──────────────────────────────────────────────────────────────────────── */

/**
 * The two discards in the opaque materials — "not yet surveyed" and "faded
 * to nothing" — are compiled out under `SETTLED`, which the hero defines on a
 * second copy of each near-root material and swaps in once the survey is
 * over. The reason is not the two comparisons. A fragment shader that can
 * discard is one whose coverage the GPU cannot know until it has run, so a
 * tile-based GPU (every Apple chip, most phones) has to shade every fragment
 * of the pile — thirty-odd blades deep in places — instead of only the one
 * that wins the depth test. With the discards gone the hidden ones are
 * rejected before shading, and the quarter-million blades cost what the few
 * you can actually see cost.
 *
 * Correct to compile out only because both tests are known constants for the
 * settled near root: the front is parked past the far corner, and its `uCut`
 * and mask are pushed out of reach, so `fade` is 1 everywhere.
 */
export const SETTLED_DISCARD_GLSL = /* glsl */ `
#ifdef SETTLED
#define SCAN_DISCARD(edge)
#define FADE_DISCARD(fade)
#else
#define SCAN_DISCARD(edge) if ((edge) < 0.0) discard;
#define FADE_DISCARD(fade) if ((fade) < 0.004) discard;
#endif
`;

export const BARK_VERT = /* glsl */ `
attribute vec3 aInfo;
uniform float uBoxH;
varying vec3 vN, vW, vInfo, vL;
varying float vH;
${WIND_GLSL}
void main(){
  vInfo = aInfo;
  vN = normalize(normal);
  vec3 p = position + windOffset(position) * (0.35 + 0.65 * aInfo.z);
  vL = p;
  vH = clamp(p.y / uBoxH + 0.5, 0.0, 1.0);
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const BARK_FRAG = /* glsl */ `
precision highp float;
varying vec3 vN, vW, vInfo, vL;
varying float vH;
/* the baked plates — see BARK_BAKE_FRAG */
uniform sampler2D uBark, uBarkLich;
uniform float uBarkV;
${NOISE_GLSL}
${LIGHT_GLSL}
${SCAN_GLSL}
${OUTPUT_GLSL}
${SETTLED_DISCARD_GLSL}

/* Bump-map a surface that has no usable parameterisation, from screen-space
   derivatives of the height field. */
vec3 bumped(vec3 N, vec3 p, float h, float k){
  vec3 dpx = dFdx(p), dpy = dFdy(p);
  float dhx = dFdx(h) * k, dhy = dFdy(h) * k;
  vec3 r1 = cross(dpy, N), r2 = cross(N, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * N - grad);
}

void main(){
  /* The solid lags the cage: the wireframe is drawn at the front itself and
     the shell a beat behind it, which is what makes the pass read as a survey
     of the branch rather than as a wipe uncovering a picture of one. */
  float edge = scanEdge(vW);
  SCAN_DISCARD(edge)
  float fade = endFade(vL.x) * maskAt(vL, uBoxH);
  FADE_DISCARD(fade)

  vec2 uv = vInfo.xy;
  float cap = vInfo.z;
  float m = smoothstep(0.05, 0.42, cap);
  vec3 N = normalize(vN);

  /* Bark grain is strongly anisotropic — features run about ten times longer
     along the limb than around it. That squash, and every noise field built
     on it, is in the plates; the mip chain does the anti-aliasing the live
     evaluation never could. */
  vec2 buv = vec2(uv.x, uv.y / uBarkV);
  vec4 plate = texture2D(uBark, buv);
  float h = plate.r * 3.0 - 1.5;
  N = bumped(N, vW, h, mix(0.26, 0.06, m));

  float grain  = plate.g;
  float mottle = plate.b;
  float crack  = plate.a;

  /* Old wet-forest wood: silvered grey where the light rakes it, near-black
     in the splits, drifting slowly into a damp umber. */
  vec3 silver = mix(vec3(0.020, 0.019, 0.018), vec3(0.290, 0.283, 0.264), grain);
  vec3 umber  = mix(vec3(0.024, 0.019, 0.016), vec3(0.175, 0.140, 0.110), grain);
  vec3 wood   = mix(silver, umber, mottle * 0.78);
  wood *= 1.0 - 0.70 * crack;

  float mo = gfbm(vec2(vW.x * 2.6, vW.z * 2.6 + vW.y * 1.9)) * 0.5 + 0.5;
  vec3 moss = mix(vec3(0.0204, 0.0311, 0.0050), vec3(0.0914, 0.1392, 0.0227), mo);
  moss *= 0.80 + 0.42 * cap;

  vec3 col = mix(wood, moss, m);

  /* A pale lichen crust where bare wood faces up. */
  float lich = smoothstep(0.56, 0.84, texture2D(uBarkLich, buv).r);
  lich *= (1.0 - m) * smoothstep(-0.10, 0.70, N.y) * smoothstep(0.15, 0.50, h);
  col = mix(col, vec3(0.162, 0.176, 0.132), lich * 0.78);

  /* Contact shadow along the moss line. The cushion overhangs the bark it
     sits on; without this the two materials meet on a clean edge that reads
     as a paint mask rather than as one thing growing on another. */
  float contact = smoothstep(0.0, 0.16, cap) * (1.0 - smoothstep(0.16, 0.60, cap));
  col *= 1.0 - 0.48 * contact;

  float ao = mix(0.30, 1.02, smoothstep(-0.40, 0.62, h)) * mix(1.0, 0.86, m);
  vec3 lit = litSurface(N, col, ao);

  vec3 V = normalize(cameraPosition - vW);
  lit += col * uAmbCol * pow(1.0 - max(dot(N, V), 0.0), 4.0) * 0.85;
  lit += uKeyCol * pow(max(dot(reflect(-uKeyDir, N), V), 0.0), 20.0) * 0.045 * (1.0 - m) * ao;

  /* The front itself glows, so the scan reads as something passing over the
     form rather than as the form simply appearing. The falloff is in world
     units and the whole root is only about twelve of them across — at the
     first-guess rate this band was a couple of pixels wide and may as well not
     have been there. */
  lit += vec3(0.30, 0.72, 0.46) * exp(-edge * uScanW.x * 1.6) * 0.75;

  gl_FragColor = finish(aerial(lit, vH), fade);
}
`;

/* ────────────────────────────────────────────────────────────────────────
   the fur
   ──────────────────────────────────────────────────────────────────────── */

export const GRASS_VERT = /* glsl */ `
attribute vec3 aOffset;
attribute vec3 aNormal;
attribute vec4 aRandom;   // yaw, length, lean, tone
attribute float aClump;
uniform float uGrow, uBoxH, uMouseR;
uniform vec3 uMouse;
varying float vT, vShade, vTone, vH, vPart;
varying vec3 vN, vW, vL;
${WIND_GLSL}

void main(){
  float t = uv.y; vT = t;
  /* Blades grow out of the cushion rather than fading in: a fade leaves the
     full silhouette standing there at low alpha from the first frame, which
     gives the whole trick away before the scan has even arrived. */
  float len = aRandom.y * uGrow;

  vec3 ref = abs(aNormal.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 T0 = normalize(cross(aNormal, ref));
  vec3 B0 = cross(aNormal, T0);
  float ca = cos(aRandom.x), sa = sin(aRandom.x);
  vec3 widthDir = T0 * ca + B0 * sa;
  vec3 leanDir  = T0 * -sa + B0 * ca;

  float bend = t * t;
  float gust = (sin(uPhase * 1.75 + aOffset.x * 1.6 + aRandom.x) * 0.12
             +  sin(uPhase * 0.85 + aOffset.x * 0.55) * 0.07);

  vec3 world = aOffset + windOffset(aOffset)
             + aNormal * (t * len)
             + widthDir * (position.x * len * 0.62)
             + leanDir * (aRandom.z * 0.42 * len) * bend
             + (T0 * gust + B0 * gust * 0.6) * bend * len * 1.6;

  /* The pointer parts the fur: push tangentially, press down along the normal.
     Scaled by the blade's own length rather than by a constant — a fixed push
     is several times the height of a moss blade and combs the pile into
     streaks instead of parting it. */
  vec3 toB = aOffset - uMouse;
  float infl = smoothstep(uMouseR, 0.0, length(toB * vec3(1.0, 1.0, 0.30)));
  infl *= infl;
  vec3 push = toB - aNormal * dot(toB, aNormal);
  float pl = length(push);
  push = pl > 0.0001 ? push / pl : T0;
  world += push * infl * bend * len * 2.2;
  world -= aNormal * infl * bend * len * 1.0;
  vPart = infl;

  vShade = (0.66 + 0.34 * aRandom.w) * (0.82 + 0.18 * sin(aRandom.x * 2.0));
  vShade *= 0.46 + 0.54 * clamp(aNormal.y * 0.5 + 0.62, 0.0, 1.0);
  vTone = smoothstep(0.16, 0.86, aClump);
  vN = normalize(mix(aNormal, normalize(leanDir * aRandom.z + aNormal), 0.35));
  vL = world;
  vH = clamp(world.y / uBoxH + 0.5, 0.0, 1.0);
  vec4 wp = modelMatrix * vec4(world, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const GRASS_FRAG = /* glsl */ `
precision highp float;
varying float vT, vShade, vTone, vH, vPart;
varying vec3 vN, vW, vL;
${LIGHT_GLSL}
${SCAN_GLSL}
${OUTPUT_GLSL}
${SETTLED_DISCARD_GLSL}

void main(){
  SCAN_DISCARD(scanEdge(vW))
  float fade = endFade(vL.x) * maskAt(vL, uBoxH);
  FADE_DISCARD(fade)

  /* Linear-space colours. The channel ratios are solved backwards from a
     photographic reference rather than picked: real moss sits around hue 77°,
     saturation 56%, value 23% — a good deal more yellow, and a good deal
     deeper, than the green a shader reaches for unaided. */
  vec3 deep  = vec3(0.0126, 0.0192, 0.0031);
  vec3 mid   = vec3(0.0488, 0.0744, 0.0121);
  vec3 tip   = vec3(0.1222, 0.1860, 0.0304);
  vec3 tipHi = vec3(0.2600, 0.3900, 0.0640);

  vec3 col = mix(deep, mid, smoothstep(0.0, 0.62, vT));
  col = mix(col, tip, smoothstep(0.38, 1.0, vT) * (0.35 + 0.65 * vTone));
  col *= 0.62 + 0.72 * vTone;
  col *= vShade;
  /* parted fur shows the shaded pile underneath it */
  col *= 1.0 - vPart * 0.55;

  vec3 N = normalize(vN);
  /* Self-shadowing inside the pile: the further down a blade you look, the
     less sky reaches it. Without this the fur reads as astroturf however good
     the colours are. */
  vec3 lit = litSurface(N, col, mix(0.40, 1.10, smoothstep(0.0, 0.88, vT)) * (0.70 + 0.52 * vTone));

  /* The sunlit crown is added AFTER the pile shading. Folded into the albedo
     instead, it comes back out at the same value as everything else — which
     is exactly the flat mid-tone the render is trying to escape. Only the
     last quarter of a blade is in the open, and it carries the whole top
     decile of the histogram. */
  lit += tipHi * smoothstep(0.68, 1.0, vT) * vTone
       * (0.30 + 0.70 * max(dot(N, uKeyDir), 0.0)) * 0.95;

  vec3 V = normalize(cameraPosition - vW);
  lit += col * uKeyCol * pow(max(dot(V, -uKeyDir), 0.0), 2.2) * 0.55 * vT;

  gl_FragColor = finish(aerial(lit, vH), fade);
}
`;

/* ────────────────────────────────────────────────────────────────────────
   ferns
   ──────────────────────────────────────────────────────────────────────── */

export const FERN_VERT = /* glsl */ `
attribute vec3 aOffset;
attribute vec4 aQuat;
attribute vec2 aRandom;   // size, tint
uniform float uGrow, uBoxH;
varying vec2 vUv;
varying vec3 vN, vW, vL;
varying float vH, vTint;
${WIND_GLSL}

vec3 qrot(vec4 q, vec3 v){ return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }

void main(){
  vUv = uv; vTint = aRandom.y;
  /* Fronds unfurl on the same parameter the moss grows on, a beat later:
     ferns colonising a cushion that is already there is the order the study
     is claiming, and popping them in at full size gives that away. */
  float grow = smoothstep(0.25, 1.0, uGrow);
  vec3 local = qrot(aQuat, position * aRandom.x * grow);
  vN = normalize(qrot(aQuat, normal));
  /* The frond bows from its stipe, so the sway has to climb with the vertex's
     own height up the rachis rather than move the whole instance. */
  float sway = sin(uPhase * 1.15 + aRandom.y * 6.28) * 0.055;
  local += vec3(sway, 0.0, sway * 0.45) * clamp(position.y, 0.0, 1.2) * aRandom.x;
  vec3 p = aOffset + windOffset(aOffset) + local;
  vL = p;
  vH = clamp(p.y / uBoxH + 0.5, 0.0, 1.0);
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const FERN_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vN, vW, vL;
varying float vH, vTint;
${LIGHT_GLSL}
${SCAN_GLSL}
${OUTPUT_GLSL}
${SETTLED_DISCARD_GLSL}
void main(){
  SCAN_DISCARD(scanEdge(vW))
  float fade = endFade(vL.x) * maskAt(vL, uBoxH);
  FADE_DISCARD(fade)
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vW);
  vec3 base = mix(vec3(0.0270, 0.0450, 0.0099), vec3(0.0690, 0.1150, 0.0253), vTint);
  base *= 0.80 + 0.30 * smoothstep(0.0, 0.8, vUv.x);
  vec3 lit = litSurface(N, base, 0.9);
  /* fronds are thin — light comes through them */
  lit += base * uKeyCol * pow(max(dot(V, -uKeyDir), 0.0), 2.0) * 1.05;
  gl_FragColor = finish(aerial(lit, vH), fade);
}
`;

/* ────────────────────────────────────────────────────────────────────────
   flowers
   ──────────────────────────────────────────────────────────────────────── */

export const FLOWER_VERT = /* glsl */ `
attribute vec3 aOffset;
attribute vec2 aRandom;   // size, seed
uniform float uBloom, uBoxH;
varying vec2 vUv;
varying float vH;
varying vec3 vW, vL;
${WIND_GLSL}
void main(){
  vUv = uv;
  vec3 p = aOffset + windOffset(aOffset) * 1.6;
  p += vec3(sin(uPhase * 1.5 + aRandom.y * 6.28), 0.0, 0.0) * 0.020;
  vL = p;
  vH = clamp(p.y / uBoxH + 0.5, 0.0, 1.0);
  vW = (modelMatrix * vec4(p, 1.0)).xyz;

  /* Billboard in view space so the spray always faces the lens. The offset
     has to be scaled out of the group's own transform first, because the
     modelView matrix has already been applied to the anchor point. */
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float ws = length(modelMatrix[0].xyz);
  /* Each spray opens on its own beat, spread across the bloom window by its
     seed — all of them popping on the same frame reads as a switch. */
  float open = smoothstep(aRandom.y * 0.55, aRandom.y * 0.55 + 0.45, uBloom);
  mv.xy += position.xy * aRandom.x * ws * open;
  gl_Position = projectionMatrix * mv;
}
`;

export const FLOWER_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
varying vec2 vUv;
varying float vH;
varying vec3 vW, vL;
${LIGHT_GLSL}
${SCAN_GLSL}
${OUTPUT_GLSL}
void main(){
  if (scanEdge(vW) < 0.0) discard;
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.14) discard;
  float fade = endFade(vL.x) * maskAt(vL, uBoxH);
  /* The map is painted in sRGB and everything downstream is linear; squaring
     is the cheap approximation of the transfer, and at this size the exact
     curve is unresolvable anyway. */
  vec3 col = t.rgb * t.rgb * (uKeyCol * 0.62 + uAmbCol * 0.9);
  gl_FragColor = finish(aerial(col, vH), t.a * fade);
}
`;

/* ────────────────────────────────────────────────────────────────────────
   the survey cage
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Ring-and-spar lines lifted straight off the shell grid, drawn with depth
 * testing off so the whole cage shows through itself — which is what makes it
 * read as a scan of the branch rather than as an outline drawn on one.
 */
export const WIRE_VERT = /* glsl */ `
varying vec3 vW;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const WIRE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uScanO;
uniform float uScanR, uWire, uPhase;
/* x: half-width of the bright ring on the front, y: how far the dim cage
   lingers behind it, z: spacing of the survey ticks running out along the
   beam. All three are world distances — see uScanW. */
uniform vec3 uWireK;
varying vec3 vW;
void main(){
  float d = distance(vW, uScanO);
  /* A bright ring exactly on the wavefront, over a dim cage that lingers
     behind it and then burns off with uWire. Both falloffs are in world units,
     and the whole root is only about twelve of those across. */
  float rim   = exp(-pow((d - uScanR) / uWireK.x, 2.0));
  float trail = smoothstep(uScanR, uScanR - uWireK.y, d);
  float a = (rim * 1.60 + trail * 0.30) * uWire;
  if (a < 0.004) discard;
  /* survey ticks running out along the beam */
  a *= 0.66 + 0.34 * sin(d * uWireK.z - uPhase * 3.0);
  vec3 col = mix(vec3(0.30, 0.72, 0.46), vec3(0.86, 1.00, 0.90), rim);
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}
`;

/* ────────────────────────────────────────────────────────────────────────
   drifting pollen
   ──────────────────────────────────────────────────────────────────────── */

export const MOTE_VERT = /* glsl */ `
attribute vec4 aSeed;     // phase, speed, sway, size
uniform float uPhase, uSize, uScale, uClimb;
varying float vFade;
void main(){
  float ph = aSeed.x, sp = aSeed.y, am = aSeed.z;
  vec3 p = position;
  p.x += sin(uPhase * sp * 0.35 + ph) * 0.42 * am;
  /* one long rise, wrapped — the band fade hides the wrap.
     The obvious name for this half-band is a reserved word in GLSL ES. */
  float band = uClimb * 0.5;
  float climb = mod(uPhase * 0.42 * sp + ph * 0.7, uClimb) - band;
  p.y += climb;
  p.z += cos(uPhase * sp * 0.28 + ph) * 0.30 * am;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * aSeed.w * (uScale / max(-mv.z, 0.001));
  float edge = 1.0 - abs(climb) / band;
  float twinkle = 0.55 + 0.45 * sin(uPhase * (0.7 + sp * 1.6) + ph * 3.1);
  vFade = clamp(edge * 3.0, 0.0, 1.0) * twinkle;
  gl_Position = projectionMatrix * mv;
}
`;

export const MOTE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
varying float vFade;
void main(){
  vec4 t = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(t.rgb, t.a * vFade * 0.52);
}
`;

/**
 * The trail the pointer lifts off the moss.
 *
 * Each grain carries its own origin, velocity and birth stamp, so the CPU only
 * writes when one is respawned out of the ring — the flight itself is
 * integrated here, the same way the ambient pollen is. Which also means the
 * whole emitter costs one uniform write per frame however many grains are up.
 */
export const SPRAY_VERT = /* glsl */ `
attribute vec3 aVel;
attribute float aBirth;
attribute vec2 aRnd;
uniform float uNow, uSize, uScale, uLife;
varying float vA;
void main(){
  float age = uNow - aBirth;
  if (age < 0.0 || age > uLife) {
    vA = 0.0;
    gl_PointSize = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   // off the clip volume entirely
    return;
  }
  float u = age / uLife;
  /* drag on the launch velocity, a slow lift, and a little wander */
  vec3 p = position + aVel * age * (1.0 - 0.34 * u)
         + vec3(sin(aRnd.y * 6.28 + age * 2.6) * 0.115 * u, 0.245 * age, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * aRnd.x * (uScale / max(-mv.z, 0.001)) * (0.45 + 0.55 * (1.0 - u));
  vA = smoothstep(0.0, 0.09, u) * (1.0 - smoothstep(0.40, 1.0, u));
  gl_Position = projectionMatrix * mv;
}
`;

export const SPRAY_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
varying float vA;
void main(){
  vec4 t = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(t.rgb, t.a * vA * 0.85);
}
`;

/* ────────────────────────────────────────────────────────────────────────
   butterfly
   ──────────────────────────────────────────────────────────────────────── */

export const WING_VERT = /* glsl */ `
uniform float uBend;
varying vec2 vUv;
varying vec3 vN, vW;
void main(){
  vUv = uv;
  /* The tip lags the stroke. A rigid plate rotating as one piece reads as
     folded paper rather than as something with a membrane, and the stroke
     itself is on the mesh's own rotation — the lag is all this has to add. */
  vec3 p = position;
  float s = uv.x;
  p.y += uBend * s * s;
  p.z += uBend * s * s * (uv.y - 0.45) * 0.35;
  vN = normalize(normalMatrix * normal);
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const WING_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uKeyDir, uKeyCol, uAmbCol;
uniform float uHind;
uniform sampler2D uTex;
varying vec2 vUv;
varying vec3 vN, vW;
${OUTPUT_GLSL}
void main(){
  float s = vUv.x, u = vUv.y;
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vW);

  /* Structural colour, not pigment: the hue swings with viewing angle — hot
     chartreuse square on, deep green at a glance. That swing is what reads as
     diffraction rather than as paint.

     Kept well under 1, and lower again than the study this came from. That
     one framed the animal at a few dozen pixels, where a clipped wing still
     reads as a wing; here the camera ends up close enough that the whole
     pattern is on show, and at the brighter albedo the border, the veins and
     the lunules all clip to the same flat chartreuse — a bow tie rather than
     a butterfly. Leaving ACES the headroom is what lets them arrive. */
  float facing = abs(dot(N, V));
  vec3 face = vec3(0.150, 0.255, 0.019);
  vec3 edge = vec3(0.028, 0.086, 0.006);
  vec3 wing = mix(edge, face, pow(facing, 0.65));
  wing *= 0.62 + 0.72 * smoothstep(0.02, 0.46, s) * (1.0 - 0.34 * smoothstep(0.45, 1.0, u));

  /* scales lie in overlapping rows running out from the base */
  vec4 tx = texture2D(uTex, vUv);
  float rows = tx.r, grain = tx.g, mottle = tx.b, shim = tx.a;
  wing *= 0.78 + 0.44 * mottle;
  wing = mix(wing * vec3(0.46, 1.14, 0.30), wing * vec3(1.34, 1.06, 0.16), shim);

  vec3 dark  = vec3(0.030, 0.026, 0.014);
  vec3 cream = vec3(0.520, 0.500, 0.290);
  vec3 amber = vec3(0.400, 0.270, 0.045);

  /* the wide sooty border down the whole distal edge */
  float border = max(smoothstep(0.60, 0.74, s), smoothstep(0.78, 0.94, u));
  vec3 c = mix(wing, dark, border);

  /* veins: pale tan over the wing, lost inside the border */
  float vp = pow(u, 0.72) * 5.2 + s * 0.55 + (mottle - 0.5) * 0.22;
  float vk = abs(fract(vp) - 0.5) * 2.0;
  float aa = fwidth(vp) * 2.0 + 0.045;
  float vw = 0.050 * (1.0 - 0.42 * s);
  float vein = 1.0 - smoothstep(vw, vw + aa, vk);
  c = mix(c, vec3(0.430, 0.400, 0.180), vein * 0.26 * (1.0 - border * 0.85));

  /* lunules set into the border: cream on the forewing, amber behind */
  float lunBand = exp(-pow((border - 0.58) / 0.20, 2.0));
  float edgeT = u * 0.62 + s * 0.58;
  float lun = exp(-pow((fract(edgeT * 7.0) - 0.5) * 4.2, 2.0));
  c = mix(c, mix(cream, amber, uHind), border * lunBand * lun * 0.90);

  /* the big apical blazes, forewing only */
  float ap1 = exp(-pow((s - 0.86) / 0.085, 2.0)) * exp(-pow((u - 0.15) / 0.100, 2.0));
  float ap2 = exp(-pow((s - 0.66) / 0.070, 2.0)) * exp(-pow((u - 0.07) / 0.075, 2.0));
  c = mix(c, cream, (1.0 - uHind) * clamp(ap1 + ap2 * 0.75, 0.0, 1.0) * 0.42);

  c *= 0.88 + 0.25 * rows;
  c *= 0.935 + 0.13 * grain;

  /* the very edge is a fringe of loose scales, paler and duller */
  float rim = clamp(smoothstep(0.93, 1.0, s) + smoothstep(0.955, 1.0, u), 0.0, 1.0);
  c = mix(c, vec3(0.230, 0.215, 0.150), rim * 0.55);

  float wrap = dot(N, uKeyDir) * 0.5 + 0.5;
  vec3 lit = c * (uKeyCol * (0.34 + 1.05 * wrap) + uAmbCol * (0.5 + 0.5 * N.y) * 1.5);
  /* light burning through the membrane from behind */
  lit += mix(vec3(0.86, 0.78, 0.20), vec3(0.34, 0.60, 0.12), border)
       * pow(max(dot(V, -uKeyDir), 0.0), 2.4) * 0.42;
  lit += vec3(0.86, 0.96, 0.52)
       * pow(max(dot(reflect(-uKeyDir, N), V), 0.0), 26.0) * 0.34 * (1.0 - border);

  gl_FragColor = finish(lit, 1.0);
}
`;

export const BODY_VERT = /* glsl */ `
varying vec3 vN, vW, vP;
void main(){
  vN = normalize(normalMatrix * normal);
  vP = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const BODY_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uKeyDir, uKeyCol, uAmbCol;
varying vec3 vN, vW, vP;
${NOISE_GLSL}
${OUTPUT_GLSL}
void main(){
  vec3 N = normalize(vN);
  /* the thorax is furred, the abdomen banded */
  float band = 0.5 + 0.5 * sin(vP.z * 150.0);
  float furry = smoothstep(-0.02, 0.10, vP.z);
  vec3 base = mix(vec3(0.020, 0.019, 0.011), vec3(0.070, 0.064, 0.030), band * (1.0 - furry * 0.5));
  float fleck = smoothstep(0.86, 0.99, sin(vP.z * 120.0) * sin(atan(vP.y, vP.x) * 7.0) * 0.5 + 0.5);
  base = mix(base, vec3(0.46, 0.44, 0.24), fleck * 0.75);
  float fur = gfbm(vec2(atan(vP.y, vP.x) * 9.0, vP.z * 70.0)) * 0.5 + 0.5;
  base *= mix(1.0, 0.62 + 0.85 * fur, furry);
  float d = max(dot(N, uKeyDir), 0.0);
  vec3 col = base * (uKeyCol * (0.24 + 1.35 * d) + uAmbCol * (0.5 + 0.5 * N.y) * 1.8);
  vec3 V = normalize(cameraPosition - vW);
  col += uKeyCol * pow(max(dot(reflect(-uKeyDir, N), V), 0.0), 22.0) * 0.05;
  gl_FragColor = finish(col, 1.0);
}
`;
