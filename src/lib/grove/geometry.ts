import * as THREE from "three";

/**
 * The root is grown, not modelled.
 *
 * Everything the scene draws is derived at runtime from a handful of traced
 * control points: a tapered tube swept along each centreline, a moss cushion
 * that thickens wherever the surface turns toward the light, tens of thousands
 * of instanced blades planted on that cushion, and the ferns, flowers and
 * survey cage that sit on the same surface. No model file, no moss texture —
 * which is also why the study loads nothing but its own code.
 *
 * The whole landscape is a pure function of ONE seed. Two visitors on two
 * machines see the same root, and so does a screenshot taken a year from now;
 * the alternative (Math.random) would have made every bug report unreproducible.
 *
 * Nothing here touches the DOM or three's renderer — it returns plain typed
 * arrays, which is what lets the heavy half of this study be read, and
 * reasoned about, without a WebGL context in the picture.
 */

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);

/** Every limb is modelled in a box 10 local units wide, origin at its centre. */
export const BOX_W = 10;

/**
 * Box proportions, kept at the ratios the control points were traced against.
 * Rounding either to a flat 2 shears every measured point by a couple of
 * percent — small on the crest, and enough at the arch to open a gap where its
 * two legs are supposed to fuse.
 */
const ASPECT_NEAR = 2800 / 1377;
const ASPECT_FAR = 1600 / 757;

/* ────────────────────────────────────────────────────────────────────────
   deterministic noise
   ──────────────────────────────────────────────────────────────────────── */

/** mulberry32 — small, fast, and seeded, which is the whole point. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Integer hash rather than the usual `fract(sin(dot(…)))`: the lattice is only
 * ever sampled at whole coordinates, so the transcendental buys nothing, and
 * at ~200k noise lookups per build it was the single most expensive line here.
 */
function hash2(x: number, y: number): number {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  const top = a + (b - a) * ux;
  return top + (c + (d - c) * ux - top) * uy;
}

/**
 * Four octaves, each one rotated as well as scaled. Without the rotation the
 * lattice lines of every octave stack on the same axes and the "organic" field
 * resolves into a visible grid the moment it is used for moss coverage.
 */
function fbm2(x: number, y: number): number {
  let s = 0;
  let amp = 0.5;
  let px = x;
  let py = y;
  for (let i = 0; i < 4; i++) {
    s += amp * vnoise(px, py);
    const nx = 0.8 * px + 0.6 * py;
    const ny = -0.6 * px + 0.8 * py;
    px = nx * 2.07 + 3.1;
    py = ny * 2.07 - 1.7;
    amp *= 0.5;
  }
  return s / 0.9375;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/* ────────────────────────────────────────────────────────────────────────
   the moss cushion
   ──────────────────────────────────────────────────────────────────────── */

/**
 * How mossy a point on the bark is, 0–1.
 *
 * Driven by how far the surface faces the light rather than by the tube's own
 * parameters. That distinction matters at the arch: its legs run through the
 * vertical, where every cross-section normal is horizontal, so an "up" defined
 * on the cross-section goes degenerate and the legs come out bald.
 *
 * Two noise scales ride on top. The fine one frays the moss line so it never
 * reads as a painted stripe; the coarse one lets the cushion send tongues down
 * the flank and lets bare wood push up through it. Both are sampled in world
 * space, so limbs that touch share the same weather instead of each carrying
 * its own private pattern.
 */
function mossCap(p: THREE.Vector3, n: THREE.Vector3, steep: number): number {
  const upness = n.y + n.z * (0.1 + 0.42 * steep) - n.x * (0.05 + 0.45 * steep);
  const fray = fbm2(p.x * 2.3 + 4.4, p.z * 2.3 - p.y * 1.9) - 0.5;
  const tongue = fbm2(p.x * 0.95 + 21, p.z * 0.95 - p.y * 0.8) - 0.5;
  const patch = fbm2(p.x * 0.52 + 9.3, p.z * 0.52 + p.y * 0.44);
  const c = smoothstep(0.16, 0.7, upness + fray * 0.4 + tongue * 0.52);
  // No floor under the patch term: the cushion has to go properly bald in
  // places or the bark is never seen, and the bark is half of what makes the
  // root read as wood rather than as topiary.
  return c * smoothstep(0.1, 0.5, patch);
}

/**
 * Lumpiness of the cushion itself. Moss is never a smooth offset from the wood
 * it grows on — without this the tube reads as an extruded pipe with a green
 * stripe painted along it, however good the fur on top looks.
 */
function mossLump(p: THREE.Vector3): number {
  return (
    0.66 +
    0.48 * fbm2(p.x * 2.4 - 2.2, p.z * 2.4 + p.y * 2) +
    0.18 * fbm2(p.x * 7.3 + 5.1, p.z * 7.3 - p.y * 4.4) -
    0.09
  );
}

/* ────────────────────────────────────────────────────────────────────────
   limbs
   ──────────────────────────────────────────────────────────────────────── */

type Frames = {
  points: THREE.Vector3[];
  tangents: THREE.Vector3[];
  normals: THREE.Vector3[];
};

type Limb = {
  curve: THREE.CatmullRomCurve3;
  segs: number;
  radial: number;
  /** bark radius at t */
  radius: (t: number) => number;
  /** how deep the moss lies on top of the bark at t */
  moss: (t: number) => number;
  /** blade height at t */
  blade: (t: number) => number;
  /** v-repeat for the bark grain, so long limbs are not stretched */
  vScale: number;
  /** how far to drop the tube's axis below the traced centreline */
  sink: number;
  frames: Frames;
  length: number;
  /** scratch, filled by tessellate() and read by plantBlades()/buildWire() */
  grid: Float32Array | null;
  gridNormal: Float32Array | null;
  gridCap: Float32Array | null;
};

/**
 * Parallel-transport frames.
 *
 * The textbook Frenet frame is unusable here: its normal is defined by the
 * curve's second derivative, which flips through 180° at every inflection
 * point — and a swept tube built on a flipping normal turns itself inside out
 * there. Transporting one arbitrary starting normal along the curve instead
 * gives a frame that only ever rotates by the minimum needed to stay
 * perpendicular, so the tube keeps its skin.
 */
function transportFrames(curve: THREE.CatmullRomCurve3, segs: number): Frames {
  const points: THREE.Vector3[] = [];
  const tangents: THREE.Vector3[] = [];
  const normals: THREE.Vector3[] = [];

  for (let i = 0; i <= segs; i++) {
    points.push(curve.getPointAt(i / segs));
    tangents.push(curve.getTangentAt(i / segs).normalize());
  }

  const ref = Math.abs(tangents[0].y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0);
  normals.push(new THREE.Vector3().crossVectors(tangents[0], ref).normalize());

  for (let i = 1; i <= segs; i++) {
    const axis = new THREE.Vector3().crossVectors(tangents[i - 1], tangents[i]);
    const n = normals[i - 1].clone();
    if (axis.lengthSq() > 1e-12) {
      axis.normalize();
      const dot = Math.min(1, Math.max(-1, tangents[i - 1].dot(tangents[i])));
      n.applyAxisAngle(axis, Math.acos(dot));
    }
    normals.push(n.normalize());
  }

  return { points, tangents, normals };
}

/** Piecewise-linear lookup over a table of measurements taken along a limb. */
function table(values: number[]): (t: number) => number {
  return (t: number) => {
    const x = clamp01(t) * (values.length - 1);
    const i = Math.min(values.length - 2, Math.floor(x));
    return values[i] + (values[i + 1] - values[i]) * (x - i);
  };
}

/**
 * A little high-frequency wobble on the radius. Real roots are knotted; a tube
 * of exactly interpolated radius reads as a hose no matter how good its
 * material is.
 */
function knot(t: number, a: number, b: number): number {
  return (
    1 +
    a * Math.sin(t * 23 + 1.3) +
    b * Math.sin(t * 57 + 0.4) +
    b * 0.5 * Math.sin(t * 103 + 2.2)
  );
}

type LimbOptions = {
  segs: number;
  radial: number;
  vScale: number;
  /** half-height of the wood-plus-moss band, sampled evenly along the run */
  band?: number[];
  radius?: (t: number) => number;
  moss?: (t: number) => number;
  blade?: (t: number) => number;
  /** drop the tube's axis by this fraction of the cushion depth */
  sink?: number;
};

/** Assemble a limb around an already-solved centreline. */
function rawLimb(
  curve: THREE.CatmullRomCurve3,
  opt: LimbOptions & { radius: (t: number) => number; moss: (t: number) => number }
): Limb {
  return {
    curve,
    segs: opt.segs,
    radial: opt.radial,
    radius: opt.radius,
    moss: opt.moss,
    blade: opt.blade ?? ((t: number) => opt.moss(t) * 0.055 + 0.014),
    vScale: opt.vScale,
    sink: opt.sink ?? 0,
    frames: transportFrames(curve, opt.segs),
    length: curve.getLength(),
    grid: null,
    gridNormal: null,
    gridCap: null,
  };
}

function makeLimb(
  place: (fx: number, fy: number, z?: number) => THREE.Vector3,
  pts: [number, number, number][],
  opt: LimbOptions
): Limb {
  const curve = new THREE.CatmullRomCurve3(
    pts.map((q) => place(q[0], q[1], q[2])),
    false,
    "centripetal",
    0.5
  );

  let radius = opt.radius;
  let moss = opt.moss;
  if (opt.band) {
    // Splitting the measured band 0.52 bark / 0.88 cushion puts moss over
    // roughly the top 45% of it and bare wood under — the section a mossy root
    // actually has, rather than a green tube.
    const band = table(opt.band);
    radius = (t) => band(t) * 0.52 * knot(t, 0.05, 0.024);
    moss = (t) => band(t) * 0.88;
  }
  if (!radius || !moss) throw new Error("limb needs either a band or radius+moss");

  return rawLimb(curve, { ...opt, radius, moss });
}

// Scratch vectors — this runs tens of thousands of times per build, and
// allocating four Vector3s per call is what turns a 200ms build into a 900ms one.
const _p = new THREE.Vector3();
const _t = new THREE.Vector3();
const _n = new THREE.Vector3();
const _b = new THREE.Vector3();

function limbFrame(limb: Limb, t: number): void {
  const f = clamp01(t) * limb.segs;
  const i = Math.min(limb.segs - 1, Math.floor(f));
  const a = f - i;
  const fr = limb.frames;
  _p.copy(fr.points[i]).lerp(fr.points[i + 1], a);
  // Control points are traced along the MIDLINE of the silhouette, but the
  // silhouette is asymmetric — bare wood below, wood plus cushion above. The
  // tube's own axis therefore sits half a cushion lower than the trace.
  if (limb.sink) _p.y -= limb.moss(t) * limb.sink;
  _t.copy(fr.tangents[i]).lerp(fr.tangents[i + 1], a).normalize();
  _n.copy(fr.normals[i]).lerp(fr.normals[i + 1], a);
  // Re-orthogonalise: lerping two unit normals gives a vector that is neither
  // unit nor perpendicular to the lerped tangent.
  _n.addScaledVector(_t, -_n.dot(_t)).normalize();
  _b.crossVectors(_t, _n).normalize();
}

/**
 * The finished surface at (t, theta): bark radius plus whatever cushion sits on
 * it there. Returns the moss coverage so callers can reuse it without paying
 * for the two fBm fields a second time.
 */
function limbSurface(
  limb: Limb,
  t: number,
  theta: number,
  outP: THREE.Vector3,
  outN: THREE.Vector3
): number {
  limbFrame(limb, t);
  const steep = Math.min(1, Math.abs(_t.y) * 1.15);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  outN.set(_n.x * c + _b.x * s, _n.y * c + _b.y * s, _n.z * c + _b.z * s).normalize();

  const rw = limb.radius(t);
  outP.copy(_p).addScaledVector(outN, rw);
  const cap = mossCap(outP, outN, steep);
  outP.copy(_p).addScaledVector(outN, rw + limb.moss(t) * cap * mossLump(outP));
  return cap;
}

/* ────────────────────────────────────────────────────────────────────────
   output buffers
   ──────────────────────────────────────────────────────────────────────── */

export type BarkBuffers = {
  position: Float32Array;
  normal: Float32Array;
  /** x: mirrored u, y: v along the limb, z: moss coverage */
  info: Float32Array;
  index: Uint32Array;
};

export type BladeBuffers = {
  offset: Float32Array;
  normal: Float32Array;
  /** x: yaw, y: length, z: lean, w: per-blade tone */
  random: Float32Array;
  /** two scales of clumping, folded into one value */
  clump: Float32Array;
  count: number;
};

export type SpriteBuffers = {
  offset: Float32Array;
  /** x: size, y: seed */
  random: Float32Array;
  count: number;
};

export type FernBuffers = {
  /** the frond itself, shared by every instance */
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  index: Uint32Array;
  /** where each frond is seated */
  offset: Float32Array;
  /** how it is turned, as a quaternion */
  quat: Float32Array;
  /** x: size, y: tint */
  random: Float32Array;
  count: number;
};

export type Grove = {
  bark: BarkBuffers;
  blades: BladeBuffers;
  flowers: SpriteBuffers;
  ferns: FernBuffers;
  /** ring-and-spar line pairs lifted off the shell, for the survey pass */
  wire: Float32Array;
  /** where the butterfly comes to rest: the highest point of the crest */
  perch: THREE.Vector3;
  /** local-space bounding radius, for framing the camera */
  reach: number;
  /** height of the modelling box, which the shaders need for the aerial term */
  boxH: number;
};

type Bag = {
  pos: number[];
  nor: number[];
  inf: number[];
  idx: number[];
};

/**
 * Build the (segs+1) × (radial+1) grid, then take each vertex normal from the
 * grid itself rather than from the smooth cross-section. The displacement is
 * the entire point — lighting the underlying tube instead throws away every
 * lump the cushion just built.
 */
function tessellate(limb: Limb, bag: Bag): void {
  const S = limb.segs;
  const R = limb.radial;
  const base = bag.pos.length / 3;
  const grid = new Float32Array((S + 1) * (R + 1) * 3);
  const gnrm = new Float32Array((S + 1) * (R + 1) * 3);
  const caps = new Float32Array((S + 1) * (R + 1));
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i <= S; i++) {
    for (let j = 0; j <= R; j++) {
      const cap = limbSurface(limb, i / S, (j / R) * TAU, p, n);
      const k = (i * (R + 1) + j) * 3;
      grid[k] = p.x;
      grid[k + 1] = p.y;
      grid[k + 2] = p.z;
      caps[i * (R + 1) + j] = cap;
    }
  }

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const du = new THREE.Vector3();
  const dv = new THREE.Vector3();
  const get = (i2: number, j2: number, out: THREE.Vector3) => {
    const ii = Math.min(S, Math.max(0, i2));
    const jj = (j2 + R) % R; // theta wraps — no seam in the normals
    const q = (ii * (R + 1) + jj) * 3;
    return out.set(grid[q], grid[q + 1], grid[q + 2]);
  };

  for (let i = 0; i <= S; i++) {
    for (let j = 0; j <= R; j++) {
      get(i + 1, j, a);
      get(i - 1, j, b);
      du.subVectors(a, b);
      get(i, j + 1, a);
      get(i, j - 1, b);
      dv.subVectors(a, b);
      n.crossVectors(dv, du);
      if (n.lengthSq() < 1e-12) limbSurface(limb, i / S, (j / R) * TAU, p, n);
      else n.normalize();

      const k = (i * (R + 1) + j) * 3;
      bag.pos.push(grid[k], grid[k + 1], grid[k + 2]);
      bag.nor.push(n.x, n.y, n.z);
      // u is a triangle wave so the bark grain mirrors at the seam instead of
      // showing a hard join where the texture coordinate wraps.
      bag.inf.push(
        1 - Math.abs(2 * (j / R) - 1),
        (i / S) * limb.vScale,
        caps[i * (R + 1) + j]
      );
      gnrm[k] = n.x;
      gnrm[k + 1] = n.y;
      gnrm[k + 2] = n.z;
    }
  }

  for (let i = 0; i < S; i++) {
    for (let j = 0; j < R; j++) {
      const q0 = base + i * (R + 1) + j;
      const q1 = q0 + R + 1;
      bag.idx.push(q0, q1, q0 + 1, q1, q1 + 1, q0 + 1);
    }
  }

  limb.grid = grid;
  limb.gridNormal = gnrm;
  limb.gridCap = caps;
}

type FurBag = {
  off: number[];
  nrm: number[];
  rnd: number[];
  aux: number[];
};

/**
 * Blades are planted straight onto the shell grid the tessellator just built.
 *
 * The obvious alternative — rejection-sample the surface function until a spot
 * is mossy enough — costs three more evaluations of two fBm fields per
 * accepted blade, which at this density is most of a second of blocked main
 * thread. Sampling the existing grid is O(1) per blade and, more importantly,
 * guarantees the fur sits exactly on the surface that actually gets drawn
 * rather than on a re-evaluation of it.
 *
 * Cells are drawn in proportion to area × coverage², so density follows the
 * cushion instead of the tube's parameterisation (where a fine-segmented
 * stretch would otherwise collect a stripe of extra fur).
 */
function plantBlades(
  limb: Limb,
  count: number,
  bag: FurBag,
  rng: () => number
): number {
  const grid = limb.grid;
  const gn = limb.gridNormal;
  const caps = limb.gridCap;
  if (!grid || !gn || !caps) return 0;

  const S = limb.segs;
  const R = limb.radial;
  const cells = S * R;
  const cdf = new Float64Array(cells);
  let total = 0;

  for (let i = 0; i < S; i++) {
    for (let j = 0; j < R; j++) {
      const q00 = (i * (R + 1) + j) * 3;
      const q10 = q00 + 3;
      const q01 = ((i + 1) * (R + 1) + j) * 3;
      const ax = grid[q10] - grid[q00];
      const ay = grid[q10 + 1] - grid[q00 + 1];
      const az = grid[q10 + 2] - grid[q00 + 2];
      const bx = grid[q01] - grid[q00];
      const by = grid[q01 + 1] - grid[q00 + 1];
      const bz = grid[q01 + 2] - grid[q00 + 2];
      const cx = ay * bz - az * by;
      const cy = az * bx - ax * bz;
      const cz = ax * by - ay * bx;
      const area = Math.sqrt(cx * cx + cy * cy + cz * cz);
      const cap =
        0.25 *
        (caps[i * (R + 1) + j] +
          caps[i * (R + 1) + j + 1] +
          caps[(i + 1) * (R + 1) + j] +
          caps[(i + 1) * (R + 1) + j + 1]);
      total += area * cap * cap;
      cdf[i * R + j] = total;
    }
  }
  if (total <= 0) return 0;

  let planted = 0;
  for (let b = 0; b < count; b++) {
    const target = rng() * total;
    let lo = 0;
    let hi = cells - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const i = (lo / R) | 0;
    const j = lo - i * R;
    const u = rng();
    const v = rng();

    const i0 = i * (R + 1) + j;
    const i1 = i0 + 1;
    const i2 = i0 + R + 1;
    const i3 = i2 + 1;
    const w0 = (1 - u) * (1 - v);
    const w1 = u * (1 - v);
    const w2 = (1 - u) * v;
    const w3 = u * v;
    const cap = caps[i0] * w0 + caps[i1] * w1 + caps[i2] * w2 + caps[i3] * w3;
    if (cap < 0.05) continue;

    const p0 = i0 * 3;
    const p1 = i1 * 3;
    const p2 = i2 * 3;
    const p3 = i3 * 3;
    const px = grid[p0] * w0 + grid[p1] * w1 + grid[p2] * w2 + grid[p3] * w3;
    const py = grid[p0 + 1] * w0 + grid[p1 + 1] * w1 + grid[p2 + 1] * w2 + grid[p3 + 1] * w3;
    const pz = grid[p0 + 2] * w0 + grid[p1 + 2] * w1 + grid[p2 + 2] * w2 + grid[p3 + 2] * w3;
    // The grid normal is the cushion's own normal, lumps included. Standing
    // the fur on the smooth cross-section normal instead flattens every bump
    // the displacement just produced.
    const nx = gn[p0] * w0 + gn[p1] * w1 + gn[p2] * w2 + gn[p3] * w3;
    const ny = gn[p0 + 1] * w0 + gn[p1 + 1] * w1 + gn[p2 + 1] * w2 + gn[p3 + 1] * w3;
    const nz = gn[p0 + 2] * w0 + gn[p1 + 2] * w1 + gn[p2 + 2] * w2 + gn[p3 + 2] * w3;
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

    bag.off.push(px, py, pz);
    bag.nrm.push(nx / nl, ny / nl, nz / nl);
    // One blade in sixteen is a long stray. Uniform-length fur cuts a hard
    // edge against the background; the strays are what make the silhouette
    // read as moss rather than as a hedge trimmed with shears.
    const stray = rng() < 0.06 ? 1.4 + rng() * 0.5 : 1;
    bag.rnd.push(
      rng() * TAU,
      limb.blade((i + v) / S) * (0.45 + 0.6 * cap) * (0.58 + 0.5 * rng()) * stray,
      (rng() - 0.5) * 1.15,
      rng()
    );
    // Two scales of clumping: broad cushions, and the tufts inside them.
    bag.aux.push(
      fbm2(px * 0.85 + 17, pz * 0.85 - py * 0.7) * 0.62 +
        fbm2(px * 5.6 - 3.3, pz * 5.6 + py * 2.1) * 0.38
    );
    planted++;
  }
  return planted;
}

/**
 * The survey cage: every Nth cross-section ring, plus a handful of spars
 * running the length of the limb, read straight off the shell grid.
 *
 * Deriving the cage from the same grid the mesh came from is what makes the
 * two register exactly — a wireframe rebuilt from the curve at a different
 * tessellation floats off the cushion wherever the displacement is deep, which
 * is precisely where the eye is looking during the pass.
 */
function buildWire(limb: Limb, out: number[]): void {
  const g = limb.grid;
  if (!g) return;
  const S = limb.segs;
  const R = limb.radial;
  const ringEvery = Math.max(2, Math.round(S / 52));
  const sparEvery = Math.max(2, Math.round(R / 9));

  for (let i = 0; i <= S; i += ringEvery) {
    for (let j = 0; j < R; j++) {
      const a = (i * (R + 1) + j) * 3;
      const b = a + 3;
      out.push(g[a], g[a + 1], g[a + 2], g[b], g[b + 1], g[b + 2]);
    }
  }
  for (let j = 0; j < R; j += sparEvery) {
    for (let i = 0; i < S; i++) {
      const a = (i * (R + 1) + j) * 3;
      const b = ((i + 1) * (R + 1) + j) * 3;
      out.push(g[a], g[a + 1], g[a + 2], g[b], g[b + 1], g[b + 2]);
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────
   ferns
   ──────────────────────────────────────────────────────────────────────── */

/**
 * One frond, built as pinnae pairs on a bowing rachis plus a thin stipe.
 *
 * Modelled rather than alpha-cut from a texture for the same reason the wings
 * are: at this size a cut-out needs a texture for a fixed silhouette, and it
 * puts a transparent quad into the depth sort exactly where the moss is
 * densest. A few hundred triangles of real outline sort correctly and cost
 * nothing.
 */
function fernGeometry(): {
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  index: Uint32Array;
} {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const PAIRS = 13;
  const SEG = 3;

  const rachis = (s: number, out: THREE.Vector3) =>
    out.set(0, s * (1.06 - 0.44 * s * s), 0.36 * s * s);

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  for (let i = 1; i <= PAIRS; i++) {
    const s = i / (PAIRS + 0.6);
    rachis(s, a);
    const pl = 0.36 * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.62)), 0.75) * (1 - 0.18 * s);
    for (let side = -1; side <= 1; side += 2) {
      const base = pos.length / 3;
      for (let k = 0; k <= SEG; k++) {
        const f = k / SEG;
        // pinnae sweep forward and droop as they run out
        const w = 0.088 * pl * Math.pow(Math.sin(Math.PI * Math.min(f * 1.25, 1)), 0.7) * (1 - 0.35 * f);
        rachis(s + f * pl * 0.34, b);
        const x = side * f * pl;
        const y = b.y - 0.22 * pl * f * f;
        const z = b.z + 0.06 * pl * f;
        pos.push(x, y - w, z, x, y + w, z);
        uv.push(f, 0, f, 1);
      }
      for (let k = 0; k < SEG; k++) {
        const q = base + k * 2;
        idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
      }
    }
  }

  // the stipe
  const st = pos.length / 3;
  for (let j = 0; j <= 8; j++) {
    const s = j / 8;
    rachis(s, a);
    pos.push(-0.011 * (1 - 0.6 * s), a.y, a.z, 0.011 * (1 - 0.6 * s), a.y, a.z);
    uv.push(0.5, 0, 0.5, 1);
  }
  for (let j = 0; j < 8; j++) {
    const q = st + j * 2;
    idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
  }

  // Normals off the assembled strips rather than a flat +Z: the rachis bows
  // through nearly a right angle, and a frond lit as though it were planar
  // goes matte at exactly the tip that is supposed to catch the light.
  const position = new Float32Array(pos);
  const index = new Uint32Array(idx);
  const tmp = new THREE.BufferGeometry();
  tmp.setAttribute("position", new THREE.BufferAttribute(position, 3));
  tmp.setIndex(new THREE.BufferAttribute(index, 1));
  tmp.computeVertexNormals();
  const normal = (tmp.getAttribute("normal") as THREE.BufferAttribute).array as Float32Array;
  tmp.dispose();

  return { position, normal, uv: new Float32Array(uv), index };
}

/* ────────────────────────────────────────────────────────────────────────
   the root itself
   ──────────────────────────────────────────────────────────────────────── */

/** Fractional layout coords across the box → local space. */
function makePlacer(aspect: number) {
  const boxH = BOX_W / aspect;
  return (fx: number, fy: number, z = 0) =>
    new THREE.Vector3((fx - 0.5) * BOX_W, (0.5 - fy) * boxH, z);
}

/**
 * A short recursive fork, two generations deep. The root is a root, not a tree,
 * so these stay stubby — they exist to break the tube's silhouette, not to
 * build a canopy. The second generation is what stops them reading as spikes:
 * a single unbranched stub is a thorn, a stub that forks once is a twig.
 */
function growOffshoot(
  list: Limb[],
  start: THREE.Vector3,
  dir: THREE.Vector3,
  len: number,
  r0: number,
  gen: number,
  rng: () => number
): void {
  const rand = (lo: number, hi: number) => lo + (hi - lo) * rng();

  const side = new THREE.Vector3().crossVectors(dir, UP);
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  side.normalize();
  const up = new THREE.Vector3().crossVectors(side, dir).normalize();
  const bow = gen === 0 ? rand(0.1, 0.46) : rand(-0.34, 0.42);
  const kink = rand(-0.26, 0.26);

  const node = (f: number, u2: number, k: number) =>
    start
      .clone()
      .addScaledVector(dir, len * f)
      .addScaledVector(up, len * u2)
      .addScaledVector(side, len * k);

  const curve = new THREE.CatmullRomCurve3(
    [
      start.clone(),
      node(0.32, bow * 0.3, kink * 0.7),
      node(0.68, bow * 0.85, kink * 0.24),
      node(1, bow, kink * 0.44),
    ],
    false,
    "centripetal",
    0.5
  );

  const r1 = r0 * 0.52;
  list.push(
    rawLimb(curve, {
      segs: gen === 0 ? 16 : 11,
      radial: gen === 0 ? 9 : 7,
      vScale: len * 7,
      // Draw the last few percent down to a point: tubes are open-ended, and a
      // twig that simply stops shows a flat hollow cap hanging in the air.
      radius: (t) => (r0 + (r1 - r0) * t) * (1 - 0.86 * smoothstep(0.9, 1, t)),
      moss: (t) => (r0 + (r1 - r0) * t) * 0.95 * (1 - 0.55 * t),
      blade: (t) => (r0 + (r1 - r0) * t) * 0.3 * (1 - 0.55 * t) + 0.035,
    })
  );

  if (gen >= 1) return;
  const kids = Math.round(rand(1, 2));
  for (let i = 0; i < kids; i++) {
    const tt = Math.min(0.98, 0.34 + (i / Math.max(kids, 1)) * 0.5 + rand(-0.06, 0.06));
    const pt = curve.getPointAt(tt);
    const tan = curve.getTangentAt(tt).normalize();
    const ax = new THREE.Vector3().crossVectors(tan, UP);
    if (ax.lengthSq() < 1e-6) ax.set(1, 0, 0);
    ax.normalize().applyAxisAngle(tan, rng() * TAU);
    const kdir = tan
      .clone()
      .applyAxisAngle(ax, rand(0.45, 1.05))
      .addScaledVector(UP, 0.16)
      .normalize();
    growOffshoot(list, pt, kdir, len * rand(0.5, 0.74), (r0 + (r1 - r0) * tt) * rand(0.58, 0.78), gen + 1, rng);
  }
}

/**
 * One long root that enters low on the left, crests at 25% of the frame, dips
 * into a valley at half width and runs out to the right — plus an arch that
 * lifts off it and plants a second leg back through it.
 *
 * The arch is deliberately two interpenetrating limbs rather than one bent
 * tube. A single hoop has one continuous bark grain and one moss line wrapping
 * the whole way round, which reads as a croquet hoop; two limbs fused at the
 * top get their own grain and their own moss line on each side, which is what
 * a pair of roots grown together actually looks like.
 */
function buildNearLimbs(): Limb[] {
  const place = makePlacer(ASPECT_NEAR);
  const limbs: Limb[] = [];

  limbs.push(
    makeLimb(
      place,
      [
        [-0.075, 0.845, -0.62],
        [0.0, 0.79, -0.38],
        [0.107, 0.695, 0.04],
        [0.196, 0.588, 0.28],
        [0.25, 0.566, 0.34],
        [0.304, 0.603, 0.22],
        [0.411, 0.733, -0.1],
        [0.5, 0.779, -0.28],
        [0.585, 0.742, -0.05],
        [0.696, 0.661, 0.2],
        [0.75, 0.672, 0.14],
        [0.85, 0.64, -0.08],
        [0.93, 0.626, -0.3],
        [1.03, 0.634, -0.55],
        [1.09, 0.638, -0.7],
      ],
      {
        segs: 300,
        radial: 26,
        vScale: 30,
        band: [0.575, 0.59, 0.63, 0.68, 0.695, 0.615, 0.58, 0.48, 0.55, 0.55, 0.52],
        sink: 0.5,
      }
    )
  );

  const legRadius = table([0.3, 0.28, 0.26, 0.25, 0.24, 0.23, 0.22]);
  const legMoss = table([0.24, 0.24, 0.23, 0.22, 0.21, 0.2, 0.19]);
  limbs.push(
    makeLimb(
      place,
      [
        [0.532, 0.86, 0.2],
        [0.572, 0.7, 0.28],
        [0.612, 0.54, 0.34],
        [0.652, 0.39, 0.33],
        [0.69, 0.263, 0.26],
        [0.722, 0.18, 0.15],
        [0.752, 0.163, 0.02],
      ],
      {
        segs: 130,
        radial: 20,
        vScale: 22,
        radius: (t) => legRadius(t) * knot(t, 0.05, 0.022),
        moss: legMoss,
      }
    )
  );

  const farRadius = table([0.23, 0.25, 0.27, 0.3, 0.33, 0.36, 0.4]);
  const farMoss = table([0.19, 0.2, 0.21, 0.22, 0.24, 0.25, 0.26]);
  limbs.push(
    makeLimb(
      place,
      [
        [0.706, 0.176, -0.02],
        [0.74, 0.158, 0.02],
        [0.772, 0.245, -0.08],
        [0.797, 0.4, -0.18],
        [0.816, 0.57, -0.22],
        [0.836, 0.76, -0.18],
        [0.858, 0.95, -0.08],
        [0.888, 1.18, 0.04],
      ],
      {
        segs: 150,
        radial: 20,
        vScale: 22,
        radius: (t) => farRadius(t) * knot(t, 0.05, 0.022),
        moss: farMoss,
      }
    )
  );

  return limbs;
}

/** The ridge behind: one limb, thicker in section, read at a distance. */
function buildFarLimbs(): Limb[] {
  const place = makePlacer(ASPECT_FAR);
  return [
    makeLimb(
      place,
      [
        [-0.06, 0.88, -0.35],
        [0.1, 0.762, -0.05],
        [0.21, 0.698, 0.22],
        [0.3, 0.57, 0.3],
        [0.41, 0.467, 0.18],
        [0.5, 0.5, -0.05],
        [0.6, 0.622, -0.22],
        [0.72, 0.748, -0.26],
        [0.8, 0.788, -0.08],
        [0.9, 0.66, 0.14],
        [0.99, 0.454, 0.28],
      ],
      {
        segs: 220,
        radial: 20,
        vScale: 26,
        band: [0.76, 0.9, 0.9, 0.96, 0.925, 0.95, 1.02, 1.02, 0.99, 1.1, 1.3],
        sink: 0.5,
      }
    ),
  ];
}

/* ────────────────────────────────────────────────────────────────────────
   drifting pollen
   ──────────────────────────────────────────────────────────────────────── */

export type MoteBuffers = {
  position: Float32Array;
  /** x: phase, y: speed, z: sway, w: size */
  seed: Float32Array;
  count: number;
  /** how far a mote climbs before it wraps back to the bottom of the band */
  climb: number;
};

/**
 * Air, not a handful of sprites — which means the drift has to leave the CPU.
 * Every mote is integrated from the scroll phase in the vertex shader, so the
 * per-frame cost is one uniform write no matter how many there are. Sizes
 * follow a power law: a few big soft ones near the lens and a great many
 * specks behind them, which is what stops the field reading as a even sprinkle.
 */
export function buildMotes(count: number, seed = 0x51a3c7): MoteBuffers {
  const rng = makeRng(seed);
  const position = new Float32Array(count * 3);
  const s = new Float32Array(count * 4);
  const climb = 17;

  for (let i = 0; i < count; i++) {
    position[i * 3] = (rng() - 0.5) * 34;
    position[i * 3 + 1] = (rng() - 0.5) * climb;
    position[i * 3 + 2] = -9 + rng() * 17;
    s[i * 4] = rng() * TAU;
    s[i * 4 + 1] = 0.25 + rng() * 0.9;
    s[i * 4 + 2] = 0.4 + rng() * 1.4;
    s[i * 4 + 3] = 0.7 + 1.05 * Math.pow(rng(), 2.2);
  }

  return { position, seed: s, count, climb };
}

/* ────────────────────────────────────────────────────────────────────────
   entry point
   ──────────────────────────────────────────────────────────────────────── */

export type GroveOptions = {
  /** which of the two roots to grow */
  variant?: "near" | "far";
  /** total blades across every limb */
  blades: number;
  /** total flower sprays */
  flowers: number;
  /** total fronds */
  ferns: number;
  /** frond scale range */
  fernSize?: [number, number];
  /** spray scale range */
  flowerSize?: [number, number];
  /**
   * Multiplier on blade length.
   *
   * The ridge is modelled in its own 10-unit box and then scaled up several
   * times over to run past the edges of the frame — which multiplies its fur
   * by the same factor. Left at 1 it grows blades that subtend *more* of the
   * screen than the near root's despite being four times further away, and the
   * one cue that reads as distance is the first thing lost.
   */
  bladeScale?: number;
  seed?: number;
};

/**
 * Grow the whole landscape. Synchronous and self-contained: one call, one set
 * of typed arrays, no async, no I/O.
 *
 * Cost is dominated by `blades` — the shell itself is only ~20k vertices, so
 * halving the blade count roughly halves the build time.
 */
export function buildGrove(opt: GroveOptions): Grove {
  const far = opt.variant === "far";
  const rng = makeRng(opt.seed ?? (far ? 0x77c41a03 : 0x3f9a1c7b));
  const rand = (lo: number, hi: number) => lo + (hi - lo) * rng();
  const boxH = BOX_W / (far ? ASPECT_FAR : ASPECT_NEAR);

  const limbs = far ? buildFarLimbs() : buildNearLimbs();
  // Ferns and flowers seat on the main limbs only: one planted on a twig that
  // stands off the root reads as a frond hanging in mid-air.
  const hosts = limbs.slice();

  if (!far) {
    const hp = new THREE.Vector3();
    const hn = new THREE.Vector3();
    const extra: Limb[] = [];
    for (let i = 0; i < 14; i++) {
      const r = rng();
      const src = limbs[r < 0.62 ? 0 : r < 0.82 ? 1 : 2];
      const t = rand(0.04, 0.96);
      limbSurface(src, t, rng() * TAU, hp, hn);
      if (hn.y < -0.35) continue;
      limbFrame(src, t);
      const dir = hn
        .clone()
        .multiplyScalar(rand(0.5, 1.2))
        .addScaledVector(_t, rand(-0.6, 1.5))
        .addScaledVector(UP, rand(-0.5, 0.55))
        .normalize();
      hp.addScaledVector(hn, -src.radius(t) * 0.55);
      growOffshoot(extra, hp.clone(), dir, rand(0.28, 0.72), src.radius(t) * rand(0.22, 0.4), 0, rng);
    }
    limbs.push(...extra);
  }

  const bladeScale = opt.bladeScale ?? 1;
  if (bladeScale !== 1) {
    for (const limb of limbs) {
      const base = limb.blade;
      limb.blade = (t) => base(t) * bladeScale;
    }
  }

  const bag: Bag = { pos: [], nor: [], inf: [], idx: [] };
  for (const limb of limbs) tessellate(limb, bag);

  const fur: FurBag = { off: [], nrm: [], rnd: [], aux: [] };
  let totalLength = 0;
  for (const limb of limbs) totalLength += limb.length;
  for (const limb of limbs) {
    plantBlades(limb, Math.round((opt.blades * limb.length) / totalLength), fur, rng);
  }

  const wire: number[] = [];
  for (const limb of limbs) buildWire(limb, wire);

  const p = new THREE.Vector3();
  const n = new THREE.Vector3();

  /* ---- ferns ---- */
  const fernSize = opt.fernSize ?? [0.22, 0.5];
  const fp: number[] = [];
  const fq: number[] = [];
  const frnd: number[] = [];
  const quat = new THREE.Quaternion();
  const spin = new THREE.Quaternion();
  const face = new THREE.Vector3();
  const jitter = new THREE.Vector3();
  for (let k = 0, guard = 0; k < opt.ferns && guard < opt.ferns * 60; guard++) {
    const host = hosts[Math.floor(rng() * hosts.length)];
    // Well up in the cushion and facing the sky: a frond growing sideways out
    // of the flank has nothing to stand on and reads as a decal.
    if (limbSurface(host, rng(), rng() * TAU, p, n) < 0.55) continue;
    if (n.y < 0.25) continue;
    jitter.set(rand(-0.62, 0.62), rand(-0.2, 0.05), rand(0.15, 0.75));
    face.copy(n).addScaledVector(UP, 0.18).add(jitter).normalize();
    quat.setFromUnitVectors(UP, face);
    quat.multiply(spin.setFromAxisAngle(UP, rng() * TAU));
    fp.push(p.x, p.y, p.z);
    fq.push(quat.x, quat.y, quat.z, quat.w);
    frnd.push(rand(fernSize[0], fernSize[1]), rng());
    k++;
  }

  /* ---- flowers ----
     Clumps rather than a sprinkle: pick a seed point on a main limb, then
     jitter a handful of sprays around it. Scattered evenly they read as noise;
     clumped they read as something that seeded itself. */
  const flowerSize = opt.flowerSize ?? [0.055, 0.118];
  const wp: number[] = [];
  const wr: number[] = [];
  for (let k = 0, guard = 0; k < opt.flowers && guard < opt.flowers * 40; guard++) {
    const host = hosts[Math.floor(rng() * hosts.length)];
    const t0 = rng();
    const th0 = rng() * TAU;
    for (let c = 0; c < 9 && k < opt.flowers; c++) {
      const t = clamp01(t0 + rand(-0.008, 0.008));
      const th = th0 + rand(-0.24, 0.24);
      if (limbSurface(host, t, th, p, n) < 0.45) continue;
      p.addScaledVector(n, rand(0.02, 0.16));
      wp.push(p.x, p.y, p.z);
      wr.push(rand(flowerSize[0], flowerSize[1]), rng());
      k++;
    }
  }

  // The perch: the highest point around the crest, turned a little toward the
  // lens so the butterfly's open wings are actually seen rather than edge-on.
  const perch = new THREE.Vector3();
  {
    const crest = limbs[0];
    const probeP = new THREE.Vector3();
    const probeN = new THREE.Vector3();
    let best = -Infinity;
    for (let i = 0; i < 96; i++) {
      limbSurface(crest, 0.29, (i / 96) * TAU, probeP, probeN);
      const score = probeN.y + probeN.z * 0.42;
      if (score > best) {
        best = score;
        perch.copy(probeP).addScaledVector(probeN, 0.16);
      }
    }
  }

  let reach = 0;
  for (let i = 0; i < bag.pos.length; i += 3) {
    const d = Math.hypot(bag.pos[i], bag.pos[i + 1], bag.pos[i + 2]);
    if (d > reach) reach = d;
  }

  // The shell grids were scratch for the fur and the cage — a couple of
  // megabytes of typed array per build that nothing reads again.
  for (const limb of limbs) {
    limb.grid = null;
    limb.gridNormal = null;
    limb.gridCap = null;
  }

  const frond = fernGeometry();

  return {
    bark: {
      position: new Float32Array(bag.pos),
      normal: new Float32Array(bag.nor),
      info: new Float32Array(bag.inf),
      index: new Uint32Array(bag.idx),
    },
    blades: {
      offset: new Float32Array(fur.off),
      normal: new Float32Array(fur.nrm),
      random: new Float32Array(fur.rnd),
      clump: new Float32Array(fur.aux),
      count: fur.off.length / 3,
    },
    flowers: {
      offset: new Float32Array(wp),
      random: new Float32Array(wr),
      count: wp.length / 3,
    },
    ferns: {
      ...frond,
      offset: new Float32Array(fp),
      quat: new Float32Array(fq),
      random: new Float32Array(frnd),
      count: fp.length / 3,
    },
    wire: new Float32Array(wire),
    perch,
    reach,
    boxH,
  };
}
