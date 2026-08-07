import * as THREE from "three";

/**
 * Direction angle → point on the surface.
 *
 * The core of the whole sticker system: the content only ever says "looking
 * from over there". At runtime a ray is fired from that direction towards the
 * model's centre; the hit point becomes the decal's position and the hit
 * face's normal becomes its orientation. So a new model costs no coordinates —
 * but it does cost a re-calibration of the pose `normalizeModel` bakes, and
 * that bake has a precondition the current asset does not meet: see its note.
 */

/** Spherical angles (degrees) → unit vector. theta: horizontal, 0 = front
 *  (+Z); phi: vertical, positive = up. Pass `out` from a per-frame caller so
 *  the damping loop does not allocate a Vector3 every frame. */
export function dirVector(
  thetaDeg: number,
  phiDeg: number,
  out: THREE.Vector3 = new THREE.Vector3()
): THREE.Vector3 {
  const t = THREE.MathUtils.degToRad(thetaDeg);
  const p = THREE.MathUtils.degToRad(phiDeg);
  return out
    .set(Math.sin(t) * Math.cos(p), Math.sin(p), Math.cos(t) * Math.cos(p))
    .normalize();
}

/** Unit vector → spherical angles (degrees). The inverse of dirVector, used
 *  when the editor picks a spot by clicking the model. Does not mutate its
 *  argument — callers can pass live vectors without cloning. */
export function vectorToDir(v: THREE.Vector3): { theta: number; phi: number } {
  const n = v.clone().normalize();
  return {
    theta: THREE.MathUtils.radToDeg(Math.atan2(n.x, n.z)),
    phi: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(n.y, -1, 1))),
  };
}

const raycaster = new THREE.Raycaster();

export type SurfaceHit = {
  position: THREE.Vector3;
  normal: THREE.Vector3;
};

/** How far out the ray starts, in world units — comfortably outside the
 *  normalized model (height 2, centred on the origin). */
const RAY_START_DISTANCE = 4;

/**
 * Fire a ray from `dir` towards the origin; return the surface point it hits
 * and the world-space normal there. Returns null on a miss — which happens
 * when the content asks for an angle off the side of the model, or the mesh
 * has a hole.
 */
export function projectToSurface(
  target: THREE.Object3D,
  dir: THREE.Vector3
): SurfaceHit | null {
  const origin = dir.clone().multiplyScalar(RAY_START_DISTANCE);
  raycaster.set(origin, dir.clone().negate());
  const hits = raycaster.intersectObject(target, true);
  if (!hits.length) return null;

  const hit = hits[0];
  const normal = hit.face
    ? hit.face.normal
        .clone()
        .transformDirection(hit.object.matrixWorld)
        .normalize()
    : dir.clone();

  return { position: hit.point.clone(), normal };
}

const dummy = new THREE.Object3D();

/** Surface point + normal + spin → the decal's Euler orientation. */
export function decalOrientation(
  hit: SurfaceHit,
  rotationDeg: number
): THREE.Euler {
  dummy.position.copy(hit.position);
  dummy.lookAt(hit.position.clone().add(hit.normal));
  dummy.rotateZ(THREE.MathUtils.degToRad(rotationDeg));
  return dummy.rotation.clone();
}

/**
 * Turn quantized vertex attributes back into Float32.
 *
 * gltf-transform's `quantize` (KHR_mesh_quantization) stores position/normal
 * as normalized Int16. BufferAttribute.applyMatrix4 dequantizes on read but
 * writes straight back into the integer array — the floats are truncated and
 * the model shatters into noise. Bake only after converting. UVs take no part
 * in the matrix transform, so they stay quantized and stay small.
 */
function dequantizeForBaking(geom: THREE.BufferGeometry) {
  for (const name of ["position", "normal", "tangent"] as const) {
    const attr = geom.getAttribute(name) as THREE.BufferAttribute | undefined;
    if (!attr || attr.array instanceof Float32Array) continue;

    const out = new Float32Array(attr.count * attr.itemSize);
    for (let i = 0; i < attr.count; i++) {
      for (let j = 0; j < attr.itemSize; j++) {
        // getComponent already dequantizes.
        out[i * attr.itemSize + j] = attr.getComponent(i, j);
      }
    }
    geom.setAttribute(name, new THREE.BufferAttribute(out, attr.itemSize));
  }
}

/**
 * Bake the model into a standard pose: centre of the face at the origin,
 * total height = `targetHeight`.
 *
 * The vertices are rewritten rather than the group being transformed, so
 * world space == local space afterwards and neither the decals nor the camera
 * ever have to think about matrices.
 *
 * That equality only holds while every node between `root` and a mesh is
 * identity: the box is measured in world space, baked into *local* geometry,
 * and only `root` is cleared afterwards — any child transform survives and is
 * re-applied on top of the bake. `head.glb` breaks this, because
 * gltf-transform's `quantize` parks the dequantisation on the mesh node
 * (uniform scale 0.4990203). The result is still exactly `targetHeight` tall,
 * but the anchor lands at y≈+0.0601 instead of 0 — an effective
 * `anchorFromTop` of 0.470, not 0.44 — and re-running is not a no-op: because
 * `useGLTF` caches the scene, every remount re-bakes and creeps the model down
 * by half the remaining error (0.0601 → 0.0301 → 0.0151 …), converging on the
 * pose it should have had on the first pass. Folding each mesh's world matrix
 * into the bake and clearing every node fixes both at once — and moves all
 * seven decal hits by 0.014–0.030, so it costs a re-tune in `?edit=1` and a
 * re-check of `GLASSES`. Neither half is safe to land alone.
 *
 * `anchorFromTop` is the load-bearing argument: a bust's bounding-box centre
 * lands on the neck or even the chest, and using that as the ray origin puts
 * every sticker below the chin. It is measured from the top of the model
 * downwards, as a fraction of total height — head-only ≈ 0.5, bust ≈ 0.35–0.44,
 * half-body and below smaller still.
 */
/**
 * Geometries this has already baked.
 *
 * `useGLTF` caches the parsed scene by URL, so every remount hands the same
 * geometry objects back — and because the bake above is not a fixed point,
 * re-running it walks the model a little further down each time. That is not a
 * theoretical drift: `GLASSES` builds the spectacles from fixed constants at
 * the origin and they do NOT follow the head, so about → intro → about → intro
 * slides the frames a seventh of a lens height up the face. React StrictMode
 * makes it worse in development by double-invoking the memo that calls this,
 * so `pnpm dev` renders a pose production never shows — which is the pose
 * `?edit=1` calibrates against.
 *
 * Freezing on the first bake is deliberately NOT the same as fixing the anchor.
 * It pins the pose to the one production has always rendered, and leaves the
 * 0.470-vs-0.44 discrepancy exactly where the sticker angles and `GLASSES`
 * were tuned against it. Fixing the anchor properly means re-tuning both.
 */
const baked = new WeakSet<THREE.BufferGeometry>();

export function normalizeModel(
  root: THREE.Object3D,
  targetHeight = 2,
  anchorFromTop = 0.5
) {
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const scale = targetHeight / (size.y || 1);

  // Once normalized the crown sits at +targetHeight/2; the anchor is measured
  // down from there.
  const anchorY = targetHeight / 2 - targetHeight * anchorFromTop;

  const matrix = new THREE.Matrix4()
    .makeTranslation(-center.x, -center.y, -center.z)
    .premultiply(new THREE.Matrix4().makeScale(scale, scale, scale))
    .premultiply(new THREE.Matrix4().makeTranslation(0, -anchorY, 0));

  // One membership test covers both ways the same geometry can arrive twice:
  // shared between meshes inside this traverse, and handed back by useGLTF's
  // cache on a later mount. Either way it must be transformed exactly once.
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry || baked.has(mesh.geometry)) return;
    baked.add(mesh.geometry);
    dequantizeForBaking(mesh.geometry);
    mesh.geometry.applyMatrix4(matrix);
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
  });

  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);
}

/** The mesh with the most triangles — that is the one decals go on. */
export function findPrimaryMesh(root: THREE.Object3D): THREE.Mesh | null {
  let best: THREE.Mesh | null = null;
  // Starts at 0, so a mesh carrying no geometry at all can never win by
  // default the way a -1 floor would let it.
  let bestCount = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    // Triangles, not vertices. An indexed mesh shares its vertices while an
    // unindexed one repeats them per corner, so the two counts diverge by up
    // to 6× — and they diverge exactly where this has to be right. Swap in a
    // model whose hair is unindexed cards (30k vertices for 10k triangles)
    // next to a welded face (25k vertices for 48k triangles) and counting
    // `position` picks the hair: every decal would then be projected onto the
    // fringe and the face would come out bare.
    const index = mesh.geometry.getIndex();
    const position = mesh.geometry.getAttribute("position");
    const count = (index ? index.count : (position?.count ?? 0)) / 3;
    if (count > bestCount) {
      bestCount = count;
      best = mesh;
    }
  });
  return best;
}
