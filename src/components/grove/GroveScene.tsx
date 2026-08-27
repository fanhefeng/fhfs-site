"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { gsap } from "@/lib/gsap";
import { hasWebGL, prefersSaveData } from "@/lib/three/guards";
import { buildGrove, buildMotes, BOX_W } from "@/lib/grove/geometry";
import { bakeBarkPlates } from "@/lib/grove/bark";
import {
  BARK_VERT, BARK_FRAG,
  GRASS_VERT, GRASS_FRAG,
  FERN_VERT, FERN_FRAG,
  FLOWER_VERT, FLOWER_FRAG,
  WIRE_VERT, WIRE_FRAG,
  MOTE_VERT, MOTE_FRAG,
  SPRAY_VERT, SPRAY_FRAG,
  WING_VERT, WING_FRAG,
  BODY_VERT, BODY_FRAG,
} from "@/lib/grove/shaders";
import { flowerTexture, radialTexture, wingTexture, wingGeometry, bodyGeometry } from "@/components/grove/plates";

type Props = {
  /** The element the canvas fills, and the frame the pointer is read against. */
  heroRef: RefObject<HTMLElement | null>;
  /** The 1600 × 880 composition the moss is pinned to. */
  stageRef: RefObject<HTMLElement | null>;
  /** True while something opaque is lying over the whole canvas — the paper
   *  wash at the end of the approach. Read every frame; a covered scene draws
   *  nothing, the way an off-screen one draws nothing. */
  coveredRef?: RefObject<boolean>;
  /** Set once the page's entrance has been kicked off. */
  onReady?: () => void;
};

/* ────────────────────────────────────────────────────────────────────────
   the composition
   ──────────────────────────────────────────────────────────────────────── */

/**
 * One world unit is one CSS pixel at z = 0.
 *
 * That is the whole trick behind the layout: put the camera a fixed distance
 * back and solve the FOV from the viewport's height, and the moss can be
 * pinned to the same stage coordinates the copy is laid out on — the arch
 * lands on the card's shoulder because both are measured in the same units,
 * not because a magic number was nudged until it did.
 */
const DIST = 1400;

/** How long the survey front takes to cross the frame, in seconds. */
const SCAN_DUR = 3.4;

/**
 * Frame pacing. gsap's ticker fires at the display's own rate — 120Hz on a
 * ProMotion panel — and nothing here moves fast enough to want it: the fur
 * sways, the pollen drifts, and the quickest thing in the frame is a wingbeat
 * at nine or ten a second. Drawing every tick on such a panel simply doubles
 * the GPU's work for a picture nobody can tell apart, and the fan noise that
 * goes with it. So: sixty at most, and thirty once the window has lost focus —
 * the hero is still showing, someone is just working in the window beside it.
 *
 * Thirty, too, once the reader has been still for a couple of seconds. What
 * was measured (Chrome, Apple GPU, the moss at rest): the drawing itself is
 * the smaller part of a frame's bill, and the larger part is the same size
 * whatever is drawn — presenting a full-viewport canvas and recompositing the
 * page over it. The one lever on that is how many frames are asked for, and
 * a reader who is not moving the pointer or the page is watching pollen
 * drift, which thirty a second carries. The first move brings sixty back
 * before the frame it lands on: the fur parts under the pointer, the
 * butterfly is startled, and those want the rate.
 */
const FPS_FOCUSED = 60;
const FPS_BLURRED = 30;
const FPS_IDLE = 30;
/** How long without pointer, wheel or key input counts as being still. */
const IDLE_AFTER_MS = 2500;

/**
 * The fill budget, in drawn pixels. The pixel ratio is solved from this rather
 * than pinned: at a flat 2× a full-viewport hero on a 16" laptop is six
 * million pixels, and the fur is soft enough that ~1.4× reads the same.
 * Phones stay under it at their own cap; a 5K display lands a little under 1×
 * rather than at the sixteen million it would otherwise ask for.
 */
const PIXEL_BUDGET = 2_800_000;

/**
 * Each root is modelled in its own box, and the box is placed on the stage.
 * `w`/`left`/`top` are stage pixels; `aspect` is the box's own proportion,
 * which is what the traced control points were measured against.
 */
const ARCH = { w: 1900, left: -180, top: 306, aspect: 2800 / 1377 };
const ARCH_N = { w: 1120, left: -290, top: 555, aspect: 2800 / 1377 };
const FAR = { w: 1150, left: -40, top: 320, aspect: 1600 / 757, z: -260 };
const FAR_N = { w: 780, left: -110, top: 600, aspect: 1600 / 757, z: -260 };

type Box = { w: number; left: number; top: number; aspect: number };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * The moss hero: two roots grown from one seed, pinned to the page's own grid.
 *
 * Everything the scene draws is procedural — swept tubes, a cushion that
 * follows the light, ferns, flower sprays and the better part of a quarter of
 * a million instanced blades. What it loads is its own code.
 *
 * Unlike the lab study, this one runs on a clock: the survey pulse is the
 * page's entrance, the butterfly flies a real circuit and is wary of the
 * pointer, and the pollen drifts. It is gated on the hero actually being on
 * screen, so scrolling past it or switching tabs stops it dead.
 */
export function GroveScene({ heroRef, stageRef, coveredRef, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const hero = heroRef.current;
    const stage = stageRef.current;
    if (!canvas || !hero || !stage) return;

    if (prefersSaveData() || !hasWebGL()) {
      onReady?.();
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    } catch {
      onReady?.();
      return;
    }

    let disposed = false;
    /* The render gate. A frame is drawn when something on screen can have
       changed; the loop below decides most of that from its own state, and
       the events that change the picture without going through that state
       (resize, a burst, the tab coming back) raise this flag instead. Declared
       up here because layout() — the first of those — runs before the loop
       exists. */
    let needsRender = true;
    const narrow = window.matchMedia("(max-width: 900px)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const small = narrow.matches || window.innerWidth * window.innerHeight < 620_000;

    // The shaders tone-map and encode their own output, so three must not do it
    // a second time on the way to the canvas.
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    // The pixel ratio is set in layout(), where the canvas's size is known.

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 10, 8000);
    camera.position.set(0, 0, DIST);

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];

    /* ---- what every material agrees on ---- */
    const shared = {
      uKeyDir: { value: new THREE.Vector3(-0.3, 0.92, 0.28).normalize() },
      uKeyCol: { value: new THREE.Color(1.14, 1.06, 0.88) },
      uFillDir: { value: new THREE.Vector3(0.12, -0.86, 0.5).normalize() },
      // the pale pool on the floor of the hero, bouncing back up
      uFillCol: { value: new THREE.Color(0.78, 0.78, 0.62) },
      uAmbCol: { value: new THREE.Color(0.086, 0.09, 0.08) },
      uPhase: { value: 0 },
      uScanO: { value: new THREE.Vector3(-900, -260, 240) },
      uScanR: { value: 0 },
      // Here a world unit is a CSS pixel, so the front's wobble has to be
      // rescaled out of the root-width units it was written in.
      uScanW: { value: new THREE.Vector2(0.0122, 120) },
      uScanLag: { value: 520 },
      uWire: { value: 0 },
      // Nothing grows or blooms on a schedule on this page: the survey draws
      // the root in already finished.
      uGrow: { value: 1 },
      uBloom: { value: 1 },
    };

    type Air = {
      box: Box;
      haze: number;
      fog: number;
      hazeLift: number;
      hazeCol: [number, number, number];
      mouseR: number;
      mask: [number, number, number, number] | null;
    };

    const groupUniforms = (air: Air) => ({
      ...shared,
      uHazeCol: { value: new THREE.Color(...air.hazeCol) },
      uHaze: { value: air.haze },
      uFog: { value: air.fog },
      uHazeLift: { value: air.hazeLift },
      uBoxH: { value: BOX_W / air.box.aspect },
      // The end-fade belongs to the lab study's framing; here the mask does
      // the work, so this is pushed out of reach.
      uCut: { value: new THREE.Vector3(0, 1e6, 1) },
      uMask: { value: new THREE.Vector4(...(air.mask ?? [0, 1, 0, 1])) },
      uMaskOn: { value: air.mask ? 1 : 0 },
      uMouse: { value: new THREE.Vector3(9999, 9999, 9999) },
      uMouseR: { value: air.mouseR },
    });

    // The bark's own picture, baked once — the single biggest saving in the
    // scene, see lib/grove/bark.ts.
    const barkPlates = bakeBarkPlates(renderer, small);

    const flowerMap = flowerTexture();
    const moteMap = radialTexture(64, [
      [0, "rgba(255,255,255,1)"],
      [0.35, "rgba(236,244,224,0.5)"],
      [1, "rgba(236,244,224,0)"],
    ]);
    textures.push(flowerMap, moteMap);

    /* ---- one root, assembled ---- */
    type Built = {
      group: THREE.Group;
      uniforms: ReturnType<typeof groupUniforms>;
      wire: THREE.LineSegments;
      box: Box;
      /** The opaque meshes and the discard-free copy of each one's material,
       *  swapped in once the survey is over — see SETTLED_DISCARD_GLSL. */
      settled: { mesh: THREE.Mesh; material: THREE.ShaderMaterial }[];
    };

    const assemble = (grove: ReturnType<typeof buildGrove>, air: Air, order: number): Built => {
      const group = new THREE.Group();
      const uniforms = groupUniforms(air);
      // A form that dissolves has to blend; it still writes depth, because the
      // fade is a sliver at the far end and skipping the depth buffer would put
      // the ridge's own far flank in front of its near one.
      const soft = !!air.mask;
      const settled: Built["settled"] = [];

      /* An opaque material and, for the root that never fades, its settled
         twin: same everything, discards compiled out. The blending root keeps
         its discards — a blended pile gets no hidden-surface removal anyway,
         and its ends really do fade to nothing. */
      const opaque = (params: THREE.ShaderMaterialParameters, mesh: (m: THREE.ShaderMaterial) => THREE.Mesh) => {
        const live = new THREE.ShaderMaterial({ ...params, transparent: soft, depthWrite: true, side: THREE.DoubleSide });
        const m = mesh(live);
        materials.push(live);
        if (!soft) {
          const calm = new THREE.ShaderMaterial({
            ...params, transparent: false, depthWrite: true, side: THREE.DoubleSide,
            defines: { SETTLED: 1 },
          });
          materials.push(calm);
          settled.push({ mesh: m, material: calm });
        }
        return m;
      };

      const barkGeo = new THREE.BufferGeometry();
      barkGeo.setAttribute("position", new THREE.BufferAttribute(grove.bark.position, 3));
      barkGeo.setAttribute("normal", new THREE.BufferAttribute(grove.bark.normal, 3));
      barkGeo.setAttribute("aInfo", new THREE.BufferAttribute(grove.bark.info, 3));
      barkGeo.setIndex(new THREE.BufferAttribute(grove.bark.index, 1));
      const bark = opaque(
        { uniforms: { ...uniforms, ...barkPlates.uniforms }, vertexShader: BARK_VERT, fragmentShader: BARK_FRAG },
        (m) => new THREE.Mesh(barkGeo, m)
      );
      bark.frustumCulled = false;
      bark.renderOrder = order;
      group.add(bark);
      geometries.push(barkGeo);

      /* fur: four rungs pinched to a point, instanced */
      const bladeGeo = new THREE.InstancedBufferGeometry();
      {
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
        bladeGeo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
        bladeGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
        bladeGeo.setIndex(idx);
      }
      bladeGeo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(grove.blades.offset, 3));
      bladeGeo.setAttribute("aNormal", new THREE.InstancedBufferAttribute(grove.blades.normal, 3));
      bladeGeo.setAttribute("aRandom", new THREE.InstancedBufferAttribute(grove.blades.random, 4));
      bladeGeo.setAttribute("aClump", new THREE.InstancedBufferAttribute(grove.blades.clump, 1));
      bladeGeo.instanceCount = grove.blades.count;
      const grass = opaque(
        { uniforms, vertexShader: GRASS_VERT, fragmentShader: GRASS_FRAG },
        (m) => new THREE.Mesh(bladeGeo, m)
      );
      grass.frustumCulled = false;
      grass.renderOrder = order + 0.1;
      group.add(grass);
      geometries.push(bladeGeo);

      /* ferns */
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
        const fern = opaque(
          { uniforms, vertexShader: FERN_VERT, fragmentShader: FERN_FRAG },
          (m) => new THREE.Mesh(fernGeo, m)
        );
        fern.frustumCulled = false;
        fern.renderOrder = order + 0.2;
        group.add(fern);
        geometries.push(fernGeo);
      }

      /* flowers */
      if (grove.flowers.count > 0) {
        const flowerGeo = new THREE.InstancedBufferGeometry();
        flowerGeo.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
        flowerGeo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
        flowerGeo.setIndex([0, 1, 2, 0, 2, 3]);
        flowerGeo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(grove.flowers.offset, 3));
        flowerGeo.setAttribute("aRandom", new THREE.InstancedBufferAttribute(grove.flowers.random, 2));
        flowerGeo.instanceCount = grove.flowers.count;
        const flowerMat = new THREE.ShaderMaterial({
          uniforms: { ...uniforms, uMap: { value: flowerMap } },
          vertexShader: FLOWER_VERT, fragmentShader: FLOWER_FRAG,
          transparent: true, depthWrite: false, side: THREE.DoubleSide,
        });
        const flowers = new THREE.Mesh(flowerGeo, flowerMat);
        flowers.frustumCulled = false;
        flowers.renderOrder = order + 0.3;
        group.add(flowers);
        geometries.push(flowerGeo);
        materials.push(flowerMat);
      }

      /* the survey cage */
      const wireGeo = new THREE.BufferGeometry();
      wireGeo.setAttribute("position", new THREE.BufferAttribute(grove.wire, 3));
      const wireMat = new THREE.ShaderMaterial({
        uniforms: {
          uScanO: shared.uScanO,
          uScanR: shared.uScanR,
          uWire: shared.uWire,
          uPhase: shared.uPhase,
          uWireK: { value: new THREE.Vector3(135, 950, 0.045) },
        },
        vertexShader: WIRE_VERT, fragmentShader: WIRE_FRAG,
        transparent: true, depthWrite: false, depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      const wire = new THREE.LineSegments(wireGeo, wireMat);
      wire.frustumCulled = false;
      wire.renderOrder = 8;
      group.add(wire);
      geometries.push(wireGeo);
      materials.push(wireMat);

      scene.add(group);
      return { group, uniforms, wire, box: air.box, settled };
    };

    const near = buildGrove({
      variant: "near",
      blades: small ? 70_000 : 190_000,
      flowers: small ? 120 : 260,
      ferns: small ? 26 : 46,
      fernSize: [0.22, 0.5],
      flowerSize: [0.055, 0.118],
    });
    const far = buildGrove({
      variant: "far",
      blades: small ? 20_000 : 60_000,
      flowers: small ? 40 : 90,
      ferns: small ? 8 : 16,
      fernSize: [0.26, 0.56],
      flowerSize: [0.034, 0.062],
    });

    const nearBuilt = assemble(near, {
      box: ARCH, haze: 0.15, fog: 0, hazeLift: 0.2,
      hazeCol: [0.176, 0.195, 0.145], mouseR: 1.2, mask: null,
    }, 2);
    // The ridge dissolves before it reaches the cards (local x 0.4 → 3.4) and
    // into the floor light below it (the lower 0–42% of its box).
    const farBuilt = assemble(far, {
      box: FAR, haze: 0.16, fog: 0.26, hazeLift: 0.92,
      hazeCol: [0.15, 0.164, 0.12], mouseR: 1.4, mask: [0.4, 3.4, 0, 0.42],
    }, 0);

    /* ---- shadow and light pool: everything that needs no geometry ---- */
    const plane = new THREE.PlaneGeometry(1, 1);
    geometries.push(plane);
    const shadowMap = radialTexture(256, [
      [0, "rgba(12,16,10,0.62)"],
      [0.45, "rgba(12,16,10,0.26)"],
      [1, "rgba(12,16,10,0)"],
    ]);
    const glowMap = radialTexture(256, [
      [0, "rgba(226,236,212,0.30)"],
      [0.42, "rgba(214,226,200,0.10)"],
      [1, "rgba(214,226,200,0)"],
    ]);
    textures.push(shadowMap, glowMap);

    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false, depthTest: false });
    const shadowMesh = new THREE.Mesh(plane, shadowMat);
    shadowMesh.renderOrder = 1;
    shadowMesh.position.z = -70;
    scene.add(shadowMesh);
    materials.push(shadowMat);

    const glowMat = new THREE.MeshBasicMaterial({ map: glowMap, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
    const glowMesh = new THREE.Mesh(plane, glowMat);
    glowMesh.renderOrder = -1;
    glowMesh.position.z = -320;
    scene.add(glowMesh);
    materials.push(glowMat);

    /* ---- drifting pollen, inside the near root's own space ----
       Riding the group rather than the scene means it is measured in root
       widths like everything else, so one set of numbers serves every
       breakpoint — and it picks up the root's parallax for free. */
    const motes = buildMotes(small ? 1500 : 4200);
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute("position", new THREE.BufferAttribute(motes.position, 3));
    moteGeo.setAttribute("aSeed", new THREE.BufferAttribute(motes.seed, 4));
    const moteUniforms = {
      uPhase: shared.uPhase,
      uMap: { value: moteMap },
      uSize: { value: 3 },
      uScale: { value: 400 },
      uClimb: { value: motes.climb },
    };
    const moteMat = new THREE.ShaderMaterial({
      uniforms: moteUniforms, vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const moteField = new THREE.Points(moteGeo, moteMat);
    moteField.frustumCulled = false;
    moteField.renderOrder = 6;
    moteField.scale.setScalar(0.55);
    nearBuilt.group.add(moteField);
    geometries.push(moteGeo);
    materials.push(moteMat);

    /* ---- the trail the pointer lifts off the moss ---- */
    const SPRAY_N = 620;
    const SPRAY_LIFE = 1.6;
    const sprayPos = new Float32Array(SPRAY_N * 3);
    const sprayVel = new Float32Array(SPRAY_N * 3);
    const sprayBirth = new Float32Array(SPRAY_N).fill(-999);
    const sprayRnd = new Float32Array(SPRAY_N * 2);
    const sprayGeo = new THREE.BufferGeometry();
    sprayGeo.setAttribute("position", new THREE.BufferAttribute(sprayPos, 3));
    sprayGeo.setAttribute("aVel", new THREE.BufferAttribute(sprayVel, 3));
    sprayGeo.setAttribute("aBirth", new THREE.BufferAttribute(sprayBirth, 1));
    sprayGeo.setAttribute("aRnd", new THREE.BufferAttribute(sprayRnd, 2));
    const sprayUniforms = {
      uNow: { value: 0 },
      uMap: { value: moteMap },
      uSize: { value: 4.4 },
      uScale: moteUniforms.uScale,
      uLife: { value: SPRAY_LIFE },
    };
    const sprayMat = new THREE.ShaderMaterial({
      uniforms: sprayUniforms, vertexShader: SPRAY_VERT, fragmentShader: SPRAY_FRAG,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    const sprayField = new THREE.Points(sprayGeo, sprayMat);
    sprayField.frustumCulled = false;
    sprayField.renderOrder = 7;
    nearBuilt.group.add(sprayField);
    geometries.push(sprayGeo);
    materials.push(sprayMat);

    let sprayHead = 0;
    let sprayDirty = false;
    const spawnGrain = (p: THREE.Vector3, boost = 1) => {
      const i = sprayHead;
      sprayHead = (sprayHead + 1) % SPRAY_N;
      const o = i * 3;
      const k = boost;
      sprayPos[o] = p.x + (Math.random() - 0.5) * 0.16 * k;
      sprayPos[o + 1] = p.y + (Math.random() - 0.5) * 0.16 * k;
      sprayPos[o + 2] = p.z + (Math.random() - 0.5) * 0.48;
      sprayVel[o] = (Math.random() - 0.5) * 0.4 * k;
      sprayVel[o + 1] = (0.012 + Math.random() * 0.33 + 0.12 * (k - 1)) * k;
      sprayVel[o + 2] = (Math.random() - 0.5) * 0.28 * k;
      sprayBirth[i] = clock;
      sprayRnd[i * 2] = 0.5 + Math.random() * 0.65;
      sprayRnd[i * 2 + 1] = Math.random();
      sprayDirty = true;
    };
    const flushGrains = () => {
      if (!sprayDirty) return;
      const at = sprayGeo.attributes;
      at.position.needsUpdate = true;
      at.aVel.needsUpdate = true;
      at.aBirth.needsUpdate = true;
      at.aRnd.needsUpdate = true;
      sprayDirty = false;
    };

    /* ---- butterfly ---- */
    const wingMap = wingTexture();
    textures.push(wingMap);
    const bendFore = { value: 0 };
    const bendHind = { value: 0 };
    const wingMaterial = (hind: boolean, bend: { value: number }) =>
      new THREE.ShaderMaterial({
        uniforms: {
          uKeyDir: shared.uKeyDir, uKeyCol: shared.uKeyCol, uAmbCol: shared.uAmbCol,
          uBend: bend, uHind: { value: hind ? 1 : 0 }, uTex: { value: wingMap },
        },
        vertexShader: WING_VERT, fragmentShader: WING_FRAG, side: THREE.DoubleSide,
      });
    const foreMat = wingMaterial(false, bendFore);
    const hindMat = wingMaterial(true, bendHind);
    const bodyMat = new THREE.ShaderMaterial({
      uniforms: { uKeyDir: shared.uKeyDir, uKeyCol: shared.uKeyCol, uAmbCol: shared.uAmbCol },
      vertexShader: BODY_VERT, fragmentShader: BODY_FRAG,
    });
    const antMat = new THREE.MeshBasicMaterial({ color: 0x171208 });
    materials.push(foreMat, hindMat, bodyMat, antMat);

    const foreGeo = wingGeometry(false);
    const hindGeo = wingGeometry(true);
    const trunkGeo = bodyGeometry();
    const tegulaGeo = new THREE.SphereGeometry(0.052, 12, 9);
    const clubGeo = new THREE.SphereGeometry(0.013, 8, 6);
    geometries.push(foreGeo, hindGeo, trunkGeo, tegulaGeo, clubGeo);

    const butterfly = new THREE.Group();
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
    butterfly.add(foreR, foreL, hindR, hindL);
    butterfly.add(new THREE.Mesh(trunkGeo, bodyMat));
    for (const sx of [1, -1] as const) {
      const teg = new THREE.Mesh(tegulaGeo, bodyMat);
      teg.position.set(0.03 * sx, 0.026, 0.02);
      teg.scale.set(1.15, 0.62, 1.5);
      teg.rotation.z = -0.35 * sx;
      butterfly.add(teg);
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0.01 * sx, 0.02, 0.15),
        new THREE.Vector3(0.062 * sx, 0.075, 0.3),
        new THREE.Vector3(0.105 * sx, 0.11, 0.43)
      );
      const antGeo = new THREE.TubeGeometry(curve, 12, 0.0042, 5, false);
      geometries.push(antGeo);
      butterfly.add(new THREE.Mesh(antGeo, antMat));
      const club = new THREE.Mesh(clubGeo, antMat);
      club.position.copy(curve.getPointAt(1));
      club.scale.z = 1.9;
      butterfly.add(club);
    }
    butterfly.scale.setScalar(0.205);
    butterfly.renderOrder = 5;
    butterfly.traverse((o) => { o.frustumCulled = false; });
    nearBuilt.group.add(butterfly);

    /* ---- the flight ----
       A cycle: cruise, approach, settle on the crest with the wings held open,
       take off, round again. The pointer is already carried into this group's
       local space for the moss, so the animal reads the same value — no extra
       raycast, and in the units it flies in. */
    const perch = near.perch.clone();
    const BOX3 = {
      x0: perch.x - 1.5, x1: perch.x + 2.1,
      y0: perch.y - 0.1, y1: perch.y + 1.35,
      z0: perch.z - 0.25, z1: perch.z + 0.95,
    };
    const rand = (lo: number, hi: number) => lo + (hi - lo) * Math.random();
    const st = {
      pos: perch.clone().add(new THREE.Vector3(-1, 1.1, 0.5)),
      vel: new THREE.Vector3(0.5, 0, 0),
      acc: new THREE.Vector3(),
      tgt: new THREE.Vector3(),
      mode: "cruise" as "cruise" | "approach" | "landed" | "takeoff",
      timer: 4,
      settle: 0,
      bank: 0,
      flap: 0,
    };
    const pickTarget = () => {
      st.tgt.set(
        rand(BOX3.x0 + 0.3, BOX3.x1 - 0.3),
        rand(perch.y + 0.35, BOX3.y1 - 0.2),
        rand(BOX3.z0 + 0.2, BOX3.z1 - 0.15)
      );
    };
    pickTarget();

    /* The display pose: dorsal surface square to the lens, head up — the whole
       point of the landing is that the open wings are seen. */
    const landQ = new THREE.Quaternion();
    const solveLandQ = () => {
      const camLocal = new THREE.Vector3(0, 0, DIST);
      nearBuilt.group.updateMatrixWorld(true);
      nearBuilt.group.worldToLocal(camLocal);
      const dorsal = camLocal.sub(perch).normalize();
      const fwd = new THREE.Vector3(0, 1, 0).addScaledVector(dorsal, -dorsal.y).normalize();
      const right = new THREE.Vector3().crossVectors(dorsal, fwd).normalize();
      landQ.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, dorsal, fwd));
      landQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.1));
      landQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.14));
    };

    const SPOOK_R = 0.62;
    let spook = 0;
    const toM = new THREE.Vector3();
    const away = new THREE.Vector3(0, 1, 0);
    const tmpV = new THREE.Vector3();
    const prevVel = new THREE.Vector3();
    const vRight = new THREE.Vector3();
    const vUp = new THREE.Vector3();
    const vFwd = new THREE.Vector3();
    const basis = new THREE.Matrix4();
    const flightQ = new THREE.Quaternion();
    const qTmp = new THREE.Quaternion();
    const AX_X = new THREE.Vector3(1, 0, 0);
    const AX_Z = new THREE.Vector3(0, 0, 1);
    const UP = new THREE.Vector3(0, 1, 0);

    const contain = (out: THREE.Vector3) => {
      const k = 2.2;
      const m = 0.3;
      if (st.pos.x < BOX3.x0 + m) out.x += k * (BOX3.x0 + m - st.pos.x);
      if (st.pos.x > BOX3.x1 - m) out.x -= k * (st.pos.x - BOX3.x1 + m);
      if (st.pos.y < BOX3.y0 + m) out.y += k * (BOX3.y0 + m - st.pos.y);
      if (st.pos.y > BOX3.y1 - m) out.y -= k * (st.pos.y - BOX3.y1 + m);
      if (st.pos.z < BOX3.z0 + m) out.z += k * (BOX3.z0 + m - st.pos.z);
      if (st.pos.z > BOX3.z1 - m) out.z -= k * (st.pos.z - BOX3.z1 + m);
    };

    const flyButterfly = (dt: number, t: number) => {
      const m = nearBuilt.uniforms.uMouse.value;
      let nearness = 0;
      if (m.x < 999) {
        // z is weighted down because the pointer is resolved on one plane and
        // the butterfly is not on it; what matters is whether the cursor is
        // over the animal on screen.
        toM.set(m.x - st.pos.x, m.y - st.pos.y, (m.z - st.pos.z) * 0.3);
        nearness = clamp01(1 - toM.length() / SPOOK_R);
        nearness *= nearness;
      }
      // snaps on, lets go slowly — a startled insect does not calm instantly
      spook += (nearness - spook) * (1 - Math.pow(nearness > spook ? 1e-7 : 0.22, dt));

      st.timer -= dt;
      if (st.mode === "cruise") {
        if (st.timer <= 0) { st.mode = "approach"; st.timer = 14; }
      } else if (st.mode === "approach") {
        if (st.pos.distanceTo(perch) < 0.12 || st.timer <= 0) { st.mode = "landed"; st.timer = rand(7, 10); }
      } else if (st.mode === "landed") {
        // the whole point of a perched insect is that it will not stay put
        if (st.timer <= 0 || spook > 0.3) {
          st.mode = "takeoff";
          st.timer = 2.2;
          if (spook > 0.3) {
            // leave in the opposite direction, not back across the cursor
            away.copy(st.pos).sub(m).setZ(0).normalize();
            st.tgt.set(
              Math.min(BOX3.x1 - 0.3, Math.max(BOX3.x0 + 0.3, st.pos.x + away.x * 1.5)),
              Math.min(BOX3.y1 - 0.2, perch.y + 0.9),
              Math.min(BOX3.z1 - 0.15, Math.max(BOX3.z0 + 0.2, st.pos.z + 0.4))
            );
          }
        }
      } else if (st.timer <= 0) {
        st.mode = "cruise";
        st.timer = rand(5, 8.5);
        pickTarget();
      }

      const landing = st.mode === "landed";
      st.settle += ((landing ? 1 : 0) - st.settle) * Math.min(1, dt * (landing ? 3.4 : 4.5));
      st.settle = Math.min(st.settle, 1 - spook);

      // quick asymmetric stroke in flight, a slow display at rest
      const cruiseBeat = 8.6 + Math.sin(t * 0.7) * 0.9;
      let beat = cruiseBeat + (0.34 - cruiseBeat) * st.settle;
      beat *= 1 + spook * 1.15;
      st.flap += dt * beat * Math.PI * 2;
      const raw = Math.sin(st.flap);
      const shaped = (raw < 0 ? -1 : 1) * Math.pow(Math.abs(raw), 0.72);
      // resting wings flare open as the cursor closes in — the flick a
      // butterfly gives just before it goes
      const flyPhi = 20 + 48 * shaped;
      const restPhi = 15 + 7 * shaped + spook * 30;
      const phi = ((flyPhi + (restPhi - flyPhi) * st.settle) * Math.PI) / 180;
      const flapVel = Math.cos(st.flap) * beat;

      foreR.rotation.z = phi;
      foreL.rotation.z = -phi;
      hindR.rotation.z = phi * 0.95 - 0.03;
      hindL.rotation.z = -(phi * 0.95 - 0.03);
      bendFore.value = -flapVel * 0.01;
      bendHind.value = -flapVel * 0.013;

      const goal = st.mode === "approach" ? perch : st.tgt;
      tmpV.copy(goal).sub(st.pos);
      const dist = tmpV.length();
      const speed = Math.min(1.5, 0.22 + dist * 1.1);
      const desired = tmpV.normalize().multiplyScalar(speed);

      // butterflies do not fly straight lines — but fade the wander out on
      // final approach or it circles the perch for ever without touching it
      const wander = st.mode === "approach" ? Math.min(1, dist * 0.8) : 1;
      desired.x += (Math.sin(t * 3.1) + 0.6 * Math.sin(t * 7.7 + 1.1)) * 0.2 * wander;
      desired.y += (Math.sin(t * 1.9 + 1.7) + 0.55 * Math.sin(t * 4.6)) * 0.4 * wander;
      desired.z += Math.sin(t * 2.7 + 3.4) * 0.24 * wander;
      if (st.mode === "takeoff") { desired.y += 0.7; desired.z += 0.35; }
      if (spook > 0.002) {
        away.copy(st.pos).sub(m);
        away.z *= 0.3;
        if (away.lengthSq() > 1e-6) desired.addScaledVector(away.normalize(), spook * 2.3);
      }
      contain(desired);

      prevVel.copy(st.vel);
      st.vel.lerp(desired, 1 - Math.pow(0.03, dt));
      st.acc.copy(st.vel).sub(prevVel).divideScalar(Math.max(dt, 1e-4));
      st.pos.addScaledVector(st.vel, dt);
      if (st.settle > 0.001) {
        st.pos.lerp(perch, Math.min(1, dt * 6 * st.settle));
        st.vel.multiplyScalar(1 - Math.min(1, dt * 6 * st.settle));
      }

      vFwd.copy(st.vel);
      if (vFwd.lengthSq() < 1e-6) vFwd.set(0, 0, 1);
      vFwd.normalize();
      vRight.crossVectors(vFwd, UP);
      if (vRight.lengthSq() < 1e-6) vRight.set(1, 0, 0);
      vRight.normalize();
      vUp.crossVectors(vRight, vFwd).normalize();

      const lateral = vRight.dot(st.acc);
      st.bank += (Math.max(-1.15, Math.min(1.15, -lateral * 0.4)) - st.bank) * Math.min(1, dt * 5);

      basis.makeBasis(vRight, vUp, vFwd);
      flightQ.setFromRotationMatrix(basis);
      qTmp.setFromAxisAngle(AX_Z, st.bank + Math.sin(t * 0.83) * 0.3 + Math.sin(st.flap) * 0.05 + Math.sin(t * 21) * spook * 0.16);
      flightQ.multiply(qTmp);
      qTmp.setFromAxisAngle(AX_X, Math.sin(st.flap) * 0.1 - 0.06);
      flightQ.multiply(qTmp);

      butterfly.quaternion.copy(flightQ).slerp(landQ, st.settle);
      butterfly.position.copy(st.pos);
      butterfly.position.y += Math.sin(st.flap - 0.9) * 0.022 * (1 - st.settle);
    };

    /* ---- layout: size the scene in stage-pixel space ---- */
    let W = 1;
    let H = 1;
    let scanMax = 1;

    const place = (group: THREE.Group, box: Box, pinFx: number, pinFy: number, z: number, u: number, ox: number, oy: number, cover: number) => {
      const boxH = box.w / box.aspect;
      const scale = (box.w * u * cover) / BOX_W;
      const k = (DIST - z) / DIST; // undo the perspective shrink
      const lx = (pinFx - 0.5) * BOX_W;
      const ly = (0.5 - pinFy) * (BOX_W / box.aspect);
      const px = ox + (box.left + pinFx * box.w) * u - W / 2;
      const py = H / 2 - (oy + (box.top + pinFy * boxH) * u);
      group.scale.setScalar(scale * k);
      group.position.set((px - lx * scale) * k, (py - ly * scale) * k, z);
      return { x: px, y: py, s: scale };
    };

    const layout = () => {
      W = hero.clientWidth;
      H = hero.clientHeight;
      if (!W || !H) return;
      const dpr = Math.max(
        1,
        Math.min(window.devicePixelRatio || 1, small ? 1.6 : 2, Math.sqrt(PIXEL_BUDGET / (W * H)))
      );
      renderer.setPixelRatio(dpr);
      renderer.setSize(W, H, false);
      camera.fov = (2 * Math.atan(H / 2 / DIST) * 180) / Math.PI;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();

      const isNarrow = narrow.matches;
      const s = stage.getBoundingClientRect();
      const h = hero.getBoundingClientRect();
      const u = s.width / (isNarrow ? 760 : 1600);
      const ox = s.left - h.left;
      const oy = s.top - h.top;
      // wider than the stage: grow the roots to cover, pinned at a landmark
      const cover = Math.max(1, W / s.width);

      const A = isNarrow ? ARCH_N : ARCH;
      const F = isNarrow ? FAR_N : FAR;
      nearBuilt.uniforms.uBoxH.value = BOX_W / A.aspect;
      farBuilt.uniforms.uBoxH.value = BOX_W / F.aspect;

      place(nearBuilt.group, A, 0.732, 0.06, 0, u, ox, oy, cover);
      place(farBuilt.group, F, 0.41, 0.32, F.z, u, ox, oy, cover);

      const aw = A.w * u * cover;
      const ah = aw / A.aspect;
      const cx = ox + (A.left + 0.5 * A.w) * u - W / 2;
      const cy = H / 2 - (oy + (A.top + 0.5 * (A.w / A.aspect)) * u);

      shadowMesh.scale.set(aw * 1.02, ah * 0.72, 1);
      shadowMesh.position.set(cx, cy - ah * 0.4, -70);
      glowMesh.scale.set(aw * 1.15, ah * 1.5, 1);
      glowMesh.position.set(cx - aw * 0.06, cy - ah * 0.18, -320);

      // The pulse leaves from the low left of the frame, in front of the root,
      // and has to reach the far corner. Resolved here because both depend on
      // where layout() has just put everything.
      nearBuilt.group.updateMatrixWorld(true);
      shared.uScanO.value.set(-5.2, -0.9, 1.8);
      nearBuilt.group.localToWorld(shared.uScanO.value);
      scanMax = Math.hypot(W, H) * 1.3 + 900;

      const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
      moteUniforms.uScale.value = (buf.y * 0.5) / Math.tan(((camera.fov * Math.PI) / 180) / 2);
      moteUniforms.uSize.value = Math.max(1.8, 3 * u * cover);
      sprayUniforms.uSize.value = Math.max(2.6, 4.4 * u * cover);

      solveLandQ();
      needsRender = true;
    };
    layout();

    /* ---- the pointer ---- */
    const raycaster = new THREE.Raycaster();
    const crownPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const ndc = new THREE.Vector2(10, 10);
    const hitWorld = new THREE.Vector3();
    const tmpLocal = new THREE.Vector3();
    const AWAY = new THREE.Vector3(9999, 9999, 9999);
    let mouseLive = false;
    const pointer = { x: 0, y: 0 };
    const smooth = { x: 0, y: 0 };

    const updateMouse = (dt: number) => {
      if (ndc.x > 2 || calm.matches) mouseLive = false;
      else {
        raycaster.setFromCamera(ndc, camera);
        mouseLive = !!raycaster.ray.intersectPlane(crownPlane, hitWorld);
      }
      for (const built of [nearBuilt, farBuilt]) {
        const u = built.uniforms.uMouse.value;
        if (!mouseLive) { u.copy(AWAY); continue; }
        tmpLocal.copy(hitWorld);
        built.group.worldToLocal(tmpLocal);
        if (u.x > 999) u.copy(tmpLocal);
        else u.lerp(tmpLocal, 1 - Math.pow(0.0002, dt));
      }
    };

    /* Emission by DISTANCE rather than by time, spread along the segment the
       pointer covered since the last frame: a fast sweep lays a trail instead
       of stacking a clump, and a hand that has stopped trickles. */
    const sprayLast = new THREE.Vector3(9999, 0, 0);
    const sprayStep = new THREE.Vector3();
    const sprayAt = new THREE.Vector3();
    let sprayIdle = 0;
    const emitSpray = (dt: number) => {
      if (!mouseLive) { sprayLast.x = 9999; return; }
      sprayAt.copy(hitWorld);
      nearBuilt.group.worldToLocal(sprayAt);
      if (sprayLast.x > 9000) { sprayLast.copy(sprayAt); return; }
      const n = Math.min(14, Math.floor(sprayAt.distanceTo(sprayLast) / 0.037));
      for (let k = 1; k <= n; k++) {
        sprayStep.lerpVectors(sprayLast, sprayAt, k / n);
        spawnGrain(sprayStep);
      }
      if (n > 0) { sprayLast.copy(sprayAt); sprayIdle = 0; }
      else {
        sprayIdle += dt;
        if (sprayIdle > 0.055) { spawnGrain(sprayAt); sprayIdle = 0; }
      }
      flushGrains();
    };

    /** A pressed control throws a handful of pollen off itself. */
    const burstNdc = new THREE.Vector2();
    const burstAt = new THREE.Vector3();
    const burst = (clientX: number, clientY: number) => {
      if (calm.matches) return;
      const r = hero.getBoundingClientRect();
      burstNdc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(burstNdc, camera);
      if (!raycaster.ray.intersectPlane(crownPlane, burstAt)) return;
      nearBuilt.group.worldToLocal(burstAt);
      for (let i = 0; i < 52; i++) spawnGrain(burstAt, 2.5);
      flushGrains();
      needsRender = true;
    };
    // The dock's pills ask for this by event, so nothing has to be threaded
    // through half the component tree to reach the emitter.
    const onBurst = (e: Event) => {
      const d = (e as CustomEvent<{ x: number; y: number }>).detail;
      if (d) burst(d.x, d.y);
    };
    hero.addEventListener("grove:burst", onBurst as EventListener);

    /* The last time the reader did anything — see FPS_IDLE. */
    let lastInput = performance.now();
    const markInput = () => { lastInput = performance.now(); };
    for (const type of ["wheel", "scroll", "keydown", "touchstart", "touchmove", "pointerdown"] as const) {
      window.addEventListener(type, markInput, { passive: true });
    }

    const onPointerMove = (e: PointerEvent) => {
      markInput();
      if (e.pointerType === "touch") return;
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      // The camera is framed on the hero, not on the window — on the narrow
      // layout the hero is the taller of the two, so the pointer has to be put
      // back into the canvas's own box or the moss parts in the wrong place.
      const r = hero.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      needsRender = true;
    };
    const onPointerLeave = () => {
      pointer.x = pointer.y = 0;
      ndc.x = 10;
      needsRender = true;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("resize", layout);

    /* ---- the loop ---- */
    let clock = 0;
    let scanT = 0;
    let scanning = false;
    let onScreen = true;
    let visible = !document.hidden;
    // Coming back from a hidden tab or from off screen: the canvas has kept
    // its last frame, but be safe and draw once rather than trust it.
    const onVisibility = () => { visible = !document.hidden; needsRender = true; };
    document.addEventListener("visibilitychange", onVisibility);
    // Focus only picks the frame rate; it never stops the loop.
    let focused = document.hasFocus();
    const onFocus = () => { focused = true; };
    const onBlur = () => { focused = false; };
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    const io = new IntersectionObserver((entries) => { onScreen = entries.some((en) => en.isIntersecting); needsRender = true; }, { rootMargin: "10% 0px" });
    io.observe(hero);

    /* While the canvas is being drawn, the page says so. The site's ambient
       layers — the paper grain (a blend-mode layer three viewports across) and
       the header's backdrop blur — are cheap over a page that holds still and
       are re-done on every one of these frames over a page that does not;
       measured, they were a third of what a frame cost. approach.css.ts
       stands them down while the flag is up. */
    let live = false;
    const setLive = (on: boolean) => {
      if (on === live) return;
      live = on;
      if (on) document.body.dataset.groveLive = "1";
      else delete document.body.dataset.groveLive;
    };

    const wires: THREE.LineSegments[] = [nearBuilt.wire, farBuilt.wire];

    /* The survey is over: the cage goes, the front is parked past the far
       corner so nothing is ever clipped by it again, and the near root's
       materials are swapped for the copies without discards. */
    const settled = [...nearBuilt.settled, ...farBuilt.settled];
    const settle = () => {
      shared.uWire.value = 0;
      shared.uScanR.value = scanMax * 4;
      for (const w of wires) {
        w.parent?.remove(w);
        w.geometry.dispose();
        (w.material as THREE.Material).dispose();
      }
      wires.length = 0;
      for (const s of settled) {
        (s.mesh.material as THREE.Material).dispose();
        s.mesh.material = s.material;
      }
      settled.length = 0;
    };
    /* The settled programs are compiled now, while the pulse is still
       crossing, so the swap lands on programs the driver has long finished
       linking — three only asks a program for its uniforms on first use, so
       compile() itself does not wait for the link. It takes any Object3D, so a
       stand-in group of meshes sharing the real geometries does it without
       putting anything in the scene. Not compileAsync(): that one keeps
       polling the materials after they are gone, which under StrictMode's
       mount–unmount–mount they are. */
    const precompileSettled = () => {
      if (!settled.length) return;
      const standIn = new THREE.Group();
      for (const s of settled) standIn.add(new THREE.Mesh(s.mesh.geometry, s.material));
      renderer.compile(standIn, camera, scene);
    };

    /* The parallax eases toward the pointer at 5.5% per sixtieth of a second
       and never quite arrives; below this (in NDC — 1e-4 is 0.0026px of
       camera travel at the 26px scale) it is treated as arrived. */
    const SETTLED = 1e-4;
    /* Written per unit of time rather than per frame so that the moss and the
       copy (GroveHero's own tick, same constant) agree at any refresh rate,
       and at either of the two rates below. */
    const ease = (dt: number) => 1 - Math.pow(1 - 0.055, dt * 60);

    /* Milliseconds of ticker time since the last frame this loop ran. */
    let pending = 0;

    /* When a frame is drawn.
       First the pacing: the loop runs at most FPS_FOCUSED times a second
       (FPS_BLURRED with the window unfocused) and lets the other ticks fall
       through, carrying their time forward in `pending` so the simulation
       still advances by real elapsed time. The one-millisecond slack keeps a
       16.7ms tick from landing on the wrong side of a 16.67ms budget and
       halving the rate by accident.
       Then what it draws. On this page the clock *is* motion: the wind in the
       shaders runs on `uPhase`, the root breathes on `clock`, the butterfly
       flies its circuit and the pollen drifts, so any frame that advances the
       clock has changed the picture and is drawn — the flag changes nothing
       there. The clock only stands still under prefers-reduced-motion, and
       then the picture changes only while: the survey pulse is still crossing
       (never, under calm, but the check is cheap), the parallax is still
       settling toward the pointer, or an event has raised `needsRender`
       (layout, a burst, a pointer move or leave, the tab or the hero coming
       back into view). Everything else — a settled pointer over a still
       scene — draws nothing (DESIGN.md §5.3: a still canvas layer costs
       nothing). The state updates below run on every frame that passes the
       pacing gate; only the draw is gated further, so nothing is left
       half-advanced. When in doubt, it is dirty. */
    const frame = (_time: number, deltaMs: number) => {
      const active = !disposed && visible && onScreen && !coveredRef?.current;
      setLive(active && !calm.matches);
      if (!active) return;
      pending += deltaMs;
      const fps = !focused ? FPS_BLURRED
        : scanning || performance.now() - lastInput < IDLE_AFTER_MS ? FPS_FOCUSED
        : FPS_IDLE;
      if (pending < 1000 / fps - 1) return;
      const dt = Math.min(pending / 1000, 0.05);
      pending = 0;

      const dirty =
        needsRender ||
        !calm.matches ||
        scanning ||
        Math.abs(pointer.x - smooth.x) > SETTLED ||
        Math.abs(pointer.y - smooth.y) > SETTLED;
      if (!calm.matches) clock += dt;
      shared.uPhase.value = clock;
      sprayUniforms.uNow.value = clock;

      const k = ease(dt);
      smooth.x += (pointer.x - smooth.x) * k;
      smooth.y += (pointer.y - smooth.y) * k;

      camera.position.x = -smooth.x * 26;
      camera.position.y = smooth.y * 16;
      camera.lookAt(camera.position.x * 0.42, camera.position.y * 0.42, 0);

      if (!calm.matches) {
        nearBuilt.group.rotation.y = smooth.x * 0.055;
        nearBuilt.group.rotation.x = smooth.y * 0.026;
        nearBuilt.group.rotation.z = Math.sin(clock * 0.22) * 0.0022;
        farBuilt.group.rotation.y = smooth.x * 0.03;
      }

      if (scanning) {
        scanT += dt / SCAN_DUR;
        const e = Math.min(1, scanT);
        shared.uScanR.value = (1 - Math.pow(1 - e, 1.35)) * scanMax;
        // the cage snaps on, rides the front, then burns off behind it
        shared.uWire.value = Math.min(1, e / 0.06) * (1 - sstep(0.72, 1, e));
        if (e >= 1) {
          scanning = false;
          settle();
        }
      }

      if (!calm.matches) flyButterfly(dt, clock);
      updateMouse(dt);
      if (!calm.matches) emitSpray(dt);

      if (!dirty) return;
      needsRender = false;
      renderer.render(scene, camera);
    };

    // Hold the pulse for a page nobody is looking at: a background tab gets no
    // frames, so the scan would never advance and the hero would still be
    // empty when it was finally opened.
    if (!calm.matches && !document.hidden) { scanning = true; shared.uScanR.value = 0; }
    else settle();

    renderer.render(scene, camera);
    precompileSettled();
    gsap.ticker.add(frame);
    onReady?.();

    return () => {
      disposed = true;
      gsap.ticker.remove(frame);
      setLive(false);
      io.disconnect();
      hero.removeEventListener("grove:burst", onBurst as EventListener);
      for (const type of ["wheel", "scroll", "keydown", "touchstart", "touchmove", "pointerdown"] as const) {
        window.removeEventListener(type, markInput);
      }
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", layout);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
      barkPlates.dispose();
      renderer.dispose();
    };
    // The scene is built once for the life of the page; the refs are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className="gh-scene" aria-hidden="true" />;
}
