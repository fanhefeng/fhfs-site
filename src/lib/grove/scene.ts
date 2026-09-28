import "client-only";
import * as THREE from "three";
import type { buildGrove } from "./geometry";
import { buildMotes } from "./geometry";
import {
  BARK_VERT,
  BARK_FRAG,
  GRASS_VERT,
  GRASS_FRAG,
  FERN_VERT,
  FERN_FRAG,
  FLOWER_VERT,
  FLOWER_FRAG,
  WIRE_VERT,
  WIRE_FRAG,
  MOTE_VERT,
  MOTE_FRAG,
  SPRAY_VERT,
  SPRAY_FRAG,
  WING_VERT,
  WING_FRAG,
  BODY_VERT,
  BODY_FRAG,
} from "./shaders";
import { bodyGeometry, radialTexture, wingGeometry, wingTexture } from "./plates";
import type { GrovePalette, RGB } from "./palettes";

/**
 * The grove's props, built once for both of its directors.
 *
 * Two scenes grow the same roots: the approach (`components/grove/GroveScene`,
 * behind the two cards at /lab/approach) runs on a clock and lays the moss out
 * in stage pixels; the study (`components/lab/GroveDemo`, /lab/grove) is
 * driven by the scrollbar and measures in root widths. They differ in how they
 * frame, move and light the thing — and in nothing about what the thing is.
 * The uniforms every material agrees on, a root assembled from its grown
 * arrays, the drifting pollen, the trail the pointer lifts off the moss and
 * the butterfly are made here; each scene keeps its own choreography.
 *
 * They used to be two copies of all of it, a third of their lines matching
 * and the rest drifted apart one small edit at a time.
 */

export type Grove = ReturnType<typeof buildGrove>;

/** What a scene allocates on the GPU, collected as it is made so one teardown
 *  frees it — not walked off the graph, because the butterfly shares two
 *  geometries and two materials across four meshes, and a traverse would
 *  dispose each of those several times over. */
export type Allocations = {
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  textures: THREE.Texture[];
};

export const allocations = (): Allocations => ({ geometries: [], materials: [], textures: [] });

export function disposeAll(a: Allocations) {
  for (const g of a.geometries) g.dispose();
  for (const m of a.materials) m.dispose();
  for (const t of a.textures) t.dispose();
}

/**
 * The renderer both scenes draw with. The shaders tone-map and encode their
 * own output, so three must not do it a second time on the way to the canvas;
 * and the clear is transparent — the backdrop is the page's own. The default
 * power preference, not "high-performance": that one switches a two-GPU Mac
 * onto the discrete chip (and its fan) for as long as the page is open, and
 * the moss holds its frame rate without it.
 */
export function groveRenderer(
  canvas: HTMLCanvasElement,
  options: { antialias: boolean; stencil?: boolean },
): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, ...options });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

/**
 * Everything the whole scene agrees on, shared BY REFERENCE: one write to
 * uPhase moves the wind, the pollen and the cage together, and one write to a
 * colour reaches every material that took it — which is how the study changes
 * dress without touching the GPU's geometry.
 *
 * `scan` is the survey front: where it leaves from, and its wobble and lag in
 * whatever unit the scene measures in (CSS pixels for the approach, root
 * widths for the study). `grown` is where the grow and bloom terms start: the
 * approach draws the root in already finished; the study grows it on scroll.
 */
export function sharedUniforms(
  p: GrovePalette,
  scan: { origin: THREE.Vector3; wobble: THREE.Vector2; lag: number },
  grown: boolean,
) {
  const colour = (rgb: RGB) => ({ value: new THREE.Color(...rgb) });
  return {
    uKeyDir: { value: new THREE.Vector3(-0.3, 0.92, 0.28).normalize() },
    uKeyCol: colour(p.keyCol),
    uFillDir: { value: new THREE.Vector3(0.12, -0.86, 0.5).normalize() },
    // the pale pool on the floor, bouncing back up
    uFillCol: colour(p.fillCol),
    uAmbCol: colour(p.ambCol),
    // What the moss, the fur and the fronds are made of — the dress.
    uMossDeep: colour(p.mossDeep),
    uMossLit: colour(p.mossLit),
    uLichen: colour(p.lichen),
    uGrassDeep: colour(p.grassDeep),
    uGrassMid: colour(p.grassMid),
    uGrassTip: colour(p.grassTip),
    uGrassTipHi: colour(p.grassTipHi),
    uFernDeep: colour(p.fernDeep),
    uFernLit: colour(p.fernLit),
    uScanGlow: colour(p.scanGlow),
    uScanRim: colour(p.scanRim),
    uPhase: { value: 0 },
    uScanO: { value: scan.origin },
    uScanR: { value: 0 },
    uScanW: { value: scan.wobble },
    uScanLag: { value: scan.lag },
    uWire: { value: 0 },
    uGrow: { value: grown ? 1 : 0 },
    uBloom: { value: grown ? 1 : 0 },
  };
}

export type SharedUniforms = ReturnType<typeof sharedUniforms>;

/** The air one root sits in, and how its ends are let go. */
export type RootAir = {
  hazeCol: RGB | [number, number, number];
  haze: number;
  fog: number;
  hazeLift: number;
  /** The height of the root's modelling box, in its own units. */
  boxH: number;
  /** How far the pointer's parting reaches. */
  mouseR: number;
  /** Local midpoint, kept half-extent, feather: an end-fade along x. Off by
   *  default — pushed out of reach. */
  cut?: [number, number, number];
  /** A two-axis dissolve (x from → to, y from → to, as box fractions), for a
   *  form that has to melt into the floor light rather than end. */
  mask?: [number, number, number, number] | null;
};

/** The shared set, plus the terms that differ between one root and another. */
export function rootUniforms(shared: SharedUniforms, air: RootAir) {
  return {
    ...shared,
    uHazeCol: { value: new THREE.Color(...air.hazeCol) },
    uHaze: { value: air.haze },
    uFog: { value: air.fog },
    uHazeLift: { value: air.hazeLift },
    uBoxH: { value: air.boxH },
    uCut: { value: new THREE.Vector3(...(air.cut ?? [0, 1e6, 1])) },
    uMask: { value: new THREE.Vector4(...(air.mask ?? [0, 1, 0, 1])) },
    uMaskOn: { value: air.mask ? 1 : 0 },
    uMouse: { value: new THREE.Vector3(9999, 9999, 9999) },
    uMouseR: { value: air.mouseR },
  };
}

export type RootUniforms = ReturnType<typeof rootUniforms>;

export type Root = {
  group: THREE.Group;
  uniforms: RootUniforms;
  wire: THREE.LineSegments;
  /** The opaque meshes and the discard-free copy of each one's material,
   *  for `settleRoots` once the survey is over — empty unless asked for. */
  settled: { mesh: THREE.Mesh; material: THREE.ShaderMaterial }[];
  /** The flower materials, for a dress change that repaints their plate. */
  flowerMats: THREE.ShaderMaterial[];
};

/** Four rungs pinched to a point: one blade of fur, instanced a few hundred
 *  thousand times over the grown offsets. */
function bladeGeometry(grove: Grove): THREE.InstancedBufferGeometry {
  const geo = new THREE.InstancedBufferGeometry();
  const segs = 3;
  const verts: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = 0.5 * (1 - t * t);
    verts.push(-w, t, 0, w, t, 0);
    uvs.push(0, t, 1, t);
  }
  verts[verts.length - 6] = 0;
  verts[verts.length - 3] = 0;
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(grove.blades.offset, 3));
  geo.setAttribute("aNormal", new THREE.InstancedBufferAttribute(grove.blades.normal, 3));
  geo.setAttribute("aRandom", new THREE.InstancedBufferAttribute(grove.blades.random, 4));
  geo.setAttribute("aClump", new THREE.InstancedBufferAttribute(grove.blades.clump, 1));
  geo.instanceCount = grove.blades.count;
  return geo;
}

/**
 * One root, assembled from its grown arrays and added to the scene: bark,
 * fur, ferns, flowers, and the survey cage over them.
 *
 * `soft` is a root that dissolves: it has to blend, but it still writes
 * depth, because the fade is a sliver at the ends and letting it skip the
 * depth buffer would put the root's own far flank in front of its near one.
 *
 * `settledTwins` asks for a discard-free copy of each opaque material, to be
 * swapped in once the survey is over (see SETTLED_DISCARD_GLSL in the
 * shaders) — for a scene that runs on after the survey, where the discards
 * cost every frame. A soft root never gets them: a blended pile has no
 * hidden-surface removal to win back, and its ends really do fade to nothing.
 */
export function assembleRoot({
  scene,
  grove,
  uniforms,
  bark,
  flowerMap,
  soft,
  settledTwins,
  orders,
  wireK,
  into,
}: {
  scene: THREE.Scene;
  grove: Grove;
  uniforms: RootUniforms;
  /** The bark's baked plates (lib/grove/bark.ts). */
  bark: Record<string, THREE.IUniform>;
  flowerMap: THREE.Texture;
  soft: boolean;
  settledTwins: boolean;
  /** Render order of each layer. */
  orders: { bark: number; grass: number; fern: number; flower: number };
  /** The cage's falloff, in the scene's units: near, far, thickness. */
  wireK: [number, number, number];
  into: Allocations;
}): Root {
  const group = new THREE.Group();
  const settled: Root["settled"] = [];
  const flowerMats: THREE.ShaderMaterial[] = [];

  const opaque = (params: THREE.ShaderMaterialParameters, geometry: THREE.BufferGeometry) => {
    const live = new THREE.ShaderMaterial({
      ...params,
      transparent: soft,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, live);
    into.materials.push(live);
    if (settledTwins && !soft) {
      const calm = new THREE.ShaderMaterial({
        ...params,
        transparent: false,
        depthWrite: true,
        side: THREE.DoubleSide,
        defines: { SETTLED: 1 },
      });
      into.materials.push(calm);
      settled.push({ mesh, material: calm });
    }
    mesh.frustumCulled = false;
    group.add(mesh);
    into.geometries.push(geometry);
    return mesh;
  };

  const barkGeo = new THREE.BufferGeometry();
  barkGeo.setAttribute("position", new THREE.BufferAttribute(grove.bark.position, 3));
  barkGeo.setAttribute("normal", new THREE.BufferAttribute(grove.bark.normal, 3));
  barkGeo.setAttribute("aInfo", new THREE.BufferAttribute(grove.bark.info, 3));
  barkGeo.setIndex(new THREE.BufferAttribute(grove.bark.index, 1));
  opaque(
    { uniforms: { ...uniforms, ...bark }, vertexShader: BARK_VERT, fragmentShader: BARK_FRAG },
    barkGeo,
  ).renderOrder = orders.bark;

  opaque(
    { uniforms, vertexShader: GRASS_VERT, fragmentShader: GRASS_FRAG },
    bladeGeometry(grove),
  ).renderOrder = orders.grass;

  if (grove.ferns.count > 0) {
    const fernGeo = new THREE.InstancedBufferGeometry();
    fernGeo.setAttribute("position", new THREE.BufferAttribute(grove.ferns.position, 3));
    fernGeo.setAttribute("normal", new THREE.BufferAttribute(grove.ferns.normal, 3));
    fernGeo.setAttribute("uv", new THREE.BufferAttribute(grove.ferns.uv, 2));
    fernGeo.setIndex(new THREE.BufferAttribute(grove.ferns.index, 1));
    fernGeo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(grove.ferns.offset, 3));
    fernGeo.setAttribute("aQuat", new THREE.InstancedBufferAttribute(grove.ferns.quat, 4));
    fernGeo.setAttribute("aRandom", new THREE.InstancedBufferAttribute(grove.ferns.random, 2));
    fernGeo.instanceCount = grove.ferns.count;
    opaque({ uniforms, vertexShader: FERN_VERT, fragmentShader: FERN_FRAG }, fernGeo).renderOrder =
      orders.fern;
  }

  if (grove.flowers.count > 0) {
    const flowerGeo = new THREE.InstancedBufferGeometry();
    flowerGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3),
    );
    flowerGeo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    flowerGeo.setIndex([0, 1, 2, 0, 2, 3]);
    flowerGeo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(grove.flowers.offset, 3));
    flowerGeo.setAttribute("aRandom", new THREE.InstancedBufferAttribute(grove.flowers.random, 2));
    flowerGeo.instanceCount = grove.flowers.count;
    const flowerMat = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uMap: { value: flowerMap } },
      vertexShader: FLOWER_VERT,
      fragmentShader: FLOWER_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const flowers = new THREE.Mesh(flowerGeo, flowerMat);
    flowers.frustumCulled = false;
    flowers.renderOrder = orders.flower;
    group.add(flowers);
    into.geometries.push(flowerGeo);
    into.materials.push(flowerMat);
    flowerMats.push(flowerMat);
  }

  /* the survey cage */
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute("position", new THREE.BufferAttribute(grove.wire, 3));
  const wireMat = new THREE.ShaderMaterial({
    uniforms: {
      uScanO: uniforms.uScanO,
      uScanR: uniforms.uScanR,
      uWire: uniforms.uWire,
      uPhase: uniforms.uPhase,
      uWireK: { value: new THREE.Vector3(...wireK) },
    },
    vertexShader: WIRE_VERT,
    fragmentShader: WIRE_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const wire = new THREE.LineSegments(wireGeo, wireMat);
  wire.frustumCulled = false;
  wire.renderOrder = 8;
  group.add(wire);
  into.geometries.push(wireGeo);
  into.materials.push(wireMat);

  scene.add(group);
  return { group, uniforms, wire, settled, flowerMats };
}

/**
 * The survey is over: the cages go, the front is parked well past the far
 * corner so nothing is ever clipped by it again, and each root's materials
 * are swapped for the discard-free copies `assembleRoot` made.
 */
export function settleRoots(shared: SharedUniforms, roots: Root[], parkedAt: number) {
  shared.uWire.value = 0;
  shared.uScanR.value = parkedAt;
  for (const root of roots) {
    const w = root.wire;
    if (w.parent) {
      w.parent.remove(w);
      w.geometry.dispose();
      (w.material as THREE.Material).dispose();
    }
    for (const s of root.settled) {
      (s.mesh.material as THREE.Material).dispose();
      s.mesh.material = s.material;
    }
    root.settled.length = 0;
  }
}

/**
 * The settled programs, compiled while the pulse is still crossing, so the
 * swap lands on programs the driver has long finished linking — three only
 * asks a program for its uniforms on first use, so compile() itself does not
 * wait for the link. It takes any Object3D, so a stand-in group of meshes
 * sharing the real geometries does it without putting anything in the scene.
 * Not compileAsync(): that one keeps polling the materials after they are
 * gone, which under StrictMode's mount–unmount–mount they are.
 */
export function precompileSettled(
  renderer: THREE.WebGLRenderer,
  roots: Root[],
  camera: THREE.Camera,
  scene: THREE.Scene,
) {
  const standIn = new THREE.Group();
  for (const root of roots) {
    for (const s of root.settled) standIn.add(new THREE.Mesh(s.mesh.geometry, s.material));
  }
  if (standIn.children.length) renderer.compile(standIn, camera, scene);
}

/** The contact shadow under a root — a soft dark disc, the same in any dress. */
export const contactShadowTexture = () =>
  radialTexture(256, [
    [0, "rgba(12,16,10,0.62)"],
    [0.45, "rgba(12,16,10,0.26)"],
    [1, "rgba(12,16,10,0)"],
  ]);

/** Drifting pollen: points on a slow climb, driven by uPhase. */
export function createMotes(
  count: number,
  map: THREE.Texture,
  phase: { value: number },
  size: number,
  into: Allocations,
) {
  const motes = buildMotes(count);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(motes.position, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(motes.seed, 4));
  const uniforms = {
    uPhase: phase,
    uMap: { value: map },
    uSize: { value: size },
    uScale: { value: 400 },
    uClimb: { value: motes.climb },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: MOTE_VERT,
    fragmentShader: MOTE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 6;
  into.geometries.push(geo);
  into.materials.push(material);
  return { points, uniforms, material };
}

/** Size attenuation that matches three's own: a point of world size s at
 *  distance d comes out s × this / d pixels across. Solved per resize. */
export function pointScale(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
  const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
  return (buf.y * 0.5) / Math.tan((camera.fov * Math.PI) / 180 / 2);
}

export const SPRAY_N = 620;
export const SPRAY_LIFE = 1.6;

/**
 * The trail the pointer lifts off the moss: a ring of grains, each born where
 * the pointer passed and left to rise and fade on the scene's clock.
 */
export function createSpray(
  map: THREE.Texture,
  scale: { value: number },
  size: number,
  into: Allocations,
) {
  const pos = new Float32Array(SPRAY_N * 3);
  const vel = new Float32Array(SPRAY_N * 3);
  const birth = new Float32Array(SPRAY_N).fill(-999);
  const rnd = new Float32Array(SPRAY_N * 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aVel", new THREE.BufferAttribute(vel, 3));
  geo.setAttribute("aBirth", new THREE.BufferAttribute(birth, 1));
  geo.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 2));
  const uniforms = {
    uNow: { value: 0 },
    uMap: { value: map },
    uSize: { value: size },
    uScale: scale,
    uLife: { value: SPRAY_LIFE },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: SPRAY_VERT,
    fragmentShader: SPRAY_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 7;
  into.geometries.push(geo);
  into.materials.push(material);

  let head = 0;
  let dirty = false;
  let lastBirth = -999;
  /** One grain, born at `now` on the scene's clock. */
  const spawn = (p: THREE.Vector3, now: number) => {
    const i = head;
    head = (head + 1) % SPRAY_N;
    const o = i * 3;
    pos[o] = p.x + (Math.random() - 0.5) * 0.16;
    pos[o + 1] = p.y + (Math.random() - 0.5) * 0.16;
    pos[o + 2] = p.z + (Math.random() - 0.5) * 0.48;
    vel[o] = (Math.random() - 0.5) * 0.4;
    vel[o + 1] = 0.012 + Math.random() * 0.33;
    vel[o + 2] = (Math.random() - 0.5) * 0.28;
    birth[i] = now;
    rnd[i * 2] = 0.5 + Math.random() * 0.65;
    rnd[i * 2 + 1] = Math.random();
    dirty = true;
    lastBirth = now;
  };
  /** Hands this frame's births to the GPU, if there were any. */
  const flush = () => {
    if (!dirty) return;
    const at = geo.attributes;
    at.position!.needsUpdate = true;
    at.aVel!.needsUpdate = true;
    at.aBirth!.needsUpdate = true;
    at.aRnd!.needsUpdate = true;
    dirty = false;
  };

  /* Emission by DISTANCE rather than by time, spread along the segment the
     pointer covered since the last frame: a fast sweep lays a trail instead
     of stacking a clump wherever the cursor happened to land, and a hand that
     has crept too slowly to trip the distance test trickles. */
  const last = new THREE.Vector3(9999, 0, 0);
  const step = new THREE.Vector3();
  let idle = 0;
  const trail = {
    /** The pointer is gone: re-entering should not lay a streak across the frame. */
    lift: () => {
      last.x = 9999;
    },
    /** The pointer is at `at`, in the spray's own space. */
    at: (at: THREE.Vector3, dt: number, now: number) => {
      if (last.x > 9000) {
        last.copy(at);
        return;
      }
      const n = Math.min(14, Math.floor(at.distanceTo(last) / 0.037));
      for (let k = 1; k <= n; k++) {
        step.lerpVectors(last, at, k / n);
        spawn(step, now);
      }
      if (n > 0) {
        last.copy(at);
        idle = 0;
      } else {
        idle += dt;
        if (idle > 0.055) {
          spawn(at, now);
          idle = 0;
        }
      }
      flush();
    },
  };

  return { points, uniforms, material, trail, lastBirth: () => lastBirth };
}

/**
 * The butterfly, built from painted wings and a lathed body. Posed by
 * `poseWings`; where it flies is each scene's own business.
 */
export function buildButterfly(shared: SharedUniforms, scale: number, into: Allocations) {
  const wingMap = wingTexture();
  into.textures.push(wingMap);
  const bendFore = { value: 0 };
  const bendHind = { value: 0 };
  const wingMaterial = (hind: boolean, bend: { value: number }) =>
    new THREE.ShaderMaterial({
      uniforms: {
        uKeyDir: shared.uKeyDir,
        uKeyCol: shared.uKeyCol,
        uAmbCol: shared.uAmbCol,
        uBend: bend,
        uHind: { value: hind ? 1 : 0 },
        uTex: { value: wingMap },
      },
      vertexShader: WING_VERT,
      fragmentShader: WING_FRAG,
      side: THREE.DoubleSide,
    });
  const foreMat = wingMaterial(false, bendFore);
  const hindMat = wingMaterial(true, bendHind);
  const bodyMat = new THREE.ShaderMaterial({
    uniforms: { uKeyDir: shared.uKeyDir, uKeyCol: shared.uKeyCol, uAmbCol: shared.uAmbCol },
    vertexShader: BODY_VERT,
    fragmentShader: BODY_FRAG,
  });
  const antMat = new THREE.MeshBasicMaterial({ color: 0x171208 });
  into.materials.push(foreMat, hindMat, bodyMat, antMat);

  const foreGeo = wingGeometry(false);
  const hindGeo = wingGeometry(true);
  const trunkGeo = bodyGeometry();
  const tegulaGeo = new THREE.SphereGeometry(0.052, 12, 9);
  const clubGeo = new THREE.SphereGeometry(0.013, 8, 6);
  into.geometries.push(foreGeo, hindGeo, trunkGeo, tegulaGeo, clubGeo);

  const group = new THREE.Group();
  // Mirrored by a negative X scale rather than a second geometry. That flips
  // the winding, which is why the wing material is DoubleSide and flips its
  // own normal on back faces.
  const foreR = new THREE.Mesh(foreGeo, foreMat);
  const foreL = new THREE.Mesh(foreGeo, foreMat);
  const hindR = new THREE.Mesh(hindGeo, hindMat);
  const hindL = new THREE.Mesh(hindGeo, hindMat);
  foreL.scale.x = -1;
  hindL.scale.x = -1;
  foreR.position.set(0.012, 0.012, 0);
  foreL.position.copy(foreR.position);
  hindR.position.set(0.01, 0, 0);
  hindL.position.copy(hindR.position);
  group.add(foreR, foreL, hindR, hindL);
  group.add(new THREE.Mesh(trunkGeo, bodyMat));

  for (const sx of [1, -1] as const) {
    // tegulae — the scaled shoulder pads that weld wing to thorax
    const teg = new THREE.Mesh(tegulaGeo, bodyMat);
    teg.position.set(0.03 * sx, 0.026, 0.02);
    teg.scale.set(1.15, 0.62, 1.5);
    teg.rotation.z = -0.35 * sx;
    group.add(teg);

    // antennae: thin, swept back, clubbed at the tip
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0.01 * sx, 0.02, 0.15),
      new THREE.Vector3(0.062 * sx, 0.075, 0.3),
      new THREE.Vector3(0.105 * sx, 0.11, 0.43),
    );
    const antGeo = new THREE.TubeGeometry(curve, 12, 0.0042, 5, false);
    into.geometries.push(antGeo);
    group.add(new THREE.Mesh(antGeo, antMat));
    const club = new THREE.Mesh(clubGeo, antMat);
    club.position.copy(curve.getPointAt(1));
    club.scale.z = 1.9;
    group.add(club);
  }

  group.scale.setScalar(scale);
  group.renderOrder = 5;
  group.traverse((o) => {
    o.frustumCulled = false;
  });
  return { group, wings: { foreR, foreL, hindR, hindL, bendFore, bendHind } };
}

export type Wings = ReturnType<typeof buildButterfly>["wings"];

/**
 * The wings at one instant of the stroke. `flap` is the stroke's phase, in
 * radians; `settle` 0 is in flight (a quick asymmetric stroke), 1 is perched
 * (a slow display, wings held open); `spook` flares resting wings open as a
 * hand closes in — the flick a butterfly gives just before it goes.
 */
export function poseWings(wings: Wings, flap: number, settle: number, spook: number) {
  const raw = Math.sin(flap);
  const shaped = (raw < 0 ? -1 : 1) * Math.pow(Math.abs(raw), 0.72);
  const flyPhi = 20 + 48 * shaped;
  const restPhi = 15 + 7 * shaped + spook * 30;
  const phi = ((flyPhi + (restPhi - flyPhi) * settle) * Math.PI) / 180;
  wings.foreR.rotation.z = phi;
  wings.foreL.rotation.z = -phi;
  wings.hindR.rotation.z = phi * 0.95 - 0.03;
  wings.hindL.rotation.z = -(phi * 0.95 - 0.03);
}

/** The membrane's lag behind the stroke: the wing tips trail the beat. */
export function bendWings(wings: Wings, flapVel: number) {
  wings.bendFore.value = -flapVel * 0.01;
  wings.bendHind.value = -flapVel * 0.013;
}
