"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useGLTF, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { DecalGeometry } from "three/addons/geometries/DecalGeometry.js";

import {
  GLASSES,
  INTRO_STICKERS,
  MODEL_ANCHOR_FROM_TOP,
  MODEL_URL,
} from "@/lib/intro/stickers";
import {
  renderOnDemand,
  scrollState,
  useIntroStore,
  resolveSticker,
  type StickerOverride,
} from "@/lib/intro/store";
import { createStickerTexture } from "@/lib/intro/stickerTexture";
import { DRACO_DECODER_PATH } from "@/lib/three/draco";
import {
  dirVector,
  vectorToDir,
  projectToSurface,
  decalOrientation,
  normalizeModel,
  findPrimaryMesh,
  type SurfaceHit,
} from "@/lib/intro/surface";

/* ------------------------------------------------------------------ *
 * The model: load → bake into the standard pose → find the main mesh
 * ------------------------------------------------------------------ */

/**
 * Materials whose roughness has already been knocked back.
 *
 * `useGLTF` caches the parsed scene per URL, so every mount hands back the
 * *same* material instances and this memo runs again on each one. The rest of
 * the tone pass assigns absolute values and is therefore idempotent; the
 * roughness bump is relative, so without this guard about → intro → about →
 * intro adds +0.25 a visit until it saturates at 1 and the face goes flat.
 */
const toned = new WeakSet<THREE.Material>();

function useAvatar() {
  // The decoder path must match the preload at the bottom of this file: drei
  // keys its cache on the URL, so whichever call runs first is the one that
  // configures the loader.
  const { scene } = useGLTF(MODEL_URL, DRACO_DECODER_PATH);

  return useMemo(() => {
    const root = scene as THREE.Object3D;
    normalizeModel(root, 2, MODEL_ANCHOR_FROM_TOP);

    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat && "roughness" in mat) {
        // The raw scan reads bright and plasticky; knocking the specular back
        // lets the stickers pop instead.
        if (!toned.has(mat)) {
          toned.add(mat);
          mat.roughness = Math.min(1, (mat.roughness ?? 0.5) + 0.25);
        }
        mat.metalness = 0;
        // A model without a diffuse map would otherwise be a lump of grey.
        if (!mat.map) mat.color.set("#e7d3c3");
      }
    });

    return { root, mesh: findPrimaryMesh(root) };
  }, [scene]);
}

/* ------------------------------------------------------------------ *
 * On-demand rendering
 * ------------------------------------------------------------------ */

/**
 * The rig is static: one model, one pair of glasses, four lights that never
 * move. A shadow map for that only has to be drawn when the geometry casting
 * it changes — but three redraws the whole shadow pass every frame by default,
 * so the renderer was producing an identical depth buffer 120 times a second
 * alongside the identical colour frame.
 *
 * `shadowMap.autoUpdate = false` (set once in `AvatarScene`) stops that; every
 * piece of the scene that builds geometry calls this with what it just built,
 * which asks for one shadow pass and one frame to show it in. three clears
 * `needsUpdate` itself after the next render, and if that render is still
 * pending the flag simply stays set — so this is safe to call while no frames
 * are being produced.
 *
 * Light *intensity* deliberately does not belong here: the theme ease changes
 * how bright a shadow reads, which is the main pass's job, not the depth
 * buffer's.
 */
function useShadowRefresh(geometry: unknown) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, invalidate, geometry]);
}

/* ------------------------------------------------------------------ *
 * Lighting, tied to the site's theme
 * ------------------------------------------------------------------ */

/** Which half of the site's palette the rig is lit for. Exported because this
 *  file owns the lighting table keyed by it — the stage that reads
 *  `data-theme` should import the type rather than restate it. */
export type Tone = "light" | "dark";

/** Lit like paper by day; by night the key drops and the warm bounce carries
 *  the face, so the avatar never glows out of a dark page. */
const LIGHTING: Record<Tone, { ambient: number; key: number; fill: number; warm: number }> =
  {
    light: { ambient: 0.75, key: 2.1, fill: 0.75, warm: 1.35 },
    dark: { ambient: 0.34, key: 1.3, fill: 0.4, warm: 1.05 },
  };

/**
 * The canvas is transparent on purpose — the page's own paper, aurora and
 * grain show through, so the avatar sits *in* the site rather than on a patch
 * of foreign colour, and the theme cross-fade is handled entirely by CSS.
 *
 * What still has to follow the theme in here is the light rig, eased per-frame
 * rather than set outright so flipping the lights does not snap.
 *
 * The fog is wired the same way and currently does nothing. three measures fog
 * by view depth (`-mvPosition.z`), and against every camera stop `buildStops`
 * produces, the furthest corner of the baked model sits at 5.45 — 5.82 once a
 * portrait viewport hits the `nodeDistanceScale` clamp — while `near` is 6. No
 * fragment is ever tinted, so `--bg` has no effect on a single 3D pixel and the
 * dissolve described below has never been visible. Kept rather than deleted
 * because the wiring is right and the intent is worth having: dropping `near`
 * to about 4.5 is the whole change, and it is a look to approve, not a bug to
 * fix silently.
 */
function Atmosphere({ tone }: { tone: Tone }) {
  const { scene, invalidate } = useThree();
  const ambient = useRef<THREE.AmbientLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const warm = useRef<THREE.DirectionalLight>(null);

  const fog = useMemo(() => new THREE.Fog("#faf9f6", 6, 12), []);
  const fogTarget = useRef(new THREE.Color("#faf9f6"));

  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  // Read the paper colour straight off the token, so a change to `--bg` in
  // globals.css carries into the 3D fog without being restated here.
  useEffect(() => {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg")
      .trim();
    if (value) fogTarget.current.set(value);
    // Nothing else is going to ask for the frame this ease needs to start on.
    invalidate();
  }, [tone, invalidate]);

  useFrame((_, delta) => {
    const k = 1 - Math.pow(0.002, delta);
    const want = LIGHTING[tone];

    // Exponential easing approaches its target without ever arriving, so
    // "settled" has to be a threshold. A thousandth of a stop is far below
    // what either the eye or an 8-bit framebuffer can resolve.
    let settling = false;
    const ease = (light: THREE.Light | null, to: number) => {
      if (!light) return;
      const gap = to - light.intensity;
      light.intensity += gap * k;
      if (Math.abs(gap) > 0.001) settling = true;
    };

    fog.color.lerp(fogTarget.current, k);
    ease(ambient.current, want.ambient);
    ease(key.current, want.key);
    ease(fill.current, want.fill);
    ease(warm.current, want.warm);

    // Re-arm until the rig has arrived, then let the loop go quiet. Without
    // this the ease would render exactly one frame of itself and freeze.
    if (settling) invalidate();
  });

  // The rig's opening pose, and nothing after it. Recomputing this from `tone`
  // on every render is what made the ease above dead code: React wrote the new
  // target straight onto each light the instant the theme flipped, so useFrame
  // always found a gap of zero left to close and the lights snapped — exactly
  // what the ease exists to prevent, in the file that documents it as
  // "eased per-frame rather than set outright so flipping the lights does not
  // snap". Latched at mount, intensity belongs to useFrame from frame one.
  const initial = useRef(LIGHTING[tone]).current;

  return (
    <>
      {/* No drei <Environment preset> — it fetches an HDR from a CDN, which
          costs the first frame and breaks offline. */}
      <ambientLight ref={ambient} intensity={initial.ambient} />
      {/* normalBias kills the shadow-acne banding that a photographic texture
          on a curved surface shows up mercilessly. */}
      <directionalLight
        ref={key}
        position={[3.5, 4, 5]}
        intensity={initial.key}
        castShadow
        shadow-normalBias={0.06}
        shadow-bias={-0.0002}
      />
      <directionalLight ref={fill} position={[-4.5, 1.5, 2.5]} intensity={initial.fill} />
      <directionalLight
        ref={warm}
        position={[0, 2, -5]}
        intensity={initial.warm}
        color="#ffe9c9"
      />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Procedural black-framed glasses (see lib/intro/stickers.ts for the why)
 * ------------------------------------------------------------------ */

function roundedRect(w: number, h: number, r: number) {
  const p = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r);
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h);
  p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r);
  p.quadraticCurveTo(x, y, x + r, y);
  return p;
}

/** A square rod between two points — used for both temples and the bridge. */
function bar(
  from: THREE.Vector3,
  to: THREE.Vector3,
  w: number,
  h: number,
  mat: THREE.Material
) {
  const dir = to.clone().sub(from);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, len), mat);
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    dir.normalize()
  );
  return mesh;
}

function buildGlasses() {
  const { eyeY, frontZ, lensW, lensH, lensCX, rim, depth, earX, earY, earZ } =
    GLASSES;
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: "#161616",
    roughness: 0.35, // the faint sheen of acetate
    metalness: 0,
  });

  const shape = roundedRect(lensW, lensH, 0.07);
  shape.holes.push(roundedRect(lensW - rim * 2, lensH - rim * 2, 0.05));
  const rimGeom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  });
  rimGeom.translate(0, 0, -depth / 2);

  // Hinges and bridge both sit a third of the way up the lens.
  const hingeY = eyeY + lensH * 0.27;
  // The frame is flat and the face is not: each lens rotates back around
  // its own inner edge (the wrap angle), otherwise the outer rim hangs off
  // the cheek at three-quarter view. The inner edge does not move, so the
  // bridge is unaffected.
  const wrap = 0.16;
  const innerX = lensCX - lensW / 2;
  for (const side of [-1, 1]) {
    const rimMesh = new THREE.Mesh(rimGeom, mat);
    rimMesh.position.set(
      side * (innerX + (lensW / 2) * Math.cos(wrap)),
      eyeY,
      frontZ - (lensW / 2) * Math.sin(wrap)
    );
    rimMesh.rotation.y = side * wrap;
    g.add(rimMesh);
    g.add(
      bar(
        new THREE.Vector3(
          side * (innerX + lensW * Math.cos(wrap)),
          hingeY,
          frontZ - lensW * Math.sin(wrap)
        ),
        new THREE.Vector3(side * earX, earY, earZ),
        0.02,
        0.035,
        mat
      )
    );
  }
  g.add(
    bar(
      new THREE.Vector3(-lensCX + lensW / 2 - rim, hingeY, frontZ),
      new THREE.Vector3(lensCX - lensW / 2 + rim, hingeY, frontZ),
      0.12,
      0.03,
      mat
    )
  );

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return g;
}

function Glasses() {
  const [group, setGroup] = useState<THREE.Group | null>(null);
  useShadowRefresh(group);

  // Built inside the effect rather than in a memo so that construction and
  // disposal are one unit. StrictMode does mount → unmount → mount: the
  // cleanup would dispose the frames and the second mount would *not* re-run
  // a memo (its dependencies never changed), leaving the scene drawing freed
  // GPU resources — a failure that only ever shows up in dev.
  useEffect(() => {
    const g = buildGlasses();
    setGroup(g);
    return () => {
      setGroup(null);
      // Hand-built geometry and materials; React will not collect these. One
      // material is shared by every mesh in the group, hence the Set.
      const mats = new Set<THREE.Material>();
      g.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        mats.add(mesh.material as THREE.Material);
      });
      for (const m of mats) m.dispose();
    };
  }, []);

  return group ? <primitive object={group} /> : null;
}

/* ------------------------------------------------------------------ *
 * Decals
 * ------------------------------------------------------------------ */

type Placed = {
  id: string;
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
};

function Decals({
  mesh,
  hits,
}: {
  mesh: THREE.Mesh | null;
  hits: Record<string, SurfaceHit>;
}) {
  const overrides = useIntroStore((s) => s.overrides);
  const [placed, setPlaced] = useState<Placed[]>([]);
  useShadowRefresh(placed);

  // Projected in the effect, not in a memo, for the same reason as Glasses:
  // StrictMode's unmount runs the cleanup and the remount does not rebuild a
  // memo whose dependencies are unchanged, so the decals would render with a
  // disposed geometry and texture.
  useEffect(() => {
    if (!mesh) return;

    const out: Placed[] = [];
    for (const raw of INTRO_STICKERS) {
      const sticker = resolveSticker(raw, overrides);
      const hit = hits[sticker.id];
      // Misses are reported once from AvatarScene, which computes them.
      if (!hit) continue;

      const { texture, aspect } = createStickerTexture({
        label: sticker.label,
        icon: sticker.icon,
        shape: sticker.shape,
        bg: sticker.colors.bg,
        ink: sticker.colors.ink,
      });

      const height = sticker.size;
      const width = height * aspect;
      // Depth of the projection box: too thin and the decal tears across the
      // curve, too deep and it punches through to the back of the head.
      const depth = Math.max(width, height) * 0.9;

      const geometry = new DecalGeometry(
        mesh,
        hit.position,
        decalOrientation(hit, sticker.rotation),
        new THREE.Vector3(width, height, depth)
      );

      out.push({ id: sticker.id, geometry, texture });
    }
    setPlaced(out);

    return () => {
      setPlaced([]);
      for (const p of out) {
        p.geometry.dispose();
        p.texture.dispose();
      }
    };
  }, [mesh, hits, overrides]);

  return (
    <group>
      {placed.map((p) => (
        <mesh key={p.id} geometry={p.geometry} renderOrder={2}>
          <meshStandardMaterial
            map={p.texture}
            transparent
            depthTest
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-6}
            roughness={0.75}
            metalness={0}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * Camera: orbiting from sticker to sticker
 * ------------------------------------------------------------------ */

type Stop = {
  /**
   * Which sticker this stop belongs to: an index into `INTRO_STICKERS`, with
   * -1 for the opening frame and `INTRO_STICKERS.length` for the closing one —
   * exactly the contract `activeIndex` documents in lib/intro/store.ts.
   *
   * Carried rather than derived from the stop's position in the array: a ray
   * that misses drops its stop, and every card from there on would then be
   * paired with the wrong sticker, the last one would never show, and the
   * closing frame would arrive a viewport early.
   */
  index: number;
  theta: number;
  phi: number;
  radius: number;
  target: THREE.Vector3;
};

function buildStops(
  hits: Record<string, SurfaceHit>,
  overrides: Record<string, StickerOverride>,
  /** Portrait compensation: three's fov is vertical, so a narrow viewport
   *  crops the horizontal one down to half a face. */
  nodeDistanceScale = 1
): Stop[] {
  const stops: Stop[] = [
    // Opening frame: head-on and far. The target is pushed below the face so
    // the portrait rides the upper half and leaves room for the title.
    {
      index: -1,
      theta: 0,
      phi: 4,
      radius: 4.7,
      target: new THREE.Vector3(0, -0.42, 0),
    },
  ];

  INTRO_STICKERS.forEach((raw, i) => {
    const sticker = resolveSticker(raw, overrides);
    const hit = hits[sticker.id];
    if (!hit) return;
    const d = vectorToDir(hit.position.clone());
    stops.push({
      index: i,
      theta: d.theta,
      // The camera deliberately does not sit on the decal's normal: a sticker
      // on the forehead would turn the shot into a view of the top of the
      // head. Squashing the elevation keeps it near eye level, at the cost of
      // some perspective skew on the decal — which looks more natural anyway.
      // This model has a lot of hair, so 0.6 still gave up a third of the
      // frame to the crown; 0.45 it is.
      phi: d.phi * 0.45,
      radius: hit.position.length() + sticker.distance * nodeDistanceScale,
      target: hit.position.clone(),
    });
  });

  // Closing frame: back to the front.
  stops.push({
    index: INTRO_STICKERS.length,
    theta: 0,
    phi: 2,
    radius: 4.2,
    target: new THREE.Vector3(0, -0.3, 0),
  });

  return stops;
}

/** Shortest-path angle interpolation, so +170° → -170° does not spin the
 *  long way round. */
function lerpAngle(a: number, b: number, t: number) {
  const delta = ((b - a + 540) % 360) - 180;
  return a + delta * t;
}

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** A gap this long between two useFrame calls means frames stopped, not that
 *  one was slow — a dozen dropped frames at 60 Hz. */
const RESUME_GAP_MS = 200;

function CameraRig({ hits }: { hits: Record<string, SurfaceHit> }) {
  const overrides = useIntroStore((s) => s.overrides);
  const setActiveIndex = useIntroStore((s) => s.setActiveIndex);
  const editing = useIntroStore((s) => s.editing);

  const target = useRef(new THREE.Vector3());
  const aim = useRef(new THREE.Vector3());
  const axis = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());
  const smoothed = useRef(0);
  const lastTick = useRef(0);
  const { camera, size, invalidate } = useThree();
  const wide = size.width >= 640;

  const aspect = size.width / Math.max(1, size.height);
  const nodeScale =
    aspect >= 1 ? 1 : THREE.MathUtils.clamp(1.5 / aspect, 1, 2.05);

  const stops = useMemo(
    () => buildStops(hits, overrides, nodeScale),
    [hits, overrides, nodeScale]
  );

  useFrame((_, delta) => {
    // In edit mode OrbitControls owns the camera — scroll must not drag it.
    if (editing || stops.length < 2) return;

    // IntroStage cuts the frameloop while the stage is off screen, but
    // ScrollTrigger keeps writing scrollState.progress, so `smoothed` comes
    // back arbitrarily stale. R3F restarts the clock when frameloop resumes
    // (setFrameloop → clock.start()), so `delta` is an ordinary ~16 ms and the
    // damping below cannot tell — it would spend half a second sweeping the
    // camera to catch up, right as the visitor scrolls the stage back in.
    // Wall-clock is the only honest signal that frames stopped. The very first
    // frame counts as a resume too, which is what deep-linking into a restored
    // scroll position wants.
    const now = performance.now();
    const resumed = now - lastTick.current > RESUME_GAP_MS;
    lastTick.current = now;

    // Damp the scroll value itself as well, so a mouse wheel's discrete jumps
    // come out as continuous camera movement.
    const k = 1 - Math.pow(0.0015, delta);
    smoothed.current = resumed
      ? scrollState.progress
      : smoothed.current + (scrollState.progress - smoothed.current) * k;

    const seg =
      THREE.MathUtils.clamp(smoothed.current, 0, 1) * (stops.length - 1);
    const i = Math.min(Math.floor(seg), stops.length - 2);
    const t = easeInOutCubic(seg - i);

    const a = stops[i];
    const b = stops[i + 1];

    const theta = lerpAngle(a.theta, b.theta, t);
    const phi = THREE.MathUtils.lerp(a.phi, b.phi, t);
    const radius = THREE.MathUtils.lerp(a.radius, b.radius, t);

    camera.position.copy(dirVector(theta, phi, dir.current)).multiplyScalar(radius);
    target.current.lerpVectors(a.target, b.target, t);
    camera.lookAt(target.current);

    // Make room for the card: push the aim point towards it and the sticker
    // drifts to the other half of the screen. The weight falls to zero at
    // both ends, or the carefully framed opening shot gets shoved off centre.
    const bias = THREE.MathUtils.clamp(
      Math.min(seg, stops.length - 1 - seg),
      0,
      1
    );
    if (bias > 0.001) {
      aim.current.copy(target.current);
      if (wide) {
        // Card on the right → pan right, sticker lands on the left.
        axis.current.set(1, 0, 0).applyQuaternion(camera.quaternion);
        aim.current.addScaledVector(axis.current, 0.22 * bias);
      } else {
        // Card along the bottom → lift the portrait into the upper half.
        // Gently: the chin sticker is already low, and any more pushes the
        // face out of frame entirely.
        axis.current.set(0, 1, 0).applyQuaternion(camera.quaternion);
        aim.current.addScaledVector(axis.current, -0.1 * radius * bias);
      }
      camera.lookAt(aim.current);
    }

    // The stop knows which sticker it is. Deriving it from `seg` instead would
    // be off by one for every stop after a ray that missed.
    setActiveIndex(stops[Math.round(seg)].index);

    // ScrollTrigger asks for a frame per scroll event, but the damping above
    // keeps moving for most of a second after the wheel stops — so the last
    // scroll event alone would leave the camera parked mid-glide. Re-arm until
    // `smoothed` has caught up with where the scroll actually is; the same
    // threshold logic as the light rig, scaled to a 0..1 progress value.
    if (Math.abs(scrollState.progress - smoothed.current) > 0.0001) {
      invalidate();
    }
  });

  return null;
}

/* ------------------------------------------------------------------ *
 * Assembly
 * ------------------------------------------------------------------ */

export default function AvatarScene({ tone }: { tone: Tone }) {
  const { root, mesh } = useAvatar();
  const overrides = useIntroStore((s) => s.overrides);
  const setReady = useIntroStore((s) => s.setReady);
  const editing = useIntroStore((s) => s.editing);
  const setPick = useIntroStore((s) => s.setPick);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  // Hand the outside world its way to ask for a frame — ScrollTrigger's
  // onUpdate and the stage's on-screen check both live outside this tree. Torn
  // down on unmount so a stale closure cannot poke a disposed renderer.
  useEffect(() => {
    renderOnDemand.request = invalidate;
    return () => {
      renderOnDemand.request = () => {};
    };
  }, [invalidate]);

  // Static geometry, static lights: the shadow pass is driven by hand from
  // here on (see useShadowRefresh). Set on the renderer, which belongs to this
  // canvas alone, so nothing else on the site is affected.
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
  }, [gl]);

  useShadowRefresh(mesh);

  // Where each sticker lands on the surface. Recomputed only when the model
  // or an angle changes.
  const { hits, missedKey } = useMemo(() => {
    const out: Record<string, SurfaceHit> = {};
    if (!mesh) return { hits: out, missedKey: "" };
    root.updateMatrixWorld(true);
    const missed: string[] = [];
    for (const raw of INTRO_STICKERS) {
      const sticker = resolveSticker(raw, overrides);
      const hit = projectToSurface(
        mesh,
        dirVector(sticker.dir.theta, sticker.dir.phi)
      );
      if (hit) out[sticker.id] = hit;
      else missed.push(sticker.id);
    }
    return { hits: out, missedKey: missed.join(", ") };
  }, [root, mesh, overrides]);

  // A missed ray is silent otherwise — it drops both a decal and a camera
  // stop — and docs/INTRO3D.md tells the author to place these angles by hand,
  // so it has to be loud. Reported from an effect and only when the set of
  // offenders changes: warning during render fires twice under StrictMode and
  // again on every unrelated re-render.
  const warned = useRef("");
  useEffect(() => {
    if (!missedKey || warned.current === missedKey) return;
    warned.current = missedKey;
    console.warn(
      `[intro] no surface under: ${missedKey} — each of those loses its sticker and its camera stop. ` +
        `Fix dir.theta / dir.phi for those ids in src/lib/intro/stickers.ts; place them with ?edit=1 (docs/INTRO3D.md).`
    );
  }, [missedKey]);

  useEffect(() => {
    if (mesh) setReady(true);
  }, [mesh, setReady]);

  return (
    <>
      <Atmosphere tone={tone} />

      <primitive
        object={root}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          // Edit mode: click anywhere on the face to move the selected
          // sticker there.
          if (!editing) return;
          e.stopPropagation();
          const d = vectorToDir(e.point.clone());
          setPick(+d.theta.toFixed(1), +d.phi.toFixed(1));
        }}
      />

      <Glasses />
      <Decals mesh={mesh} hits={hits} />
      <CameraRig hits={hits} />
      {editing && <OrbitControls makeDefault enablePan={false} />}
    </>
  );
}

useGLTF.preload(MODEL_URL, DRACO_DECODER_PATH);
