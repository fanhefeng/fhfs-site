"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import * as THREE from "three";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";
import { hasWebGL, prefersSaveData } from "@/lib/three/guards";
import { buildGrove, buildMotes, BOX_W } from "@/lib/grove/geometry";

type Props = {
  accent: string;
  hint: string;
  headline: string;
  body: string;
  tail: string;
  fallbackNote: string;
  stageScan: string;
  stageGrow: string;
  stageSettle: string;
};

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
} from "@/lib/grove/shaders";

import {
  flowerTexture,
  radialTexture,
  wingTexture,
  wingGeometry,
  bodyGeometry,
} from "@/components/grove/plates";

/* ────────────────────────────────────────────────────────────────────────
   component
   ──────────────────────────────────────────────────────────────────────── */

/** Blade counts. The shell is only ~20k vertices, so this is the build cost. */
const BLADES_NEAR_WIDE = 175_000;
const BLADES_NEAR_SMALL = 46_000;
const BLADES_FAR_WIDE = 55_000;
const BLADES_FAR_SMALL = 13_000;

/**
 * The ridge behind.
 *
 * A swept tube is open at both ends, and at any size that leaves those ends
 * inside the frame the ridge reads as a severed length of pipe lying in the
 * middle distance. So its scale is not a constant: it is solved from the
 * camera's own frustum at the depth it sits at, which is the only way both
 * ends stay outside the picture on a phone in portrait *and* on an ultrawide.
 */
const FAR_DEPTH = 34;
const FAR_SCALE = 6.5;
/** Local x of the ridge's midpoint, and the local y its crest reaches. */
const FAR_MID_X = -0.35;
const FAR_TOP = 1.36;

/**
 * A scroll-driven landscape: nothing here is on a clock.
 *
 * The scrollbar drives one `phase` value, and every moving part is a pure
 * function of it — the survey front that draws the root in, the cage that rides
 * that front, the length the moss and the ferns grow to, when the flowers open,
 * where the butterfly is on its approach, the drift of the pollen, and the
 * wind. That is the study's premise, and it is also why a parked scene costs
 * nothing: with no time input there is nothing to update between scrolls, so
 * the renderer stops on its last frame (DESIGN.md §5.3).
 *
 * The one live input is the pointer, which parts the moss where it passes. It
 * is positional rather than temporal, so it costs a frame per move and nothing
 * at all once the hand is still.
 *
 * The build is deferred until the stage is near the viewport, then split off
 * behind two frames — growing two roots and planting nearly 200k blades is a
 * few hundred ms of blocked main thread, and doing it during the page's
 * entrance animation is exactly when it is most visible.
 */
export function GroveDemo({
  accent,
  hint,
  headline,
  body,
  tail,
  fallbackNote,
  stageScan,
  stageGrow,
  stageSettle,
}: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLParagraphElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  /** 0 → 1 across the whole study. Read by the render loop. */
  const phase = useRef({ value: 0 });
  const dirtyRef = useRef(true);
  const applyRef = useRef<((p: number) => void) | null>(null);

  const [live, setLive] = useState(false);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const sticky = stickyRef.current;
    if (!canvas || !sticky) return;

    if (prefersSaveData() || !hasWebGL()) {
      setDegraded(true);
      return;
    }

    let disposed = false;
    let teardown: (() => void) | null = null;

    const start = () => {
      if (disposed) return;

      const small = window.innerWidth < 900;

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: !small,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
        });
      } catch {
        setDegraded(true);
        return;
      }
      // The shaders tone-map and encode their own output, so three must not do
      // it a second time on the way to the canvas.
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      // Transparent clear, and the backdrop comes from CSS instead. Clearing to
      // a colour here would hand it to three as a *linear* value under the
      // colour space above and paint it several stops too dark; letting CSS own
      // it also means the degraded path and the live path share one backdrop
      // rather than two that have to be kept in sync.
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

      const near = buildGrove({
        variant: "near",
        blades: small ? BLADES_NEAR_SMALL : BLADES_NEAR_WIDE,
        flowers: small ? 130 : 280,
        ferns: small ? 34 : 62,
        fernSize: [0.3, 0.66],
      });
      const far = buildGrove({
        variant: "far",
        blades: small ? BLADES_FAR_SMALL : BLADES_FAR_WIDE,
        flowers: small ? 40 : 90,
        ferns: small ? 8 : 16,
        // Everything seated on the ridge is measured against FAR_SCALE, so
        // that at four times the distance it still reads finer than the near
        // root's rather than coarser.
        fernSize: [0.06, 0.13],
        flowerSize: [0.009, 0.017],
        bladeScale: 0.28,
      });

      const geometries: THREE.BufferGeometry[] = [];
      const materials: THREE.Material[] = [];
      const textures: THREE.Texture[] = [];

      /* ---- uniforms ----
         Everything the whole scene agrees on is shared BY REFERENCE, so one
         write to uPhase moves the wind, the pollen and the cage together. Only
         the terms that differ between the near root and the ridge behind it
         get their own object. */
      const shared = {
        uKeyDir: { value: new THREE.Vector3(-0.3, 0.92, 0.28).normalize() },
        uKeyCol: { value: new THREE.Color(1.14, 1.06, 0.88) },
        uFillDir: { value: new THREE.Vector3(0.12, -0.86, 0.5).normalize() },
        uFillCol: { value: new THREE.Color(0.78, 0.78, 0.62) },
        uAmbCol: { value: new THREE.Color(0.086, 0.09, 0.08) },
        uPhase: { value: 0 },
        uScanO: { value: new THREE.Vector3(-BOX_W * 0.75, -1.4, 2.2) },
        uScanR: { value: 0 },
        // This study measures the world in root widths, so the front's wobble
        // and the cage's own distances are already in the units they were
        // written in; the hero, which measures it in CSS pixels, is what these
        // exist for.
        uScanW: { value: new THREE.Vector2(1, 1) },
        uScanLag: { value: 0.55 },
        uWire: { value: 0 },
        uGrow: { value: 0 },
        uBloom: { value: 0 },
      };

      type Air = {
        hazeCol: [number, number, number];
        haze: number;
        fog: number;
        hazeLift: number;
        boxH: number;
        mouseR: number;
        /** local midpoint, kept half-extent, feather — see endFade() */
        cut: [number, number, number];
      };
      const groupUniforms = (air: Air) => ({
        ...shared,
        uHazeCol: { value: new THREE.Color(...air.hazeCol) },
        uHaze: { value: air.haze },
        uFog: { value: air.fog },
        uHazeLift: { value: air.hazeLift },
        uBoxH: { value: air.boxH },
        uCut: { value: new THREE.Vector3(...air.cut) },
        uMouse: { value: new THREE.Vector3(9999, 9999, 9999) },
        uMouseR: { value: air.mouseR },
      });

      const flowerMap = flowerTexture();
      const moteMap = radialTexture(64, [
        [0, "rgba(255,255,255,1)"],
        [0.35, "rgba(236,244,224,0.5)"],
        [1, "rgba(236,244,224,0)"],
      ]);
      textures.push(flowerMap, moteMap);

      /* ---- one root, assembled ---- */
      type Built = { group: THREE.Group; uniforms: ReturnType<typeof groupUniforms>; wire: THREE.LineSegments };

      const assemble = (grove: ReturnType<typeof buildGrove>, air: Air): Built => {
        const group = new THREE.Group();
        const uniforms = groupUniforms(air);
        // A form that dissolves has to blend, but it still writes depth: the
        // fade is a sliver at each end, and letting it skip the depth buffer
        // would put the ridge's own far flank in front of its near one.
        const soft = air.cut[1] < 1e5;

        const barkGeo = new THREE.BufferGeometry();
        barkGeo.setAttribute("position", new THREE.BufferAttribute(grove.bark.position, 3));
        barkGeo.setAttribute("normal", new THREE.BufferAttribute(grove.bark.normal, 3));
        barkGeo.setAttribute("aInfo", new THREE.BufferAttribute(grove.bark.info, 3));
        barkGeo.setIndex(new THREE.BufferAttribute(grove.bark.index, 1));
        const barkMat = new THREE.ShaderMaterial({
          uniforms,
          vertexShader: BARK_VERT,
          fragmentShader: BARK_FRAG,
          transparent: soft,
          depthWrite: true,
          side: THREE.DoubleSide,
        });
        const bark = new THREE.Mesh(barkGeo, barkMat);
        bark.frustumCulled = false;
        group.add(bark);
        geometries.push(barkGeo);
        materials.push(barkMat);

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
        const grassMat = new THREE.ShaderMaterial({
          uniforms,
          vertexShader: GRASS_VERT,
          fragmentShader: GRASS_FRAG,
          transparent: soft,
          depthWrite: true,
          side: THREE.DoubleSide,
        });
        const grass = new THREE.Mesh(bladeGeo, grassMat);
        grass.frustumCulled = false;
        grass.renderOrder = 1;
        group.add(grass);
        geometries.push(bladeGeo);
        materials.push(grassMat);

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
          const fernMat = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: FERN_VERT,
            fragmentShader: FERN_FRAG,
            transparent: soft,
            depthWrite: true,
            side: THREE.DoubleSide,
          });
          const fern = new THREE.Mesh(fernGeo, fernMat);
          fern.frustumCulled = false;
          fern.renderOrder = 2;
          group.add(fern);
          geometries.push(fernGeo);
          materials.push(fernMat);
        }

        /* flowers */
        if (grove.flowers.count > 0) {
          const flowerGeo = new THREE.InstancedBufferGeometry();
          flowerGeo.setAttribute(
            "position",
            new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3)
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
          flowers.renderOrder = 3;
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
            uWireK: { value: new THREE.Vector3(0.42, 7.5, 5.2) },
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
        geometries.push(wireGeo);
        materials.push(wireMat);

        return { group, uniforms, wire };
      };

      const nearBuilt = assemble(near, {
        hazeCol: [0.176, 0.195, 0.145],
        haze: 0.15,
        fog: 0,
        hazeLift: 0.2,
        boxH: near.boxH,
        mouseR: 1.2,
        // The near root is framed whole, so nothing of it is ever cut.
        cut: [0, 1e6, 1],
      });
      scene.add(nearBuilt.group);

      /* The ridge is washed into lit air rather than into the backdrop: mixing
         distance toward the background colour is how a far object turns into a
         hole in the picture, and mixing it toward lit haze is how it turns
         into something a long way off. The darks lift here too, which they must
         not do on the near root — at that range it is what air actually does. */
      const farBuilt = assemble(far, {
        // A shade under the tone the reference washes its ridge to. That page
        // sits the ridge inside a light pool with cards over it; here it is
        // bare against the stage, and at the reference's value it comes
        // forward as a pale mound instead of receding.
        hazeCol: [0.088, 0.098, 0.072],
        haze: 0.16,
        fog: 0.26,
        hazeLift: 0.9,
        boxH: far.boxH,
        mouseR: 0.001,
        // Both ends gone well before the tube's own caps, over a long feather.
        cut: [FAR_MID_X, 3.7, 1.9],
      });
      scene.add(farBuilt.group);

      /* ---- light pool and contact shadow ---- */
      const plane = new THREE.PlaneGeometry(1, 1);
      geometries.push(plane);

      const glowMap = radialTexture(256, [
        [0, "rgba(226,236,212,0.30)"],
        [0.42, "rgba(214,226,200,0.10)"],
        [1, "rgba(214,226,200,0)"],
      ]);
      const shadowMap = radialTexture(256, [
        [0, "rgba(12,16,10,0.62)"],
        [0.45, "rgba(12,16,10,0.26)"],
        [1, "rgba(12,16,10,0)"],
      ]);
      textures.push(glowMap, shadowMap);

      const glowMat = new THREE.MeshBasicMaterial({
        map: glowMap,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const glow = new THREE.Mesh(plane, glowMat);
      glow.scale.set(26, 17, 1);
      glow.position.set(-1.6, -0.6, -11);
      glow.renderOrder = -1;
      scene.add(glow);
      materials.push(glowMat);

      const shadowMat = new THREE.MeshBasicMaterial({
        map: shadowMap,
        transparent: true,
        depthWrite: false,
      });
      const shadow = new THREE.Mesh(plane, shadowMat);
      shadow.scale.set(17, 6, 1);
      shadow.position.set(0.2, -3.1, -2.4);
      shadow.renderOrder = 0;
      scene.add(shadow);
      materials.push(shadowMat);

      /* ---- drifting pollen ---- */
      const motes = buildMotes(small ? 1200 : 3600);
      const moteGeo = new THREE.BufferGeometry();
      moteGeo.setAttribute("position", new THREE.BufferAttribute(motes.position, 3));
      moteGeo.setAttribute("aSeed", new THREE.BufferAttribute(motes.seed, 4));
      const moteUniforms = {
        uPhase: shared.uPhase,
        uMap: { value: moteMap },
        uSize: { value: 0.055 },
        uScale: { value: 400 },
        uClimb: { value: motes.climb },
      };
      const moteMat = new THREE.ShaderMaterial({
        uniforms: moteUniforms,
        vertexShader: MOTE_VERT,
        fragmentShader: MOTE_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const moteField = new THREE.Points(moteGeo, moteMat);
      moteField.frustumCulled = false;
      moteField.renderOrder = 6;
      scene.add(moteField);
      geometries.push(moteGeo);
      materials.push(moteMat);

      /* ---- the pointer's pollen trail ---- */
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
        uSize: { value: 0.075 },
        uScale: moteUniforms.uScale,
        uLife: { value: SPRAY_LIFE },
      };
      const sprayMat = new THREE.ShaderMaterial({
        uniforms: sprayUniforms,
        vertexShader: SPRAY_VERT,
        fragmentShader: SPRAY_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      const sprayField = new THREE.Points(sprayGeo, sprayMat);
      sprayField.frustumCulled = false;
      sprayField.renderOrder = 7;
      scene.add(sprayField);
      geometries.push(sprayGeo);
      materials.push(sprayMat);

      let sprayHead = 0;
      let sprayDirty = false;
      /** The live clock. It only advances while something is actually alive. */
      let now = 0;
      let lastBirth = -999;

      const spawnGrain = (p: THREE.Vector3) => {
        const i = sprayHead;
        sprayHead = (sprayHead + 1) % SPRAY_N;
        const o = i * 3;
        sprayPos[o] = p.x + (Math.random() - 0.5) * 0.16;
        sprayPos[o + 1] = p.y + (Math.random() - 0.5) * 0.16;
        sprayPos[o + 2] = p.z + (Math.random() - 0.5) * 0.48;
        sprayVel[o] = (Math.random() - 0.5) * 0.4;
        sprayVel[o + 1] = 0.012 + Math.random() * 0.33;
        sprayVel[o + 2] = (Math.random() - 0.5) * 0.28;
        sprayBirth[i] = now;
        sprayRnd[i * 2] = 0.5 + Math.random() * 0.65;
        sprayRnd[i * 2 + 1] = Math.random();
        sprayDirty = true;
        lastBirth = now;
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
        uniforms: {
          uKeyDir: shared.uKeyDir,
          uKeyCol: shared.uKeyCol,
          uAmbCol: shared.uAmbCol,
        },
        vertexShader: BODY_VERT,
        fragmentShader: BODY_FRAG,
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
      // Mirrored by a negative X scale rather than a second geometry. That
      // flips the winding, which is why the wing material is DoubleSide and
      // flips its own normal on back faces.
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
        // tegulae — the scaled shoulder pads that weld wing to thorax
        const teg = new THREE.Mesh(tegulaGeo, bodyMat);
        teg.position.set(0.03 * sx, 0.026, 0.02);
        teg.scale.set(1.15, 0.62, 1.5);
        teg.rotation.z = -0.35 * sx;
        butterfly.add(teg);

        // antennae: thin, swept back, clubbed at the tip
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

      butterfly.scale.setScalar(0.21);
      butterfly.renderOrder = 5;
      butterfly.traverse((o) => {
        o.frustumCulled = false;
      });
      butterfly.visible = false;
      nearBuilt.group.add(butterfly);

      /* ---- framing ---- */

      /* The camera pushes in over the second half. Distance is solved from the
         root's own bounding radius and the vertical FOV, so the framing holds
         from a phone in portrait to an ultrawide instead of being a magic
         number tuned on one screen. */
      const fitDistance = (margin: number) => {
        const vFov = (camera.fov * Math.PI) / 180;
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
        return (near.reach * margin) / Math.tan(Math.min(vFov, hFov) / 2);
      };

      /** How far the front has to travel to have swept both roots. */
      let scanMax = 1;

      /* The ridge keeps a fixed size — its blade lengths were baked against it
         — and only its height is solved from the frustum, so its crest lands
         the same fraction below the look point whatever the viewport does. */
      const placeRidge = () => {
        const vFov = (camera.fov * Math.PI) / 180;
        const halfH = (fitDistance(1.18) + FAR_DEPTH) * Math.tan(vFov / 2);
        farBuilt.group.scale.setScalar(FAR_SCALE);
        farBuilt.group.position.set(
          -FAR_MID_X * FAR_SCALE,
          -0.58 * halfH - FAR_TOP * FAR_SCALE,
          -FAR_DEPTH
        );
        // The front has to sweep the ridge as well as the root in front of it,
        // or half the frame is still empty when the cage has burnt off.
        scanMax = Math.max(
          near.reach * 2.4 + 3,
          farBuilt.group.position.distanceTo(shared.uScanO.value) + far.reach * FAR_SCALE + 2
        );
      };

      const resize = () => {
        const w = sticky.clientWidth || window.innerWidth;
        const h = sticky.clientHeight || window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, w * h > 2_600_000 ? 1.5 : 2);
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        // Match three's own size attenuation: a mote of world size s at
        // distance d has to come out s * uScale / d pixels across.
        const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
        moteUniforms.uScale.value = buf.y * 0.5 / Math.tan(((camera.fov * Math.PI) / 180) / 2);
        placeRidge();
        dirtyRef.current = true;
      };
      resize();

      /* ---- pointer state ----
         Declared up here because `apply` reads it, and `apply` runs once
         before any of the listeners below are attached. */
      const raycaster = new THREE.Raycaster();
      const crownPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const ndc = new THREE.Vector2();
      const hitWorld = new THREE.Vector3();
      const escape = new THREE.Vector3();
      const toBug = new THREE.Vector3();
      const AWAY = new THREE.Vector3(9999, 9999, 9999);
      const mouseTarget = new THREE.Vector3().copy(AWAY);
      const mouseNow = nearBuilt.uniforms.uMouse.value;
      let hovering = false;

      /* The pointer's other two jobs, both eased on the live clock: the whole
         composition leans with it, and the butterfly is wary of it. */
      const par = new THREE.Vector2();
      const parTarget = new THREE.Vector2();
      let spook = 0;
      let spookTarget = 0;
      /** Stamped on the live clock, so a sleeping loop still wakes on a move. */
      let lastMove = 0;

      /* Act one frames the whole root, because a survey of a form you cannot
         see the ends of is not a survey. Act three ends at roughly the crop
         the reference holds throughout — close enough that the fur resolves
         into single blades, which is the only framing at which planting a
         hundred and seventy thousand of them means anything. */
      const WIDE = new THREE.Vector3(0, -0.3, 0);
      const CLOSE = near.perch.clone().add(new THREE.Vector3(0.55, -0.5, 0));
      const target = new THREE.Vector3();
      const approach = new THREE.Vector3();
      const flightPos = new THREE.Vector3();
      const flightPrev = new THREE.Vector3();
      const fwd = new THREE.Vector3();
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      const basis = new THREE.Matrix4();
      const flightQ = new THREE.Quaternion();
      const landQ = new THREE.Quaternion();

      /** Where the butterfly is at a given landing progress, 0 → 1. */
      const flightAt = (land: number, out: THREE.Vector3) => {
        // A curved approach rather than a straight line: it enters high and to
        // the right, drops past the crest, and settles back onto it.
        approach.set(
          near.perch.x + 3.4 * (1 - land),
          near.perch.y + 2.6 * (1 - land) * (1 - land) + 0.55 * Math.sin(land * 3.1),
          near.perch.z + 2.2 * (1 - land)
        );
        return out.lerpVectors(approach, near.perch, land * land);
      };

      /* The display pose: dorsal surface square to the lens, head up. The
         whole point of the landing is that the open wings are seen, and the
         camera here is barely above the root's own height — a butterfly left
         flat on the crest presents its wings edge-on and reads as a twig. */
      {
        const dorsal = new THREE.Vector3(0, 0.55, 1).normalize();
        const head = new THREE.Vector3(0, 1, 0).addScaledVector(dorsal, -dorsal.y).normalize();
        const side = new THREE.Vector3().crossVectors(dorsal, head).normalize();
        landQ.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, dorsal, head));
        landQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.1));
        landQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.14));
      }

      const apply = (p: number) => {
        const clamped = Math.min(Math.max(p, 0), 1);
        shared.uPhase.value = clamped * 7.5;

        // Act one: the front sweeps the whole box and a little past it, with
        // the cage snapping on at once and burning off behind the front.
        // It starts a little way out rather than at nothing: the stage pins
        // with the study at phase zero, and a front of radius zero means
        // arriving at an empty rectangle with a caption on it.
        const scan = Math.min(clamped / 0.34, 1);
        shared.uScanR.value = (0.055 + 0.945 * scan) * scanMax;
        // Full strength from the first frame, to match the front's own head
        // start — ramping it up from zero leaves the one thing already on
        // screen at phase zero standing there without its cage.
        const wire = 1 - THREE.MathUtils.smoothstep(clamped, 0.245, 0.36);
        shared.uWire.value = wire;
        nearBuilt.wire.visible = wire > 0.002;
        farBuilt.wire.visible = wire > 0.002;

        // Act two: the cushion grows, the ferns unfurl behind it, and the
        // flowers open behind them.
        shared.uGrow.value = THREE.MathUtils.smoothstep(clamped, 0.22, 0.62);
        shared.uBloom.value = THREE.MathUtils.smoothstep(clamped, 0.42, 0.78);

        // Act three: push in, and bring the butterfly down onto the crest. The
        // copy steps aside as the camera arrives — it has said its piece by
        // then, and the push-in puts the root exactly where the text was.
        if (copyRef.current) {
          const fade = 1 - THREE.MathUtils.smoothstep(clamped, 0.7, 0.9);
          copyRef.current.style.opacity = fade.toFixed(3);
        }
        const dolly = THREE.MathUtils.smoothstep(clamped, 0.5, 1);
        target.lerpVectors(WIDE, CLOSE, dolly);
        const dist = THREE.MathUtils.lerp(fitDistance(1.05), fitDistance(0.36), dolly);
        /* Parallax. The offsets are fractions of the camera's own distance
           rather than fixed world units, so the lean is the same on screen at
           the wide framing and at the close one — at a constant offset it
           barely registers across the frame at the start and swings the whole
           picture by the end. */
        const px = -par.x * dist * 0.0186;
        const py = par.y * dist * 0.0114;
        camera.position.set(
          Math.sin(-0.24 * dolly) * dist + px,
          target.y + 0.9 + 0.5 * dolly + py,
          Math.cos(-0.24 * dolly) * dist
        );
        camera.lookAt(target.x + px * 0.42, target.y + 0.28 * dolly + py * 0.42, target.z);
        nearBuilt.group.rotation.set(par.y * 0.026, par.x * 0.055, 0);
        farBuilt.group.rotation.y = par.x * 0.03;

        const land = THREE.MathUtils.smoothstep(clamped, 0.6, 0.97);
        butterfly.visible = land > 0.001;
        if (butterfly.visible) {
          flightAt(land, flightPos);
          butterfly.position.copy(flightPos);

          // Orientation off the path's own tangent rather than a hand-set
          // Euler: the approach curves through most of a right angle, and a
          // fixed heading has the animal flying sideways for half of it.
          flightAt(Math.max(0, land - 0.02), flightPrev);
          fwd.subVectors(flightPos, flightPrev);
          if (fwd.lengthSq() < 1e-8) fwd.set(0, 0, 1);
          fwd.normalize();
          right.crossVectors(fwd, new THREE.Vector3(0, 1, 0));
          if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
          right.normalize();
          up.crossVectors(right, fwd).normalize();
          basis.makeBasis(right, up, fwd);
          flightQ.setFromRotationMatrix(basis);

          const settle = THREE.MathUtils.smoothstep(land, 0.78, 1);
          butterfly.quaternion.copy(flightQ).slerp(landQ, settle);

          /* A perched insect will not stay put. Once the feet are down the
             pointer can spook it: it leans away from the hand, lifts, and beats
             harder — and it does that on the live clock rather than on the
             scrollbar, because an animal that only reacts while you are
             scrolling is not reacting to you at all. */
          if (spook > 0.002 && mouseNow.x < 999) {
            escape.set(butterfly.position.x - mouseNow.x, 0, butterfly.position.z - mouseNow.z);
            if (escape.lengthSq() < 1e-6) escape.set(1, 0, 0);
            escape.normalize();
            butterfly.position.addScaledVector(escape, spook * settle * 0.5);
            butterfly.position.y += spook * settle * 0.34;
          }

          // Wings beat hard on the way in, settle to a slow display once the
          // feet are down, and flare open as the hand closes in.
          const flap = clamped * 150 + now * (1.7 + 46 * spook) * settle;
          const raw = Math.sin(flap);
          const shaped = Math.sign(raw) * Math.pow(Math.abs(raw), 0.72);
          const flyPhi = 20 + 48 * shaped;
          const restPhi = 15 + 7 * shaped + spook * 30;
          const phi = THREE.MathUtils.lerp(flyPhi, restPhi, settle) * THREE.MathUtils.DEG2RAD;
          foreR.rotation.z = phi;
          foreL.rotation.z = -phi;
          hindR.rotation.z = phi * 0.95 - 0.03;
          hindL.rotation.z = -(phi * 0.95 - 0.03);
          const flapVel = Math.cos(flap) * 8.6 * (1 - 0.9 * settle * (1 - spook));
          bendFore.value = -flapVel * 0.01;
          bendHind.value = -flapVel * 0.013;

          butterfly.position.y += Math.sin(flap - 0.9) * 0.022 * (1 - settle * (1 - spook));
          butterfly.scale.setScalar(0.21 * (0.78 + 0.22 * land));
        }
      };
      applyRef.current = apply;
      apply(phase.current.value);

      /* ---- the pointer parts the moss ----
         The influence point is carried in the near root's LOCAL space, because
         that is the space the blades are planted in — and the group now leans
         with the parallax, so the world hit has to be pushed back through that
         transform every frame rather than copied once. */
      const toLocalMouse = () => {
        if (!hovering) {
          mouseTarget.copy(AWAY);
          return;
        }
        mouseTarget.copy(hitWorld);
        nearBuilt.group.worldToLocal(mouseTarget);
      };

      const settleMouse = () => {
        if (mouseTarget.x > 999) {
          if (mouseNow.x > 999) return false;
          // Let go rather than teleport: snapping the influence point to
          // infinity springs the whole cushion back on one frame.
          mouseNow.lerp(mouseTarget, 0.5);
          if (mouseNow.distanceToSquared(mouseTarget) < 1) mouseNow.copy(mouseTarget);
          return true;
        }
        if (mouseNow.x > 999) {
          mouseNow.copy(mouseTarget);
          return true;
        }
        if (mouseNow.distanceToSquared(mouseTarget) < 1e-6) return false;
        mouseNow.lerp(mouseTarget, 0.22);
        return true;
      };

      /* Emission by DISTANCE rather than by time, spread along the segment the
         pointer covered since the last frame: a fast sweep lays a trail instead
         of stacking a clump wherever the cursor happened to land, and a hand
         that has stopped trickles instead of pumping. */
      const sprayLast = new THREE.Vector3(9999, 0, 0);
      const sprayStep = new THREE.Vector3();
      let sprayIdle = 0;

      const emitSpray = (dt: number, moving: boolean) => {
        // The trickle is for a pointer creeping too slowly to trip the distance
        // test, not for one that has been put down. Letting a parked cursor go
        // on shedding a grain every 55ms keeps the live layer awake for ever —
        // which is exactly the cost this study is built to avoid.
        if (!hovering || mouseTarget.x > 999 || !moving) {
          sprayLast.x = 9999; // re-entering should not lay a streak across the frame
          return;
        }
        if (sprayLast.x > 9000) {
          sprayLast.copy(mouseTarget);
          return;
        }
        const n = Math.min(14, Math.floor(mouseTarget.distanceTo(sprayLast) / 0.037));
        for (let k = 1; k <= n; k++) {
          sprayStep.lerpVectors(sprayLast, mouseTarget, k / n);
          spawnGrain(sprayStep);
        }
        if (n > 0) {
          sprayLast.copy(mouseTarget);
          sprayIdle = 0;
        } else {
          sprayIdle += dt;
          if (sprayIdle > 0.055) {
            spawnGrain(mouseTarget);
            sprayIdle = 0;
          }
        }
        flushGrains();
      };

      const onPointerMove = (e: PointerEvent) => {
        if (e.pointerType === "touch") return;
        const r = canvas.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        parTarget.set(ndc.x, -ndc.y);
        camera.updateMatrixWorld();
        raycaster.setFromCamera(ndc, camera);
        hovering = !!raycaster.ray.intersectPlane(crownPlane, hitWorld);
        toLocalMouse();
        lastMove = now;
        dirtyRef.current = true;
      };
      const onPointerLeave = () => {
        hovering = false;
        parTarget.set(0, 0);
        mouseTarget.copy(AWAY);
        lastMove = now;
        dirtyRef.current = true;
      };
      canvas.addEventListener("pointermove", onPointerMove, { passive: true });
      canvas.addEventListener("pointerleave", onPointerLeave, { passive: true });

      const onResize = () => {
        resize();
        apply(phase.current.value);
        ScrollTrigger.refresh();
      };
      window.addEventListener("resize", onResize, { passive: true });

      let visible = !document.hidden;
      const onVisibility = () => {
        visible = !document.hidden;
        if (visible) dirtyRef.current = true;
      };
      document.addEventListener("visibilitychange", onVisibility);

      /* One clock for the whole site: gsap.ticker already drives Lenis, and a
         second rAF loop here would fight it for frames.

         The live layer — parallax, the pollen trail, the butterfly's nerve —
         runs only while there is something left for it to do: a hand over the
         stage, grains still in the air, a lean still easing home, or a startled
         insect still calming down. Every one of those is finite, so the loop
         drains itself and the scene goes back to costing nothing, which is the
         standing rule for the canvas layers here (DESIGN.md §5.3). What it is
         not is a scene idling at 60fps to sway grass nobody is looking at. */
      const tick = (_time: number, deltaMs: number) => {
        if (disposed || !visible) return;
        const dt = Math.min(deltaMs / 1000, 0.05);

        /* Liveness is about what is still CHANGING, not about where the hand
           happens to be resting. Keying it on hover instead looks identical and
           costs a permanent 60fps for as long as a motionless cursor sits over
           the stage — measured, and the reason this reads the way it does.
           Every term here is finite: grains expire, the lean reaches its target,
           the startle eases out, and the grace window closes. */
        const grainsAlive = now < lastBirth + SPRAY_LIFE;
        const leaning = Math.abs(par.x - parTarget.x) > 2e-4 || Math.abs(par.y - parTarget.y) > 2e-4;
        const startling = Math.abs(spook - spookTarget) > 1e-3;
        const justMoved = now - lastMove < 0.25;
        if (grainsAlive || leaning || startling || justMoved) {
          now += dt;
          sprayUniforms.uNow.value = now;

          // Frame-rate independent easing, so the lean lands the same on a
          // 60Hz panel and a 144Hz one.
          const k = 1 - Math.pow(0.04, dt);
          par.x += (parTarget.x - par.x) * k;
          par.y += (parTarget.y - par.y) * k;
          // Geometric easing approaches but never arrives; snap inside the
          // threshold the liveness test uses, or the loop has no last frame.
          if (Math.abs(par.x - parTarget.x) <= 2e-4) par.x = parTarget.x;
          if (Math.abs(par.y - parTarget.y) <= 2e-4) par.y = parTarget.y;

          // The parallax moves the group, so the influence point has to be
          // re-derived before anything reads it.
          toLocalMouse();
          emitSpray(dt, justMoved);

          /* How close is the hand, and from where. z is weighted down because
             the pointer is resolved on one plane and the butterfly is not on
             it; what matters is whether the cursor is over the animal on
             screen. Snaps on, lets go slowly — a startled insect does not calm
             instantly. */
          spookTarget = 0;
          if (hovering && mouseNow.x < 999 && butterfly.visible) {
            /* Measured against where the flight path PUTS it, not against
               where the startle has already pushed it to. Reading the
               displaced position feeds the offset back into its own input: the
               animal shies away, is therefore further from the hand, relaxes,
               drifts back, and shies again — a loop with no fixed point, which
               also means the live layer never gets a last frame. */
            toBug.set(
              mouseNow.x - flightPos.x,
              mouseNow.y - flightPos.y,
              (mouseNow.z - flightPos.z) * 0.3
            );
            spookTarget = Math.min(1, Math.max(0, 1 - toBug.length() / 0.62));
            spookTarget *= spookTarget;
          }
          spook += (spookTarget - spook) * (1 - Math.pow(spookTarget > spook ? 1e-7 : 0.22, dt));
          if (Math.abs(spook - spookTarget) < 1e-3) spook = spookTarget;

          apply(phase.current.value);
          dirtyRef.current = true;
        }

        if (settleMouse()) dirtyRef.current = true;
        if (!dirtyRef.current) return;
        dirtyRef.current = false;
        renderer.render(scene, camera);
      };
      gsap.ticker.add(tick);

      renderer.render(scene, camera);
      setLive(true);
      ScrollTrigger.refresh();

      teardown = () => {
        gsap.ticker.remove(tick);
        window.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", onVisibility);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerleave", onPointerLeave);
        applyRef.current = null;
        // Collected as they were made rather than walked off the graph: the
        // wings share two geometries and two materials across four meshes, and
        // a traverse would dispose each of those several times over.
        for (const g of geometries) g.dispose();
        for (const m of materials) m.dispose();
        for (const t of textures) t.dispose();
        renderer.dispose();
      };
    };

    /* Viewport-gated: building the roots is a few hundred ms of blocked main
       thread, and the lab index links straight here — so it waits until the
       stage is actually approaching, then hands the browser two frames to
       finish painting the page's own entrance before it takes the thread. */
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        requestAnimationFrame(() => requestAnimationFrame(start));
      },
      { rootMargin: "200% 0px" }
    );
    io.observe(sticky);

    return () => {
      disposed = true;
      io.disconnect();
      teardown?.();
    };
  }, []);

  useGSAP(
    () => {
      const stage = stageRef.current;
      const sticky = stickyRef.current;
      if (!live || !stage || !sticky) return;

      const labels = [stageScan, stageGrow, stageSettle];
      let shown = -1;

      const tween = gsap.to(phase.current, {
        value: 1,
        ease: "none",
        // The tween's own onUpdate rather than the ScrollTrigger's: with
        // `scrub` the catch-up tween keeps running after the scrollbar has
        // stopped, and a ScrollTrigger callback stops firing at that moment —
        // which would park the scene one frame short of where it was scrolled.
        onUpdate: () => {
          applyRef.current?.(phase.current.value);
          dirtyRef.current = true;
          const act = phase.current.value < 0.34 ? 0 : phase.current.value < 0.66 ? 1 : 2;
          if (act !== shown && labelRef.current) {
            shown = act;
            labelRef.current.textContent = labels[act];
          }
        },
        scrollTrigger: {
          trigger: stage,
          start: "top top",
          end: "bottom bottom",
          pin: sticky,
          pinSpacing: false,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          scrub: 0.8,
        },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
    // revertOnUpdate is required whenever dependencies and a teardown are both
    // present (DESIGN.md §1.5): without it the cleanup is deferred to unmount
    // and a dependency change leaves a second ScrollTrigger behind.
    { scope, dependencies: [live], revertOnUpdate: true }
  );

  return (
    <div ref={scope} style={{ "--gv-accent": accent } as CSSProperties}>
      <style href="lab-grove" precedence="medium">
        {CSS}
      </style>

      <div ref={stageRef} className="gv-stage" data-degraded={degraded || undefined}>
        <div ref={stickyRef} className="gv-sticky">
          <canvas ref={canvasRef} className="gv-canvas" data-degraded={degraded || undefined} aria-hidden="true" />

          <div ref={copyRef} className="gv-copy">
            <h2 className="gv-headline">{headline}</h2>
            <p className="gv-body">{body}</p>
            <p className="gv-tail">{tail}</p>
            {degraded && <p className="gv-note">{fallbackNote}</p>}
          </div>

          <p ref={labelRef} className="gv-act" aria-hidden="true">
            {stageScan}
          </p>
          <p className="gv-hint" aria-hidden="true">
            {hint}
          </p>
        </div>
      </div>
    </div>
  );
}

const CSS = `
/* Three acts at roughly a screen and a half each: the scan needs room to read
   as a sweep rather than a flash, and the dolly needs room to feel like a walk
   toward the root rather than a zoom. */
.gv-stage { position: relative; height: 460vh; }
/* Without WebGL there is no scene, so nothing pins and nothing is driven —
   which would leave the scroll track above as three and a half blank screens
   under the copy. Collapse it to the one screen that still has something on it. */
.gv-stage[data-degraded] { height: 100svh; }
.gv-sticky {
  position: relative;
  height: 100svh;
  overflow: hidden;
  border-block: 1px solid var(--line);
  /* Also the backdrop when WebGL is unavailable, so the copy stays legible.
     A mid grey-green rather than the near-black this started on: every colour
     in these shaders was solved against lit forest air, and dropping that air
     onto a dark stage takes the moss with it — the greens lose their hue and
     the whole render silts up into one murky mid-tone. The two pools are the
     light on the floor and the shade in the far corner. */
  background:
    radial-gradient(64% 52% at 27% 84%, rgba(232, 238, 222, 0.086) 0%, rgba(232, 238, 222, 0) 72%),
    radial-gradient(70% 60% at 92% 8%, rgba(24, 28, 20, 0.1) 0%, rgba(24, 28, 20, 0) 68%),
    #4a4d44;
}
.gv-canvas { display: block; width: 100%; height: 100%; }
.gv-canvas[data-degraded] { visibility: hidden; }

.gv-copy {
  position: absolute;
  inset: auto 0 12vh;
  margin-inline: auto;
  max-width: min(34ch, 82vw);
  text-align: center;
  color: #f2efe4;
  text-shadow: 0 2px 28px rgba(0, 0, 0, 0.55);
  /* The pointer has to reach the moss underneath: the copy is a caption over
     the scene, not a lid on it. */
  pointer-events: none;
}
.gv-headline {
  margin: 0;
  font-size: clamp(1.7rem, 5vw, 3rem);
  font-weight: 600;
  letter-spacing: -0.02em;
}
.gv-body {
  margin: 0.9rem 0 0;
  font-size: 0.9375rem;
  line-height: 1.7;
  opacity: 0.82;
}
.gv-tail {
  margin: 1.1rem 0 0;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--gv-accent);
  text-shadow: none;
}
.gv-note {
  margin: 1rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.6;
  opacity: 0.66;
}

/* The act marker sits opposite the scroll hint so the two never collide on a
   narrow viewport. */
.gv-act,
.gv-hint {
  position: absolute;
  bottom: clamp(1rem, 4vw, 2.5rem);
  margin: 0;
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  pointer-events: none;
}
.gv-act {
  left: clamp(1rem, 4vw, 2.5rem);
  color: var(--gv-accent);
}
.gv-hint {
  right: clamp(1rem, 4vw, 2.5rem);
  color: rgba(242, 239, 228, 0.42);
}
`;
