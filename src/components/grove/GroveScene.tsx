"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { gsap } from "@/lib/client/gsap";
import { hasWebGL, prefersSaveData } from "@/lib/client/three/guards";
import { releaseRenderer } from "@/lib/client/three/release";
import { watchContextLoss } from "@/lib/client/webgl";
import { buildGrove, BOX_W } from "@/lib/grove/geometry";
import { bakeBarkPlates } from "@/lib/grove/bark";
import { flowerTexture, moteTexture, radialTexture } from "@/lib/grove/plates";
import { grovePalette, DEFAULT_PALETTE } from "@/lib/grove/palettes";
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
  precompileSettled,
  rootUniforms,
  settleRoots,
  sharedUniforms,
  type Root,
} from "@/lib/grove/scene";

/** The cover wears one dress. The study is where the others are tried on. */
const DRESS = grovePalette(DEFAULT_PALETTE);

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
  /** Bumped when a lost context comes back, so the effect rebuilds on it. */
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const hero = heroRef.current;
    const stage = stageRef.current;
    if (!canvas || !hero || !stage) return;

    if (prefersSaveData() || !hasWebGL()) {
      onReady?.();
      return;
    }

    // three survives a lost context on its own, but the bark plates are
    // render targets baked once at build time (lib/grove/bark.ts), and a
    // restored context hands them back empty — so the whole scene is rebuilt
    // rather than redrawn, the same way the raw-WebGL layers do it. Watched
    // before the renderer is asked for, so a loss during setup is seen too.
    const ctx = watchContextLoss(canvas, () => setEpoch((n) => n + 1));

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = groveRenderer(canvas, { antialias: true });
    } catch {
      ctx.dispose();
      onReady?.();
      return;
    }

    let disposed = false;
    /* The render gate. A frame is drawn when something on screen can have
       changed; the loop below decides most of that from its own state, and
       the events that change the picture without going through that state
       (resize, the tab coming back) raise this flag instead. Declared
       up here because layout() — the first of those — runs before the loop
       exists. */
    let needsRender = true;
    const narrow = window.matchMedia("(max-width: 900px)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const small = narrow.matches || window.innerWidth * window.innerHeight < 620_000;

    // The pixel ratio is set in layout(), where the canvas's size is known.

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 10, 8000);
    camera.position.set(0, 0, DIST);

    const into = allocations();

    /* ---- what every material agrees on ----
       The cover wears the spring dress and only that one; the study at
       /lab/grove is where the others are tried on. Here a world unit is a CSS
       pixel, so the front's wobble and lag are rescaled out of the root-width
       units they were written in; and nothing grows or blooms on a schedule
       on this page — the survey draws the root in already finished. */
    const shared = sharedUniforms(
      DRESS,
      {
        origin: new THREE.Vector3(-900, -260, 240),
        wobble: new THREE.Vector2(0.0122, 120),
        lag: 520,
      },
      true,
    );

    type Air = {
      box: Box;
      haze: number;
      fog: number;
      hazeLift: number;
      hazeCol: [number, number, number];
      mouseR: number;
      mask: [number, number, number, number] | null;
    };

    // The bark's own picture, baked once — the single biggest saving in the
    // scene, see lib/grove/bark.ts.
    const barkPlates = bakeBarkPlates(renderer, small);

    const flowerMap = flowerTexture(DRESS.petal, DRESS.heart);
    const moteMap = moteTexture(DRESS.moteCore, DRESS.moteEdge);
    into.textures.push(flowerMap, moteMap);

    /* ---- one root, assembled ----
       The near root keeps a discard-free twin of each opaque material, swapped
       in once the survey is over (`settleRoots`); the ridge dissolves, so it
       blends and never settles. */
    type Built = Root & { box: Box };
    const assemble = (grove: ReturnType<typeof buildGrove>, air: Air, order: number): Built => ({
      ...assembleRoot({
        scene,
        grove,
        uniforms: rootUniforms(shared, {
          hazeCol: air.hazeCol,
          haze: air.haze,
          fog: air.fog,
          hazeLift: air.hazeLift,
          boxH: BOX_W / air.box.aspect,
          mouseR: air.mouseR,
          // The end-fade belongs to the lab study's framing; here the mask
          // does the work, so the cut stays out of reach.
          mask: air.mask,
        }),
        bark: barkPlates.uniforms,
        flowerMap,
        soft: !!air.mask,
        settledTwins: true,
        orders: { bark: order, grass: order + 0.1, fern: order + 0.2, flower: order + 0.3 },
        wireK: [135, 950, 0.045],
        into,
      }),
      box: air.box,
    });

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

    const nearBuilt = assemble(
      near,
      {
        box: ARCH,
        haze: 0.15,
        fog: 0,
        hazeLift: 0.2,
        hazeCol: [0.176, 0.195, 0.145],
        mouseR: 1.2,
        mask: null,
      },
      2,
    );
    // The ridge dissolves before it reaches the cards (local x 0.4 → 3.4) and
    // into the floor light below it (the lower 0–42% of its box).
    const farBuilt = assemble(
      far,
      {
        box: FAR,
        haze: 0.16,
        fog: 0.26,
        hazeLift: 0.92,
        hazeCol: [0.15, 0.164, 0.12],
        mouseR: 1.4,
        mask: [0.4, 3.4, 0, 0.42],
      },
      0,
    );

    /* ---- shadow and light pool: everything that needs no geometry ---- */
    const plane = new THREE.PlaneGeometry(1, 1);
    into.geometries.push(plane);
    const shadowMap = contactShadowTexture();
    const glowMap = radialTexture(256, [
      [0, "rgba(226,236,212,0.30)"],
      [0.42, "rgba(214,226,200,0.10)"],
      [1, "rgba(214,226,200,0)"],
    ]);
    into.textures.push(shadowMap, glowMap);

    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowMap,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const shadowMesh = new THREE.Mesh(plane, shadowMat);
    shadowMesh.renderOrder = 1;
    shadowMesh.position.z = -70;
    scene.add(shadowMesh);
    into.materials.push(shadowMat);

    const glowMat = new THREE.MeshBasicMaterial({
      map: glowMap,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const glowMesh = new THREE.Mesh(plane, glowMat);
    glowMesh.renderOrder = -1;
    glowMesh.position.z = -320;
    scene.add(glowMesh);
    into.materials.push(glowMat);

    /* ---- drifting pollen, inside the near root's own space ----
       Riding the group rather than the scene means it is measured in root
       widths like everything else, so one set of numbers serves every
       breakpoint — and it picks up the root's parallax for free. */
    const motes = createMotes(small ? 1500 : 4200, moteMap, shared.uPhase, 3, into);
    motes.points.scale.setScalar(0.55);
    nearBuilt.group.add(motes.points);

    /* ---- the trail the pointer lifts off the moss ---- */
    const spray = createSpray(moteMap, motes.uniforms.uScale, 4.4, into);
    nearBuilt.group.add(spray.points);

    /* ---- butterfly ---- */
    const { group: butterfly, wings } = buildButterfly(shared, 0.205, into);
    nearBuilt.group.add(butterfly);

    /* ---- the flight ----
       A cycle: cruise, approach, settle on the crest with the wings held open,
       take off, round again. The pointer is already carried into this group's
       local space for the moss, so the animal reads the same value — no extra
       raycast, and in the units it flies in. */
    const perch = near.perch.clone();
    const BOX3 = {
      x0: perch.x - 1.5,
      x1: perch.x + 2.1,
      y0: perch.y - 0.1,
      y1: perch.y + 1.35,
      z0: perch.z - 0.25,
      z1: perch.z + 0.95,
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
        rand(BOX3.z0 + 0.2, BOX3.z1 - 0.15),
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
        if (st.timer <= 0) {
          st.mode = "approach";
          st.timer = 14;
        }
      } else if (st.mode === "approach") {
        if (st.pos.distanceTo(perch) < 0.12 || st.timer <= 0) {
          st.mode = "landed";
          st.timer = rand(7, 10);
        }
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
              Math.min(BOX3.z1 - 0.15, Math.max(BOX3.z0 + 0.2, st.pos.z + 0.4)),
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
      // resting wings flare open as the cursor closes in
      poseWings(wings, st.flap, st.settle, spook);
      bendWings(wings, Math.cos(st.flap) * beat);

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
      if (st.mode === "takeoff") {
        desired.y += 0.7;
        desired.z += 0.35;
      }
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
      qTmp.setFromAxisAngle(
        AX_Z,
        st.bank +
          Math.sin(t * 0.83) * 0.3 +
          Math.sin(st.flap) * 0.05 +
          Math.sin(t * 21) * spook * 0.16,
      );
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

    const place = (
      group: THREE.Group,
      box: Box,
      pinFx: number,
      pinFy: number,
      z: number,
      u: number,
      ox: number,
      oy: number,
      cover: number,
    ) => {
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
      // No floor at 1×: on a frame large enough to blow the budget the ratio
      // has to be allowed below it, which is exactly what PIXEL_BUDGET's note
      // promises for a 5K display. Solving it against the budget is the whole
      // point — clamping it back to 1 would spend a third more than the budget
      // on the largest frames, which are the ones that can least afford it.
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        small ? 1.6 : 2,
        Math.sqrt(PIXEL_BUDGET / (W * H)),
      );
      renderer.setPixelRatio(dpr);
      renderer.setSize(W, H, false);
      camera.fov = (2 * Math.atan(H / 2 / DIST) * 180) / Math.PI;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();

      const isNarrow = narrow.matches;
      const s = stage.getBoundingClientRect();
      const h = hero.getBoundingClientRect();
      // Both rects arrive through whatever transform an ancestor is wearing.
      // On the home page that is the approach's push-in: the whole scene
      // stands at scale 1.16 until the window has opened, and this runs at
      // mount, long before it has. W and H are untransformed, so the ratio
      // is that scale, and dividing it out is what keeps one stage unit equal
      // to one CSS pixel at z = 0 — the promise the cards are laid out on.
      // Without it the roots came out 16% too big and shifted toward the
      // corners, and the trunk that was placed to cross card a never did.
      const zoom = h.width / W || 1;
      const u = s.width / zoom / (isNarrow ? 760 : 1600);
      const ox = (s.left - h.left) / zoom;
      const oy = (s.top - h.top) / zoom;
      // wider than the stage: grow the roots to cover, pinned at a landmark
      const cover = Math.max(1, (W * zoom) / s.width);

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

      motes.uniforms.uScale.value = pointScale(renderer, camera);
      motes.uniforms.uSize.value = Math.max(1.8, 3 * u * cover);
      spray.uniforms.uSize.value = Math.max(2.6, 4.4 * u * cover);

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
        if (!mouseLive) {
          u.copy(AWAY);
          continue;
        }
        tmpLocal.copy(hitWorld);
        built.group.worldToLocal(tmpLocal);
        if (u.x > 999) u.copy(tmpLocal);
        else u.lerp(tmpLocal, 1 - Math.pow(0.0002, dt));
      }
    };

    /* The pointer's trail, laid in the near root's own space. */
    const sprayAt = new THREE.Vector3();
    const emitSpray = (dt: number) => {
      if (!mouseLive) {
        spray.trail.lift();
        return;
      }
      sprayAt.copy(hitWorld);
      nearBuilt.group.worldToLocal(sprayAt);
      spray.trail.at(sprayAt, dt, clock);
    };

    /* The last time the reader did anything — see FPS_IDLE. */
    let lastInput = performance.now();
    const markInput = () => {
      lastInput = performance.now();
    };
    for (const type of [
      "wheel",
      "scroll",
      "keydown",
      "touchstart",
      "touchmove",
      "pointerdown",
    ] as const) {
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
    // On `document`, not `window`: pointerleave does not bubble, and when the
    // pointer exits the viewport it is dispatched to body, html and document
    // — never to window, where this used to sit and never fired, leaving the
    // moss parted and the lean held wherever the pointer left.
    document.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("resize", layout);

    /* ---- the loop ---- */
    let clock = 0;
    let scanT = 0;
    let scanning = false;
    let onScreen = true;
    let visible = !document.hidden;
    // Coming back from a hidden tab or from off screen: the canvas has kept
    // its last frame, but be safe and draw once rather than trust it.
    const onVisibility = () => {
      visible = !document.hidden;
      needsRender = true;
    };
    document.addEventListener("visibilitychange", onVisibility);
    // Focus only picks the frame rate; it never stops the loop.
    let focused = document.hasFocus();
    const onFocus = () => {
      focused = true;
    };
    const onBlur = () => {
      focused = false;
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((en) => en.isIntersecting);
        needsRender = true;
      },
      { rootMargin: "10% 0px" },
    );
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

    /* The survey is over: the cage goes, the front is parked past the far
       corner so nothing is ever clipped by it again, and the near root's
       materials are swapped for the copies without discards. */
    const roots = [nearBuilt, farBuilt];
    const settle = () => settleRoots(shared, roots, scanMax * 4);

    /* The parallax eases toward the pointer at 5.5% per sixtieth of a second
       and never quite arrives; below this (in NDC — 1e-4 is 0.0026px of
       camera travel at the 26px scale) it is treated as arrived. */
    const SETTLED = 1e-4;
    const CENTRE = { x: 0, y: 0 };
    /* Written per unit of time rather than per frame so that the moss and the
       cards agree at any refresh rate, and at either of the two rates below —
       `GroveApproach`'s pointer tick eases by the same 0.055 per sixtieth. */
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
       (layout, a pointer move or leave, the tab or the hero coming
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
      const fps = !focused
        ? FPS_BLURRED
        : scanning || performance.now() - lastInput < IDLE_AFTER_MS
          ? FPS_FOCUSED
          : FPS_IDLE;
      if (pending < 1000 / fps - 1) return;
      const dt = Math.min(pending / 1000, 0.05);
      pending = 0;

      // Under reduced motion the cards in front (GroveApproach) do not follow
      // the pointer, so the camera behind them does not either: the two
      // parallaxes are one coordinate system, and one moving alone pulled the
      // cards off the moss they stand on. The camera eases home and stays.
      const target = calm.matches ? CENTRE : pointer;
      const dirty =
        needsRender ||
        !calm.matches ||
        scanning ||
        Math.abs(target.x - smooth.x) > SETTLED ||
        Math.abs(target.y - smooth.y) > SETTLED;
      if (!calm.matches) clock += dt;
      shared.uPhase.value = clock;
      spray.uniforms.uNow.value = clock;

      const k = ease(dt);
      smooth.x += (target.x - smooth.x) * k;
      smooth.y += (target.y - smooth.y) * k;

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
    if (!calm.matches && !document.hidden) {
      scanning = true;
      shared.uScanR.value = 0;
    } else settle();

    renderer.render(scene, camera);
    precompileSettled(renderer, roots, camera, scene);
    gsap.ticker.add(frame);
    onReady?.();

    return () => {
      disposed = true;
      ctx.dispose();
      gsap.ticker.remove(frame);
      setLive(false);
      io.disconnect();
      for (const type of [
        "wheel",
        "scroll",
        "keydown",
        "touchstart",
        "touchmove",
        "pointerdown",
      ] as const) {
        window.removeEventListener(type, markInput);
      }
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", layout);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      disposeAll(into);
      barkPlates.dispose();
      releaseRenderer(renderer);
    };
    // The scene is built once per GL context; the refs are stable, and only
    // a restored context (`epoch`) asks for it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epoch]);

  return <canvas ref={canvasRef} className="gh-scene" aria-hidden="true" />;
}
