"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import * as THREE from "three";
import { gsap, useGSAP, ScrollTrigger, EASE } from "@/lib/gsap";
import { releaseRenderer } from "@/lib/three/release";
import { watchContextLoss } from "@/lib/webgl";
import {
  buildGrove,
  BOX_W,
  BLADES_NEAR_WIDE,
  BLADES_NEAR_SMALL,
  BLADES_FAR_WIDE,
  BLADES_FAR_SMALL,
} from "@/lib/grove/geometry";

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
  /** What the picker calls itself, for the group's accessible name. */
  dressLegend: string;
  /** Every translated string the study was handed; the dress names are looked
   *  up out of it by the message key each palette carries. */
  dressNames: Record<string, string>;
};

import { bakeBarkPlates } from "@/lib/grove/bark";
import { flowerTexture, moteTexture, poolTexture } from "@/lib/grove/plates";
import {
  allocations,
  assembleRoot,
  bendWings,
  buildButterfly,
  contactShadowTexture,
  createMotes,
  createSpray,
  disposeAll,
  groveRenderer,
  pointScale,
  poseWings,
  rootUniforms,
  sharedUniforms,
  SPRAY_LIFE,
} from "@/lib/grove/scene";
import {
  grovePalette,
  GROVE_PALETTE_KEYS,
  DEFAULT_PALETTE,
  DRESS_COLOURS,
  type DressColourUniform,
  type GrovePalette,
  type GrovePaletteKey,
  type RGB,
} from "@/lib/grove/palettes";

/* ────────────────────────────────────────────────────────────────────────
   component
   ──────────────────────────────────────────────────────────────────────── */

/** Scratch colour for the dress tween, so a 60fps interpolation allocates none. */
const TMP = new THREE.Color();

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
 * behind two frames — growing two roots and planting 230k blades is a
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
  dressLegend,
  dressNames,
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
  /** Bumped when a lost context comes back, so the effect rebuilds on it. */
  const [epoch, setEpoch] = useState(0);

  /** Which dress the grove has on. */
  const [dress, setDress] = useState<GrovePaletteKey>(DEFAULT_PALETTE);
  /**
   * Read by the build, written by the picker.
   *
   * The scene is not rebuilt to change colour — a rebuild re-bakes the bark
   * plates and re-grows a quarter of a million blades, and it would restart the
   * survey the reader is in the middle of scrubbing. So the build publishes a
   * function here that repaints what is already on the GPU, and the ref is what
   * lets a rebuild (a lost context) come back wearing the dress that was on
   * rather than the one the effect closed over.
   */
  const dressRef = useRef<GrovePaletteKey>(DEFAULT_PALETTE);
  const repaintRef = useRef<((p: GrovePalette) => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const sticky = stickyRef.current;
    if (!canvas || !sticky) return;

    // Save-Data and a missing WebGL were asked before this chunk was fetched
    // (SceneGate, in LabStudy); a renderer that cannot be built after all is
    // still caught below.

    // three survives a lost context on its own, but the bark plates are
    // render targets baked once at build time (lib/grove/bark.ts), and a
    // restored context hands them back empty — so the whole scene is rebuilt
    // rather than redrawn, the same way the raw-WebGL layers do it.
    const ctx = watchContextLoss(canvas, () => setEpoch((n) => n + 1));

    let disposed = false;
    let teardown: (() => void) | null = null;

    const start = () => {
      if (disposed) return;

      const small = window.innerWidth < 900;
      // A dress change is a 0.45s cross-fade of the whole picture; someone who
      // asked for less motion gets the new colours on the next frame instead.
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)");

      // Transparent clear, and the backdrop comes from CSS instead. Clearing to
      // a colour would hand it to three as a *linear* value under the output
      // colour space and paint it several stops too dark; letting CSS own it
      // also means the degraded path and the live path share one backdrop
      // rather than two that have to be kept in sync.
      let renderer: THREE.WebGLRenderer;
      try {
        renderer = groveRenderer(canvas, { antialias: !small, stencil: false });
      } catch {
        setDegraded(true);
        return;
      }

      // The bark's own picture, baked once — see lib/grove/bark.ts.
      const barkPlates = bakeBarkPlates(renderer, small);

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

      const into = allocations();

      /* ---- uniforms ----
         Everything the whole scene agrees on is shared BY REFERENCE, so one
         write to uPhase moves the wind, the pollen and the cage together. Only
         the terms that differ between the near root and the ridge behind it
         get their own object. */
      /* The dress this build opens in — whatever the picker last chose, so a
         rebuild after a lost context comes back the colour it went away. */
      const dress0 = grovePalette(dressRef.current);

      // This study measures the world in root widths, so the front's wobble
      // and the cage's own distances are already in the units they were
      // written in; and the root grows on the scrollbar, from nothing.
      const shared = sharedUniforms(
        dress0,
        {
          origin: new THREE.Vector3(-BOX_W * 0.75, -1.4, 2.2),
          wobble: new THREE.Vector2(1, 1),
          lag: 0.55,
        },
        false,
      );

      type Air = {
        hazeCol: RGB;
        haze: number;
        fog: number;
        hazeLift: number;
        boxH: number;
        mouseR: number;
        /** local midpoint, kept half-extent, feather — see endFade() */
        cut: [number, number, number];
      };
      /* The painted plates are the one part of a dress that is not a uniform:
         they are canvases, so changing colour means drawing a new one. These
         are collected rather than pushed straight onto `textures` because the
         repaint has to dispose the outgoing pair itself — leaving them to
         teardown would leak one texture per dress the reader tries on. */
      const flowerMats: THREE.ShaderMaterial[] = [];
      const moteMats: THREE.ShaderMaterial[] = [];
      const poolMats: THREE.MeshBasicMaterial[] = [];
      let flowerMap = flowerTexture(dress0.petal, dress0.heart);
      let moteMap = moteTexture(dress0.moteCore, dress0.moteEdge);

      /* ---- one root, assembled ----
         Nothing here settles — the survey is the scrollbar's, and it can be
         scrolled back — so no discard-free twins. A root whose ends are cut
         dissolves, and blends. */
      const assemble = (grove: ReturnType<typeof buildGrove>, air: Air) => {
        const root = assembleRoot({
          scene,
          grove,
          uniforms: rootUniforms(shared, air),
          bark: barkPlates.uniforms,
          flowerMap,
          soft: air.cut[1] < 1e5,
          settledTwins: false,
          orders: { bark: 0, grass: 1, fern: 2, flower: 3 },
          wireK: [0.42, 7.5, 5.2],
          into,
        });
        flowerMats.push(...root.flowerMats);
        return root;
      };

      const nearBuilt = assemble(near, {
        ...dress0.near,
        boxH: near.boxH,
        mouseR: 1.2,
        // The near root is framed whole, so nothing of it is ever cut.
        cut: [0, 1e6, 1],
      });

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
        ...dress0.far,
        boxH: far.boxH,
        mouseR: 0.001,
        // Both ends gone well before the tube's own caps, over a long feather.
        cut: [FAR_MID_X, 3.7, 1.9],
      });

      /* ---- light pool and contact shadow ---- */
      const plane = new THREE.PlaneGeometry(1, 1);
      into.geometries.push(plane);

      let glowMap = poolTexture(dress0.poolInner, dress0.poolOuter);
      const shadowMap = contactShadowTexture();
      into.textures.push(shadowMap);

      const glowMat = new THREE.MeshBasicMaterial({
        map: glowMap,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      poolMats.push(glowMat);
      const glow = new THREE.Mesh(plane, glowMat);
      glow.scale.set(26, 17, 1);
      glow.position.set(-1.6, -0.6, -11);
      glow.renderOrder = -1;
      scene.add(glow);
      into.materials.push(glowMat);

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
      into.materials.push(shadowMat);

      /* ---- drifting pollen ---- */
      const motes = createMotes(small ? 1200 : 3600, moteMap, shared.uPhase, 0.055, into);
      scene.add(motes.points);
      moteMats.push(motes.material);

      /* ---- the pointer's pollen trail ---- */
      const spray = createSpray(moteMap, motes.uniforms.uScale, 0.075, into);
      scene.add(spray.points);
      moteMats.push(spray.material);
      /** The live clock. It only advances while something is actually alive. */
      let now = 0;

      /* ---- butterfly ---- */
      const { group: butterfly, wings } = buildButterfly(shared, 0.21, into);
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
          -FAR_DEPTH,
        );
        // The front has to sweep the ridge as well as the root in front of it,
        // or half the frame is still empty when the cage has burnt off.
        scanMax = Math.max(
          near.reach * 2.4 + 3,
          farBuilt.group.position.distanceTo(shared.uScanO.value) + far.reach * FAR_SCALE + 2,
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
        motes.uniforms.uScale.value = pointScale(renderer, camera);
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
          near.perch.z + 2.2 * (1 - land),
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
          Math.cos(-0.24 * dolly) * dist,
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
          poseWings(wings, flap, settle, spook);
          bendWings(wings, Math.cos(flap) * 8.6 * (1 - 0.9 * settle * (1 - spook)));

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

      const emitSpray = (dt: number, moving: boolean) => {
        // The trickle is for a pointer creeping too slowly to trip the distance
        // test, not for one that has been put down. Letting a parked cursor go
        // on shedding a grain every 55ms keeps the live layer awake for ever —
        // which is exactly the cost this study is built to avoid.
        if (!hovering || mouseTarget.x > 999 || !moving) {
          spray.trail.lift();
          return;
        }
        spray.trail.at(mouseTarget, dt, now);
      };

      const onPointerMove = (e: PointerEvent) => {
        if (e.pointerType === "touch") return;
        const r = canvas.getBoundingClientRect();
        ndc.set(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          -((e.clientY - r.top) / r.height) * 2 + 1,
        );
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

      // The canvas follows the sticky box, not the window: a phone's address
      // bar resizes the window without resizing a 100svh box, and re-measuring
      // the pin is ScrollTrigger's own resize handling, which knows to ignore
      // exactly that. Calling refresh() here used to make the pin jump, and
      // it read the box before the refresh had settled it.
      const onResize = () => {
        resize();
        apply(phase.current.value);
      };
      const stickyObserver = new ResizeObserver(onResize);
      stickyObserver.observe(sticky);

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
        const grainsAlive = now < spray.lastBirth() + SPRAY_LIFE;
        const leaning =
          Math.abs(par.x - parTarget.x) > 2e-4 || Math.abs(par.y - parTarget.y) > 2e-4;
        const startling = Math.abs(spook - spookTarget) > 1e-3;
        const justMoved = now - lastMove < 0.25;
        if (grainsAlive || leaning || startling || justMoved) {
          now += dt;
          spray.uniforms.uNow.value = now;

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
              (mouseNow.z - flightPos.z) * 0.3,
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

      /* ---- changing dress ----
         Every colour in the scene is either a uniform or one of two painted
         plates, so this is the whole of it: write the uniforms in place (they
         are shared by reference, so one write reaches every material that took
         them), and swap the two canvases. No geometry is touched, the survey
         keeps whatever position the scrollbar left it at, and the frame after
         this one is simply drawn in the new colours. */
      /* The bands of air, paired with the half of the dress each reads. */
      const bands = [
        [nearBuilt.uniforms, "near"],
        [farBuilt.uniforms, "far"],
      ] as const;

      let dressTween: gsap.core.Tween | null = null;

      const repaint = (p: GrovePalette, animate = true) => {
        dressTween?.kill();

        // The painted plates cannot be interpolated — they are canvases — so
        // they are swapped outright. At this size (a floret is a few pixels,
        // a grain of pollen one) the cut is invisible under a moving tween,
        // and cross-fading two of each would cost more than the dress does.
        const flowerNext = flowerTexture(p.petal, p.heart);
        const moteNext = moteTexture(p.moteCore, p.moteEdge);
        const glowNext = poolTexture(p.poolInner, p.poolOuter);
        for (const m of flowerMats) m.uniforms.uMap!.value = flowerNext;
        for (const m of moteMats) m.uniforms.uMap!.value = moteNext;
        for (const m of poolMats) m.map = glowNext;
        // Dropped only once nothing points at them any more.
        flowerMap.dispose();
        moteMap.dispose();
        glowMap.dispose();
        flowerMap = flowerNext;
        moteMap = moteNext;
        glowMap = glowNext;

        /* Where the scene is NOW, not where the last dress said it should be:
           a second press mid-tween has to start from the colours actually on
           screen, or the picture jumps back before it moves on. Captured even
           for an instant change — it costs fourteen clones and keeps the two
           paths reading the same. */
        const from = {} as Record<DressColourUniform | "near" | "far", THREE.Color>;
        for (const u of Object.keys(DRESS_COLOURS) as DressColourUniform[]) {
          from[u] = shared[u].value.clone();
        }
        const fromAir = {} as Record<
          "near" | "far",
          { haze: number; fog: number; hazeLift: number }
        >;
        for (const [uniforms, side] of bands) {
          from[side] = uniforms.uHazeCol.value.clone();
          fromAir[side] = {
            haze: uniforms.uHaze.value,
            fog: uniforms.uFog.value,
            hazeLift: uniforms.uHazeLift.value,
          };
        }

        const write = (t: number) => {
          for (const [u, field] of Object.entries(DRESS_COLOURS) as [
            DressColourUniform,
            keyof GrovePalette,
          ][]) {
            shared[u].value.lerpColors(from[u], TMP.setRGB(...(p[field] as RGB)), t);
          }
          for (const [uniforms, side] of bands) {
            const air = p[side];
            const a = fromAir[side];
            uniforms.uHazeCol.value.lerpColors(from[side], TMP.setRGB(...air.hazeCol), t);
            uniforms.uHaze.value = a.haze + (air.haze - a.haze) * t;
            uniforms.uFog.value = a.fog + (air.fog - a.fog) * t;
            uniforms.uHazeLift.value = a.hazeLift + (air.hazeLift - a.hazeLift) * t;
          }
          dirtyRef.current = true;
        };

        if (!animate || calm.matches) {
          write(1);
          return;
        }

        const at = { t: 0 };
        dressTween = gsap.to(at, {
          t: 1,
          duration: 0.45,
          ease: EASE.default,
          onUpdate: () => write(at.t),
        });
      };
      repaintRef.current = repaint;
      // The picker may have moved while the build was waiting on the viewport
      // gate; `dress0` was read at the top of it, so catch up if it has.
      if (dressRef.current !== dress0.key) repaint(grovePalette(dressRef.current), false);

      teardown = () => {
        gsap.ticker.remove(tick);
        stickyObserver.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerleave", onPointerLeave);
        applyRef.current = null;
        repaintRef.current = null;
        dressTween?.kill();
        // Collected as they were made rather than walked off the graph: the
        // wings share two geometries and two materials across four meshes, and
        // a traverse would dispose each of those several times over.
        disposeAll(into);
        // The painted plates are held in `let`s because a repaint swaps them,
        // so the set to release is whichever dress is on at teardown — the
        // same three the repaint drops, plus the bark.
        flowerMap.dispose();
        moteMap.dispose();
        glowMap.dispose();
        barkPlates.dispose();
        releaseRenderer(renderer);
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
      { rootMargin: "200% 0px" },
    );
    io.observe(sticky);

    return () => {
      disposed = true;
      ctx.dispose();
      io.disconnect();
      teardown?.();
    };
  }, [epoch]);

  /* The picker writes the ref as well as the state: the ref is what a rebuild
     reads to come back in the right dress, and it has to be current even for a
     build that has not happened yet. */
  useEffect(() => {
    dressRef.current = dress;
    repaintRef.current?.(grovePalette(dress));
  }, [dress]);

  useGSAP(
    () => {
      const stage = stageRef.current;
      const sticky = stickyRef.current;
      if (!live || !stage || !sticky) return;

      const labels = [stageScan, stageGrow, stageSettle];
      let shown = -1;

      const tween = gsap.to(phase.current, {
        value: 1,
        ease: EASE.linear,
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
            labelRef.current.textContent = labels[act]!;
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
    { scope, dependencies: [live], revertOnUpdate: true },
  );

  return (
    <div
      ref={scope}
      style={
        {
          "--gv-accent": accent,
          "--gv-backdrop": grovePalette(dress).backdrop,
        } as CSSProperties
      }
    >
      <style href="lab-grove" precedence="medium">
        {CSS}
      </style>

      <div ref={stageRef} className="gv-stage" data-degraded={degraded || undefined}>
        <div ref={stickyRef} className="gv-sticky">
          <canvas
            ref={canvasRef}
            className="gv-canvas"
            data-degraded={degraded || undefined}
            aria-hidden="true"
          />

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

          {/* The dress picker. Hidden entirely when the scene never came up:
              with no canvas there is nothing to recolour, and a row of dead
              buttons over the fallback still would only ask to be pressed. */}
          {!degraded && (
            <div className="gv-dress" role="group" aria-label={dressLegend}>
              {GROVE_PALETTE_KEYS.map((key) => {
                const p = grovePalette(key);
                const on = key === dress;
                return (
                  <button
                    key={key}
                    type="button"
                    className="gv-dress-btn"
                    style={{ "--gv-swatch": p.swatch } as CSSProperties}
                    aria-pressed={on}
                    onClick={() => setDress(key)}
                  >
                    <span className="gv-dress-dot" aria-hidden="true" />
                    {dressNames[p.label] ?? key}
                  </button>
                );
              })}
            </div>
          )}
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
    var(--gv-backdrop, #4a4d44);
  transition: background-color var(--dur-3, 0.35s) ease;
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

/* The dress picker, top right — the one thing in the frame that is a control
   rather than a caption, so it is also the only thing here that takes the
   pointer back off the canvas. */
.gv-dress {
  position: absolute;
  top: clamp(1rem, 4vw, 2.5rem);
  right: clamp(1rem, 4vw, 2.5rem);
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.375rem;
  max-width: min(60vw, 22rem);
}
.gv-dress-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.7rem;
  border: 1px solid rgba(242, 239, 228, 0.16);
  border-radius: 999px;
  background: rgba(12, 14, 11, 0.42);
  color: rgba(242, 239, 228, 0.62);
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition:
    color var(--dur-2, 0.2s) ease,
    border-color var(--dur-2, 0.2s) ease,
    background-color var(--dur-2, 0.2s) ease;
}
.gv-dress-btn:hover {
  color: rgba(242, 239, 228, 0.92);
  border-color: rgba(242, 239, 228, 0.34);
}
.gv-dress-btn[aria-pressed="true"] {
  color: rgba(242, 239, 228, 0.96);
  border-color: rgba(242, 239, 228, 0.46);
  background: rgba(12, 14, 11, 0.66);
}
.gv-dress-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--gv-swatch);
  /* The swatch is the only saturated thing in the row, so it carries the
     whole state read at a glance; unselected dots sit back with the label. */
  opacity: 0.55;
  transition: opacity var(--dur-2, 0.2s) ease;
}
.gv-dress-btn[aria-pressed="true"] .gv-dress-dot {
  opacity: 1;
}

/* On a narrow viewport the site's own header sits exactly where the picker
   wants to be — the island is centred at the top of every page, and at this
   width it covers the first two pills. So the row comes out from under it and
   spans instead: centred, below the island, across the empty sky. */
@media (max-width: 640px) {
  .gv-dress {
    top: 5.25rem;
    left: 1rem;
    right: 1rem;
    justify-content: center;
    max-width: none;
  }
  .gv-dress-btn {
    padding: 0.35rem 0.55rem;
    letter-spacing: 0.08em;
  }
}

/* A finger needs a target a mouse does not. Keyed on the pointer rather than
   the viewport so a narrow desktop window keeps the compact row, and a tablet
   at 1024px still gets something it can actually hit. The pills are already
   only a few characters wide, so the height is the axis that has to give. */
@media (pointer: coarse) {
  .gv-dress {
    gap: 0.5rem;
  }
  .gv-dress-btn {
    min-height: 2.75rem;
    padding-inline: 0.85rem;
  }
}
`;
