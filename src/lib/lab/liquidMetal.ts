/**
 * Liquid metal — a dispersion shader, and the five passes that pour it.
 *
 * The pill is not lit, shaded or textured. A scalar field V is painted through
 * a soft plateau — dark below it, blown white inside, dark above — and that
 * plateau is evaluated once per spectral wavelength at a slightly different
 * height in V. So the plateau's lower edge fringes warm (red turns on first)
 * and its upper edge fringes cool (red turns off first). Fringe width falls
 * out as dispersion over |grad V|, which is why one shader gives razor-thin
 * rainbow lines where the field is pinched and broad navy-to-cyan washes
 * where it is not.
 *
 * V itself is a family of parallel curves — one swooping valley repeated up
 * the button, at a density that varies along its length — so the ribbons stay
 * laminar rather than turbulent. Built explicitly as
 *
 *     V = (y - valley(x)) * density(x)
 *
 * rather than hoping two-dimensional noise happens to produce it.
 *
 * This file is strings and numbers. Nothing here touches the DOM or a GL
 * context, which is what lets the whole of the hard part be read without one.
 */

/* ────────────────────────────────────────────────────────────────────────
   tunables
   ──────────────────────────────────────────────────────────────────────── */

/**
 * The metal field, uploaded as `uP[0..20]`.
 *
 * ORDER IS THE SHADER'S INDEXING. The array is packed by walking FIELD_ORDER,
 * so reordering these renames every constant in the fragment shader at once.
 */
export const FIELD = {
  /** x-frequency of the valley curve */
  valFreq: 0.5,
  /** valley depth, in button heights — bounded so the ribbon cannot leave the pill */
  valAmp: 0.55,
  /** band density: bands per button height */
  dens: 2.4,
  /** how much the density swings along x, exponentially */
  densVar: 2.2,
  /** x-frequency of that density variation */
  densFreq: 0.32,
  /** organic 2-D wobble, in field units */
  wobAmp: 0.12,
  /** its frequency */
  wobFreq: 1.6,
  /** phase offset of the band family */
  lift: 0.05,
  /** self-refraction — folds the iso-lines into each other */
  refract: 0.18,
  /** softness of the plateau edges */
  edge: 0.04,
  /** plateau width, as a fraction of one band period */
  width: 0.46,
  /** spectral dispersion, in band periods */
  disp: 0.3,
  /** dispersion skew — above 1 spreads the blue end, as Cauchy does */
  skew: 1.5,
  /**
   * Filament amplitude. Off: at 20 cycles per button height they were finer
   * than the softening buffer can carry, so they aliased into stripes instead
   * of reading as fibres of light, and at this blur they contribute nothing
   * else.
   */
  fineAmp: 0,
  /** filament frequency across the iso-lines */
  fineFreq: 9,
  /** tone gamma */
  gamma: 1,
  /** overall gain */
  gain: 1.9,
  /** fbm octave gain — low keeps the first octave dominant, so the wobble stays big */
  octGain: 0.32,
  /** distance below the valley where light begins */
  litLo: -0.26,
  /** …and where it is full */
  litHi: 0.1,
  /** how far the metal is knocked back under the label */
  dim: 0.44,
} as const;

export const FIELD_ORDER = [
  "valFreq", "valAmp", "dens", "densVar", "densFreq", "wobAmp", "wobFreq",
  "lift", "refract", "edge", "width", "disp", "skew", "fineAmp", "fineFreq",
  "gamma", "gain", "octGain", "litLo", "litHi", "dim",
] as const satisfies readonly (keyof typeof FIELD)[];

/** The travelling rim, uploaded as `uE[0..7]`. Same rule about order. */
export const RIM = {
  /** floor brightness, so the whole outline stays drawn */
  base: 0.2,
  /** gain on the travelling highlights */
  hot: 0.82,
  /** chromatic offset across the stroke, in device px */
  chromA: 0.42,
  /** chromatic offset along the perimeter, in laps */
  chromS: 0.03,
  /** laps per second of the leading highlight */
  speed: 0.07,
  /** how much the rim stays biased to the top edge */
  top: 0.35,
  /** how far the outline brightens while held */
  press: 0.85,
  /** extra flare as a ripple crest crosses the outline */
  ripple: 1.6,
} as const;

export const RIM_ORDER = [
  "base", "hot", "chromA", "chromS", "speed", "top", "press", "ripple",
] as const satisfies readonly (keyof typeof RIM)[];

/** Composite and blur, read directly rather than packed into an array. */
export const COMPOSITE = {
  /** outer-glow gain */
  glow: 1.95,
  /** outer-glow radius */
  glowR: 1.3,
  /** how much bloom is allowed back inside the pill */
  glowIn: 0.3,
  /** how much the drop shadow eats the bloom beneath it */
  occl: 0.62,
  /** blur on the metal, in button heights — the "molten" knob */
  soften: 0.24,
  /** contrast curve on the softened metal; 1 is off */
  punch: 1.5,
};

/** Disturbances. Distances in button heights, times in seconds. */
export const DISTURB = {
  /** how fast the press ring expands */
  speed: 1.85,
  /** ring thickness */
  width: 0.2,
  /** e-fold fade */
  decay: 1.35,
  /** how far the ring displaces the metal field */
  amp: 1.35,
  /** depth of the faceting on the wavefront */
  facet: 0.18,
  /** how many facets */
  lobes: 6,
  /** crest profile: 2 is a gaussian swell, ~1 a hard crease */
  sharp: 1.15,
  /** light the crest carries of its own */
  emit: 0.45,
  /** radius of the cursor well */
  ptrRad: 0.55,
  /** how far the sheet is dragged when the cursor is still */
  ptrAmp: 0.32,
  /** extra drag at full speed */
  ptrFast: 0.4,
  /** how much the nearest stretch of rim brightens */
  ptrRim: 0.8,
  /** trail: fraction of the gap left after one second — lower is snappier */
  ptrLag: 0.0016,
  /** cursor speed, in button heights per second, that counts as fast */
  ptrVref: 4.5,
};

/** How long a ripple stays in its slot, in seconds. */
export const RIPPLE_LIFE = 4;
/** Three slots, so a quick double-tap overlaps instead of cutting the first off. */
export const RIPPLE_SLOTS = 3;

/* ────────────────────────────────────────────────────────────────────────
   shaders
   ──────────────────────────────────────────────────────────────────────── */

/** A single oversized triangle. `#version` has to be byte one of the source. */
export const VERT = `#version 300 es
in vec2 position; void main(){ gl_Position = vec4(position, 0., 1.); }`;

const HEAD = `#version 300 es
precision highp float;
out vec4 o;

uniform vec2  uC;        // pill centre, device px
uniform vec2  uHalf;     // pill half-extent, device px
uniform float uT;        // seconds
uniform float uHover;    // 0..1
uniform float uPress;    // 0..1, eased
uniform vec4  uRip[3];   // xy centre (button heights, +y down), z start, w live
uniform vec4  uRipK;     // speed, ring width, decay, amplitude
uniform vec4  uRipK2;    // facet depth, facet count, crest sharpness, emission
uniform vec4  uPtr;      // xy trailing cursor, z strength, w normalised speed
uniform vec4  uPtrK;     // radius, base amplitude, speed amplitude, rim lift

#define PI 3.14159265

float sdPill(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.) + length(max(q, 0.)) - r;
}

/* An expanding ring from each press, in button-height units.

   Two things keep it from reading as a water ripple: the wavefront is faceted
   rather than circular — its radius is modulated by angle, and the facets
   rotate as it travels — and the crest profile is a cusp rather than a
   gaussian, so it lands as a crease in sheet metal instead of a soft swell. */
float ripple(vec2 p, float t){
  float sum = 0.;
  for(int i = 0; i < 3; i++){
    if(uRip[i].w < 0.5) continue;
    float age = t - uRip[i].z;
    if(age < 0. || age > 4.) continue;
    vec2  rp = p - uRip[i].xy;
    float facet = 1. + uRipK2.x * cos(uRipK2.y * atan(rp.y, rp.x) + age * 2.1 + float(i) * 2.4);
    float x = (length(rp) - age * uRipK.x * facet) / uRipK.y;
    sum += exp(-pow(abs(x) + 1e-4, uRipK2.z)) * exp(-age * uRipK.z);
  }
  return sum;
}

/* A soft well under the cursor. It lags behind the real pointer and swells
   with speed, so moving across the button drags the metal rather than sliding
   a static blob over it. */
float pointerW(vec2 p){
  if(uPtr.z < 0.001) return 0.;
  float d = length(p - uPtr.xy) / uPtrK.x;
  return exp(-d * d) * uPtr.z;
}
/* Displacing the sample point, not the field value, is what makes this read as
   liquid: the bands bulge and stretch around the cursor like a lens instead of
   just getting brighter under it. */
vec2 pointerWarp(vec2 p){
  float w = pointerW(p);
  if(w <= 0.) return vec2(0.);
  return normalize(p - uPtr.xy + vec2(1e-5)) * w * (uPtrK.y + uPtrK.z * uPtr.w);
}
`;

/** The travelling rim, in its own pass so the softening blur never touches it. */
export const FRAG_RIM = `${HEAD}
uniform float uBw;       // stroke half-width, device px
uniform float uE[8];

/* Arc-length position around the pill, 0..1, starting at the right-hand
   extreme and running counter-clockwise. Straight runs and caps are measured
   in real length, so a highlight travels at a constant speed all the way round
   instead of stalling on the caps. */
float perim(vec2 d, float a, float r){
  float P = 4. * a + 2. * PI * r;
  float s;
  if(d.x >= a){                                   // right cap
    float th = atan(d.y, d.x - a); if(th < 0.) th += 2. * PI;
    s = (th <= PI * 0.5) ? r * th : P - r * (2. * PI - th);
  } else if(d.x <= -a){                           // left cap
    float th = atan(d.y, d.x + a); if(th < 0.) th += 2. * PI;
    s = r * PI * 0.5 + 2. * a + r * (th - PI * 0.5);
  } else if(d.y >= 0.){                           // top run
    s = r * PI * 0.5 + (a - d.x);
  } else {                                        // bottom run
    s = r * PI * 1.5 + 2. * a + (d.x + a);
  }
  return s / P;
}
// periodic bump, so a highlight wraps cleanly at s = 0
float pb(float u, float w){ u = fract(u); float x = min(u, 1. - u); return exp(-(x * x) / (w * w)); }

// Travelling brightness around the rim — three lobes at different speeds and
// widths, which never quite re-align, so the light keeps re-pooling.
float rimHot(float s, float t){
  float v = uE[0];
  v += 0.62 * pb(s - t * uE[4],               0.075);
  v += 0.44 * pb(s + t * uE[4] * 0.63 + 0.41, 0.135);
  v += 0.30 * pb(s - t * uE[4] * 0.34 + 0.73, 0.200);
  return v;
}
// soft band riding the pill edge, offset per channel to fringe across the stroke
float rimBand(float sd, float off){ return 1. - smoothstep(0., uBw * 1.05, abs(sd + uBw * 0.55 + off)); }

void main(){
  vec2  d  = gl_FragCoord.xy - uC;
  float sd = sdPill(d, uHalf, uHalf.y);
  if(sd > uBw * 2.5 || sd < -uBw * 3.5){ o = vec4(0.); return; }

  /* Each channel is offset both ACROSS the stroke and ALONG it, so the rim
     fringes red-outside / cyan-inside and its hue also drifts as a highlight
     slides past — the two together are what read as metal rather than as a
     moving white dot. */
  float a = max(uHalf.x - uHalf.y, 0.);
  float s = perim(d, a, uHalf.y);
  float top = mix(1., 0.5 + 0.5 * (d.y / uHalf.y), uE[5]);

  // Pressing lifts the whole outline, and each ripple flares it again as the
  // ring sweeps past — so the rim reports the press twice, once as a step and
  // once as a wave running round the edge. The stretch of outline nearest the
  // cursor picks up a little too.
  vec2  p = vec2(d.x, -d.y) / (uHalf.y * 2.);
  float lift = 1. + uPress * uE[6] + ripple(p, uT) * uE[7] + pointerW(p) * uPtrK.w;

  o = vec4(vec3(
    rimBand(sd,  uE[2]) * rimHot(s + uE[3], uT),
    rimBand(sd,  0.   ) * rimHot(s,         uT),
    rimBand(sd, -uE[2]) * rimHot(s - uE[3], uT)
  ) * uE[1] * top * lift, 1.);
}`;

export const FRAG_SCENE = `${HEAD}
uniform float uP[21];

float h21(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vn(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  float a = h21(i), b = h21(i + vec2(1, 0)), c = h21(i + vec2(0, 1)), d = h21(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) * 2. - 1.;
}
// Normalised to roughly -1..1. Low gain keeps the first octave dominant, which
// is what keeps the ribbons big and smooth instead of turbulent.
float fbm(vec2 p, float g){
  float s = 0., a = 1., n = 0.;
  for(int i = 0; i < 4; i++){ s += a * vn(p); n += a; p = p * 2.03 + 11.7; a *= g; }
  return s / n;
}
float fbm(vec2 p){ return fbm(p, 0.5); }

// smooth 1-D wiggle that drifts slowly with time
float wig(float x, float t, float seed){
  return vn(vec2(x,             t * 0.150 + seed)) * 0.60
       + vn(vec2(x * 2.07 + 4., t * 0.105 + seed)) * 0.27
       + vn(vec2(x * 4.30 - 7., t * 0.080 + seed)) * 0.13;
}

float valleyAt(vec2 p, float t){ return wig(p.x * uP[0], t, 0.0) * uP[1]; }
float densAt  (vec2 p, float t){ return uP[2] * exp(uP[3] * wig(p.x * uP[4] + 9.0, t, 2.7)); }

/* Level sets of V are all vertical translates of the same valley curve, which
   is what makes the ribbons laminar and near-parallel; a density that varies
   along x is what makes them crowd into razor fringes at one end and open into
   a broad wash at the other. */
float surface(vec2 p, float t){
  float V = (p.y - valleyAt(p, t)) * densAt(p, t);
  V += uP[5] * fbm(p * vec2(0.8, 1.7) * uP[6] + vec2(t * 0.05, -t * 0.03), uP[17]);
  return V - uP[7];
}
// One plateau per unit of V — so the density is literally bands per button
// height. A plateau rather than a step is what puts warm on the low edge and
// cool on the high edge of every ribbon.
float tone(float v){
  float u = fract(v);
  float e = uP[9], W = uP[10] * 0.5;
  return smoothstep(0.5 - W - e, 0.5 - W, u) * (1. - smoothstep(0.5 + W, 0.5 + W + e, u));
}
vec3 spec(float t){ return clamp(vec3(1.5) - abs(4. * t - vec3(3., 2., 1.)), 0., 1.); }

void main(){
  vec2  d  = gl_FragCoord.xy - uC;
  float sd = sdPill(d, uHalf, uHalf.y);
  float pill = 1. - smoothstep(-1., 1., sd);
  float S = uHalf.y * 2.;                 // button height, device px
  float t = uT;

  // rgb is premultiplied by the mask and alpha carries it, so the blur that
  // follows can normalise and keep a clean edge instead of a dark vignette
  if(uHover <= 0.0015 || pill <= 0.0015){ o = vec4(0., 0., 0., pill); return; }

  vec2  p = vec2(d.x, -d.y) / S;          // gl_FragCoord is y-up
  vec2  q = p + pointerWarp(p);           // the cursor drags the sheet

  // self-refraction: bend the lookup along the field's own slope, which piles
  // iso-lines up into folds instead of leaving them evenly spaced
  float h0 = surface(q, t);
  vec2  gp = vec2(dFdx(h0), -dFdy(h0)) * S;
  float V  = surface(q - gp * uP[8] / max(uP[2], .001), t);

  // gradient-aligned filaments: fast variation across the iso-lines, slow
  // along them, so the fine detail reads as drawn-out fibres of light
  vec2  gd = normalize(gp + vec2(1e-5));
  V += uP[13] * fbm(vec2(dot(q, gd) * uP[14], dot(q, vec2(-gd.y, gd.x)) * uP[14] * 0.04) + vec2(0., t * 0.06));

  // Press ripple: displacing the field rather than adding light means the bands
  // themselves bow outwards as the ring passes, which is what sells it as a
  // disturbance IN the metal instead of a decal over it.
  float rip  = ripple(p, t);
  float well = pointerW(p);
  V += rip * uRipK.w;

  // Real dispersion is not linear in wavelength — the blue end bends far more
  // than the red. Skewing the sample offsets the same way is what gives a
  // broad cool wash against a tight warm edge.
  const int N = 21;
  float mid = 1. - pow(0.5, uP[12]);
  vec3 col = vec3(0.), wsum = vec3(0.);
  for(int i = 0; i < N; i++){
    float k = float(i) / float(N - 1);
    vec3  w = spec(k);
    col  += w * tone(V + ((1. - pow(1. - k, uP[12])) - mid) * uP[11]);
    wsum += w;
  }
  col /= wsum;
  col = pow(col, vec3(uP[15]));

  // Light envelope — the ribbons only exist where the sheet is lit, and the
  // dark upper region is bounded by the same valley curve the bands follow.
  float lit = smoothstep(uP[18], uP[19], q.y - valleyAt(q, t));
  lit *= mix(1., lit, 0.55);
  col *= uP[16] * lit;

  // The crest runs hotter, and carries a little light of its own so it stays
  // legible through the softening blur and across the unlit part of the pill.
  col = col * (1. + rip * 1.15 + well * 0.60);

  o = vec4(col * pill * uHover, pill);
}`;

/**
 * Downsample, optionally adding a second source — used to fold the rim into
 * the bloom input. Alpha rides along so the metal's coverage mask survives the
 * blur chain.
 */
export const FRAG_DOWN = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uTex, uTex2;
uniform vec2 uDstTexel;   // 1 / destination size (maps dest fragCoord to uv)
uniform vec2 uSrcTexel;   // 1 / source size
uniform float uAdd;       // 1 to include uTex2
void main(){
  vec2 uv = gl_FragCoord.xy * uDstTexel;
  // Taps sit a quarter of a DESTINATION texel out, so for a 2x reduction they
  // land exactly on the four source texel centres. Spacing them by a whole
  // source texel instead skips every other pixel, and any fine detail in the
  // field folds down into low-frequency moire that no later blur can remove.
  vec2 e = uDstTexel * 0.25;
  vec4 s = texture(uTex, uv + vec2(-e.x, -e.y)) + texture(uTex, uv + vec2( e.x, -e.y))
         + texture(uTex, uv + vec2(-e.x,  e.y)) + texture(uTex, uv + vec2( e.x,  e.y));
  s *= 0.25;
  if(uAdd > 0.5){
    vec4 r = texture(uTex2, uv + vec2(-e.x, -e.y)) + texture(uTex2, uv + vec2( e.x, -e.y))
           + texture(uTex2, uv + vec2(-e.x,  e.y)) + texture(uTex2, uv + vec2( e.x,  e.y));
    s.rgb += r.rgb * 0.25;
  }
  o = s;
}`;

export const FRAG_BLUR = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel; uniform vec2 uDir; uniform float uR;
void main(){
  vec2 uv = gl_FragCoord.xy * uTexel;
  vec2 st = uTexel * uDir * uR;
  vec4 s = texture(uTex, uv) * 0.1964;
  s += (texture(uTex, uv + st * 1.4118) + texture(uTex, uv - st * 1.4118)) * 0.2969;
  s += (texture(uTex, uv + st * 3.2941) + texture(uTex, uv - st * 3.2941)) * 0.0944;
  s += (texture(uTex, uv + st * 5.1765) + texture(uTex, uv - st * 5.1765)) * 0.0104;
  o = s;
}`;

export const FRAG_COMP = `${HEAD}
uniform sampler2D uSoft, uRim, uGlow;
uniform vec2  uRes;
uniform float uGlowGain, uGlowIn, uOccl, uDim, uPunch, uRimGain;

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 glow = texture(uGlow, uv).rgb;

  vec2  d    = gl_FragCoord.xy - uC;
  float sd   = sdPill(d, uHalf, uHalf.y);
  float pill = 1. - smoothstep(-1., 1., sd);

  // Normalised blur: dividing by the blurred coverage keeps the softened metal
  // at full strength right up to the edge instead of fading into the mask.
  vec4 m = texture(uSoft, uv);

  // Scrim, applied AFTER the blur: knock the metal back through the middle
  // where the label sits, leaving the top and bottom at full brightness. Doing
  // it before the blur would smear the protection away at high blur values.
  float veil = 1. - smoothstep(0.46, 0.88, abs(d.y) / uHalf.y);

  // Blurring flattens the tonal range into a wash; putting the contrast back
  // with a power curve — after the blur, so it costs no smoothness — is what
  // makes it read as poured metal rather than a soft glow.
  vec3 metal = pow(max(m.rgb / max(m.a, 1e-3), 0.), vec3(uPunch));

  vec3 core = metal * pill * mix(1., uDim, veil) + texture(uRim, uv).rgb * uRimGain;

  // The ripple's own light is added here, after the blur, so the crease stays a
  // hard line. Its displacement of the field still rides inside the softened
  // metal — the sheet bows, and the crest glints along the fold.
  float rip = ripple(vec2(d.x, -d.y) / (uHalf.y * 2.), uT);
  core += vec3(rip * rip) * uRipK2.w * pill * mix(1., 0.42, veil);

  // The button occludes its own bloom over the patch where its shadow falls, so
  // the drop shadow keeps its contrast even when the face is blown out.
  float sdSh = sdPill(d + vec2(0., uHalf.y * 0.62), uHalf * 0.94, uHalf.y * 0.94);
  float occl = uOccl * exp(-max(sdSh, 0.) / (uHalf.y * 0.75));

  // Bloom spills mostly outward; a little is allowed back inside so the hot rim
  // bleeds onto the face.
  vec3 rgb = core + glow * uGlowGain * mix(1., uGlowIn, pill) * (1. - occl * (1. - pill));

  // Premultiplied — the plate and its drop shadow are CSS underneath, and this
  // layer adds light on top of them.
  float a = clamp(max(rgb.r, max(rgb.g, rgb.b)), 0., 1.);
  o = vec4(min(rgb, vec3(1.)), a);
}`;
