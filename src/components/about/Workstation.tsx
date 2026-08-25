"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { gsap } from "@/lib/gsap";
import { prefersSaveData } from "@/lib/three/guards";
import { DRACO_DECODER_PATH } from "@/lib/three/draco";

/* "Gaming Desktop PC" by Yolala1232 (sketchfab.com/Yolala1232), CC-BY-4.0 —
 * the hero model of the owner's old fhf-portfolio, now living on the About
 * page. Compressed from 8.5 MB to 1.1 MB (Draco + 1024px WebP) at build
 * time; the Draco decoder is served from /draco/. */
const MODEL_URL = "/models/workstation.glb";
/** Idle turntable speed, rad/s — slow enough to read as "alive", not spin. */
const IDLE_SPIN = 0.16;
/**
 * Frames per second once nobody is touching the piece.
 *
 * The stage is deliberately never still — turntable, breath, LED pulse and a
 * lissajous camera drift, all of them slow on purpose. Slow is exactly why it
 * does not need the display's full refresh rate: at 0.16 rad/s a 120 Hz frame
 * advances the turntable by 0.08°, and drawing four of those to move what one
 * frame at 30 fps moves is the same picture bought four times. Measured on a
 * 120 Hz panel, an on-screen stage sat at ~37% of a GPU process.
 *
 * Interaction is not throttled — a drag has to track the finger, so the loop
 * runs flat out until the piece is left alone (see `idle` below). Everything
 * time-based reads `delta` or absolute time, so the motion is identical at
 * either cadence; only the sampling is coarser, and a 3.6s breath sampled 108
 * times is not a cadence anyone can see.
 */
const IDLE_FPS = 30;
const IDLE_FRAME_MS = 1000 / IDLE_FPS;
/** The export's forward axis points away from camera; ~2.6 rad shows the
 * desk face-on with a pleasant three-quarter angle. */
const HOME_Y = 2.6;
/** Widest half-band around the desk where the wheel dollies instead of
 *  scrolling the page — capped to a quarter of the stage on narrow screens
 *  (see `onWheel`). */
const DESK_BAND = 320;

type Props = {
  hint: string;
  className?: string;
};

/**
 * The owner's 3D workstation, lit and staged like a piece on a plinth.
 * A soft ground pool anchors it, an entrance beat swings it to face the
 * room, screens breathe, and a drag leaves it coasting on inertia.
 * Loads only when scrolled near, renders only while visible, and skips
 * itself entirely under Save-Data. There is one version of this scene and
 * everybody gets it — see the note in lib/three/guards.ts.
 */
export function Workstation({ hint, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"idle" | "ready" | "skipped">("idle");

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    if (prefersSaveData()) {
      setStatus("skipped");
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      30,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      50
    );
    camera.position.set(0, 1.3, 6.6);
    camera.lookAt(0, 0.15, 0);

    // Gallery lighting: cool wash from above, warm key from the wings, and a
    // faint cool rim from the back left. Tuned for physical units.
    scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x12121f, 3.0));
    const keyLight = new THREE.DirectionalLight(0xffd9a0, 3.8);
    keyLight.position.set(4, 6, 3);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x4cc9f0, 1.1);
    rimLight.position.set(-4, 2, -3);
    scene.add(rimLight);

    // A decorative desk must never take the page down with it: browsers with
    // WebGL disabled, blocklisted GPUs and headless runners all throw here.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
      });
    } catch {
      setStatus("skipped");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);

    // tilt (x) wraps spin (y) so the two axes never fight each other.
    // The ground pool lives on tiltGroup: it pitches with the desk but
    // does not ride the turntable (a shadow should not rotate).
    const tiltGroup = new THREE.Group();
    const turntable = new THREE.Group();
    tiltGroup.add(turntable);
    scene.add(tiltGroup);

    // A cool point light "hung on the case side" rides the turntable so it
    // keeps hugging the tower as the desk spins; it breathes with the LEDs.
    const caseLight = new THREE.PointLight(0x4cc9f0, 6, 4);
    caseLight.position.set(0.9, 0.55, 0.5);
    turntable.add(caseLight);

    let disposed = false;
    let model: THREE.Group | null = null;
    let baseModelY = 0;
    let baseScale = 1;

    /* Materials whose screens/LEDs breathe: base emissiveIntensity is
     * recorded once at load so per-frame writes never accumulate. */
    let glowMats: { mat: THREE.MeshStandardMaterial; base: number }[] = [];

    // Ground pool: procedural radial gradient. The desk's slab covers
    // roughly the inner half of the disc, so the readable zone is the ring
    // just outside it: a contact shadow directly beneath, a cool spill
    // escaping past the slab edge, dissolving to nothing at the rim.
    const groundCanvas = document.createElement("canvas");
    groundCanvas.width = 256;
    groundCanvas.height = 256;
    const groundCtx = groundCanvas.getContext("2d");
    if (groundCtx) {
      const grad = groundCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, "rgba(15,15,35,0.62)");
      grad.addColorStop(0.38, "rgba(28,48,88,0.34)");
      grad.addColorStop(0.47, "rgba(44,92,140,0.2)");
      grad.addColorStop(0.56, "rgba(56,130,180,0.12)");
      grad.addColorStop(0.7, "rgba(50,110,160,0.06)");
      grad.addColorStop(0.85, "rgba(38,80,130,0.025)");
      grad.addColorStop(1, "rgba(15,15,35,0)");
      groundCtx.fillStyle = grad;
      groundCtx.fillRect(0, 0, 256, 256);
    }
    const groundTex = new THREE.CanvasTexture(groundCanvas);
    groundTex.colorSpace = THREE.SRGBColorSpace;
    const groundGeo = new THREE.CircleGeometry(3.4, 48);
    const groundMat = new THREE.MeshBasicMaterial({
      map: groundTex,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.visible = false; // positioned + shown once the model's bounds are known
    tiltGroup.add(ground);

    const disposeModel = () => {
      if (!model) return;
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const mat of mats) {
          // material.dispose() frees no textures, and this model carries
          // emissive and metallic-roughness maps alongside the base color.
          const std = mat as THREE.MeshStandardMaterial;
          std.map?.dispose();
          std.normalMap?.dispose();
          std.emissiveMap?.dispose();
          std.metalnessMap?.dispose();
          std.roughnessMap?.dispose();
          std.aoMap?.dispose();
          mat.dispose();
        }
      });
      turntable.remove(model);
      model = null;
      glowMats = [];
    };

    /* ---- turntable state: drag sets the targets, idle drifts the spin ---- */
    const BASE_TILT = 0;
    let rotY = HOME_Y;
    let targetY = rotY;
    let tiltX = BASE_TILT;
    let targetTilt = tiltX;
    let zoom = 1;
    let targetZoom = 1;
    let dragging = false;
    let velY = 0; // smoothed horizontal drag velocity, px/frame
    let lastX = 0;
    let lastY = 0;
    let lastPointerAt = 0;

    /* ---- entrance: the piece rises onto its plinth and swings to face
     * the room. The loop reads these values every frame, so gsap can drive
     * them without touching three objects directly. ---- */
    const intro = { y: -0.5, s: 0.9, g: 0, spin: HOME_Y };
    let introTl: gsap.core.Timeline | null = null;
    let spinTween: gsap.core.Tween | null = null;
    let entrancePlayed = false;
    let visibleNow = false;

    const playEntrance = () => {
      if (entrancePlayed || !model) return;
      entrancePlayed = true;
      intro.spin = HOME_Y + 1.2;
      rotY = targetY = intro.spin;
      introTl = gsap.timeline();
      introTl.to(
        intro,
        { y: 0, s: 1, duration: 1.1, ease: "back.out(1.2)" },
        0
      );
      // The turntable overshoots by 1.2 rad and settles fast-to-slow onto
      // the display angle — like a handler turning the piece to face front.
      spinTween = gsap.to(intro, {
        spin: HOME_Y,
        duration: 1.4,
        ease: "power3.out",
        onUpdate: () => {
          if (!dragging) rotY = targetY = intro.spin;
        },
      });
      // The pool of light fades in as the piece lands.
      introTl.to(
        intro,
        { g: 1, duration: 0.9, ease: "power2.out" },
        0.35
      );
    };

    const lookAt = new THREE.Vector3(0, 0.15, 0);
    const baseOffset = camera.position.clone().sub(lookAt);

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragging = true;
      velY = 0;
      // Grabbing the piece mid-entrance hands the spin over to the visitor.
      spinTween?.kill();
      spinTween = null;
      lastX = e.clientX;
      lastY = e.clientY;
      container.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      targetY += dx * 0.008;
      // Smoothed velocity feeds the release inertia (house physics).
      velY = velY * 0.6 + dx * 0.4;
      // Vertical drag pitches the desk; clamped so it never flips over.
      // No inertia on tilt — pitch stays directly in hand.
      targetTilt = THREE.MathUtils.clamp(
        targetTilt + (e.clientY - lastY) * 0.005,
        -0.5,
        0.35
      );
      lastX = e.clientX;
      lastY = e.clientY;
      lastPointerAt = performance.now();
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      if (container.hasPointerCapture(e.pointerId)) {
        container.releasePointerCapture(e.pointerId);
      }
    };
    // Wheel over the desk dollies the camera. The stage is full-bleed now,
    // so only hijack the wheel near the centred desk (or on a pinch, which
    // arrives as ctrl+wheel) — at the edges the page keeps scrolling.
    //
    // The band is measured against the stage's own box and capped at a quarter
    // of it, never as a fixed offset from the viewport centre: ±320px covers
    // every pixel of a 640px-wide window, and the page then cannot be scrolled
    // past the desk at all. There have to be edges left for the promise above
    // to hold. Measured on resize, so the handler itself reads no layout.
    let deskCentre = 0;
    let deskBand = 0;
    const measureBand = () => {
      const rect = container.getBoundingClientRect();
      deskCentre = rect.left + rect.width / 2;
      deskBand = Math.min(DESK_BAND, rect.width / 4);
    };
    measureBand();

    const onWheel = (e: WheelEvent) => {
      const owns = Math.abs(e.clientX - deskCentre) < deskBand || e.ctrlKey;
      // Lenis listens on window and never looks at `defaultPrevented`, so the
      // call below cannot hold it off on its own — leave it at that and the
      // desk zooms while the page scrolls out from under it. Its documented
      // opt-out is `data-lenis-prevent-wheel`, read off the event's composed
      // path; this listener sits below window on that path, so setting the
      // attribute here still lands in time for the very event that set it.
      // Only ever while the desk owns the wheel — left on, the stage would
      // swallow every scroll again, which is the bug this whole band exists
      // to avoid.
      container.toggleAttribute("data-lenis-prevent-wheel", owns);
      if (!owns) return;
      e.preventDefault();
      const speed = e.ctrlKey ? 0.008 : 0.0016;
      targetZoom = THREE.MathUtils.clamp(
        targetZoom * Math.exp(-e.deltaY * speed),
        0.6,
        2.1
      );
      lastPointerAt = performance.now();
    };
    // Double click puts everything back where it started (spin stays).
    const onDblClick = () => {
      targetZoom = 1;
      targetTilt = BASE_TILT;
    };
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerUp);
    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("dblclick", onDblClick);

    let lastFrame = 0;
    const loop = () => {
      const now = performance.now();

      // Hands-off? Then 30 fps is plenty (see IDLE_FPS). The three conditions
      // are the same ones the body below uses to decide it is coasting: still
      // pressed, still carrying release inertia, or inside the 1.2s beat
      // before the idle spin resumes. Returning early leaves `lastFrame`
      // untouched, so the skipped time lands in the next `delta` and every
      // delta-driven motion keeps its real-world speed.
      const idle =
        !dragging && Math.abs(velY) <= 0.02 && now - lastPointerAt > 1200;
      if (idle && lastFrame && now - lastFrame < IDLE_FRAME_MS) return;

      const t = now / 1000;
      const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.1) : 0;
      lastFrame = now;
      // Holding still while pressed bleeds the stored velocity so a pause
      // before release doesn't fling the piece.
      if (dragging && now - lastPointerAt > 80) velY *= 0.7;
      // Release inertia: the turntable coasts and eases out.
      if (!dragging && Math.abs(velY) > 0.02) {
        targetY += velY * 0.008;
        velY *= 0.94;
      }
      // Resume the idle spin a beat after the visitor lets go.
      if (!dragging && now - lastPointerAt > 1200) {
        targetY += delta * IDLE_SPIN;
      }
      rotY += (targetY - rotY) * 0.08;
      tiltX += (targetTilt - tiltX) * 0.08;
      zoom += (targetZoom - zoom) * 0.1;
      turntable.rotation.y = rotY;
      tiltGroup.rotation.x = tiltX;
      if (model) {
        // Idle breath: a float too slow and shallow to catch the eye.
        const breathe = 0.03 * Math.sin((t * Math.PI * 2) / 3.6);
        model.position.y = baseModelY + intro.y + breathe;
        model.scale.setScalar(baseScale * intro.s);
      }
      groundMat.opacity = intro.g;
      // Screens and LEDs breathe on offset phases; the case light follows
      // the same pulse so its spill on the desk feels tied to the LEDs.
      for (let i = 0; i < glowMats.length; i++) {
        const g = glowMats[i];
        g.mat.emissiveIntensity = g.base * (0.85 + 0.15 * Math.sin(t * 1.7 + i));
      }
      caseLight.intensity = 6 * (1 + 0.2 * Math.sin(t * 1.7));
      // Camera never truly parks: a faint lissajous drift keeps every
      // frame distinct without ever reading as movement.
      camera.position.copy(lookAt).addScaledVector(baseOffset, 1 / zoom);
      camera.position.x += 0.04 * Math.sin(t * 0.31);
      camera.position.y += 0.04 * Math.sin(t * 0.23 + 1.3);
      camera.lookAt(lookAt);
      renderer.render(scene, camera);
    };

    let loaded = false;
    const load = () => {
      if (loaded || disposed) return;
      loaded = true;
      Promise.all([
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three/examples/jsm/loaders/DRACOLoader.js"),
      ]).then(([{ GLTFLoader }, { DRACOLoader }]) => {
        if (disposed) return;
        const draco = new DRACOLoader();
        draco.setDecoderPath(DRACO_DECODER_PATH);
        const loader = new GLTFLoader();
        loader.setDRACOLoader(draco);
        loader.load(
          MODEL_URL,
          (gltf) => {
            draco.dispose();
            if (disposed) return;
            const root = gltf.scene;
            // Normalize: center the desk, sit it slightly below eye line.
            const box = new THREE.Box3().setFromObject(root);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const s = 4.1 / Math.max(size.x, size.y, size.z, 1e-5);
            root.scale.setScalar(s);
            baseModelY = -center.y * s - 0.15;
            root.position.set(-center.x * s, baseModelY, -center.z * s);
            baseScale = s;
            // Park the ground pool just under the model's lowest point.
            ground.position.y = -(size.y / 2) * s - 0.15 - 0.02;
            ground.visible = true;
            // Collect emissive materials (screens, LED strips) once.
            const seen = new Set<THREE.Material>();
            const glowName = /screen|led|light/i;
            root.traverse((obj) => {
              const mesh = obj as THREE.Mesh;
              if (!mesh.isMesh) return;
              const mats = Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material];
              for (const m of mats) {
                if (seen.has(m)) continue;
                seen.add(m);
                const std = m as THREE.MeshStandardMaterial;
                if (!std.emissive) continue;
                const lit =
                  std.emissive.r + std.emissive.g + std.emissive.b > 0;
                const named =
                  glowName.test(std.name) || glowName.test(std.map?.name ?? "");
                if (lit || named) {
                  glowMats.push({ mat: std, base: std.emissiveIntensity });
                }
              }
            });
            turntable.add(root);
            model = root;
            setStatus("ready");
            if (visibleNow) {
              playEntrance();
            }
          },
          undefined,
          () => {
            draco.dispose();
            if (!disposed) setStatus("skipped");
          }
        );
      }).catch(() => {
        // A failed chunk load (offline, blocked CDN) must not leave the
        // spinner up forever as an unhandled rejection.
        if (!disposed) setStatus("skipped");
      });
    };

    // A hidden tab has nobody to show frames to. Browsers throttle rAF in
    // backgrounded tabs, but "throttled" is not "stopped" and the guarantees
    // vary — a window merely occluded by another, or one of several tabs the
    // user keeps switching between, can go on drawing. Stopping outright is
    // both cheaper and something we can actually rely on.
    const setLoop = (on: boolean) => {
      const run = on && !document.hidden;
      renderer.setAnimationLoop(run ? loop : null);
      if (run) lastFrame = 0;
    };
    const onVisibility = () => setLoop(visibleNow);
    document.addEventListener("visibilitychange", onVisibility);
    const io = new IntersectionObserver(
      ([entry]) => {
        const near = entry?.isIntersecting ?? false;
        visibleNow = near;
        if (near) {
          load();
          playEntrance();
        }
        setLoop(near);
      },
      { rootMargin: "300px" }
    );
    io.observe(container);

    const onResize = () => {
      const w = container.clientWidth;
      const h = Math.max(container.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      measureBand();
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      io.disconnect();
      introTl?.kill();
      spinTween?.kill();
      renderer.setAnimationLoop(null);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerUp);
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("dblclick", onDblClick);
      disposeModel();
      groundGeo.dispose();
      groundMat.dispose();
      groundTex.dispose();
      renderer.dispose();
    };
  }, []);

  if (status === "skipped") return null;

  return (
    <div className={className}>
      {/* No frame: the desk floats free on the page like the planet does,
          grounded only by its pool of light. Full-bleed breakout from the
          narrow prose column — html/body clip overflow-x, so 100vw is safe
          even with a scrollbar. */}
      <div
        ref={containerRef}
        className="relative left-1/2 h-[360px] w-screen -translate-x-1/2 cursor-grab touch-pan-y active:cursor-grabbing md:h-[460px]"
      >
        {/* To assistive tech the scene is one picture named by its caption.
            The role goes on the canvas, not the stage: everything under a
            role="img" is presentational, and the model credit below is a
            real link that has to stay reachable. A canvas cannot be an <img>,
            hence the lint override. */}
        {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
        <canvas ref={canvasRef} role="img" aria-label={hint} className="h-full w-full" />
        {/* Minimal loading state: a gold ring that quietly spins until the
            model lands, then fades away.

            The spin is dropped on ready, not merely faded out: the ring stays
            mounted for its 700ms fade, and a continuous animation on a mounted
            element keeps the entire page compositing at the display's refresh
            rate for as long as it runs — which, when it was only ever hidden
            behind opacity-0, meant permanently. Stopping mid-fade is not
            visible; the ring is on its way to invisible either way. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-700 ${
            status === "ready" ? "opacity-0" : "opacity-100"
          }`}
        >
          <div
            className={`h-8 w-8 rounded-full border border-accent/50 border-t-transparent ${
              status === "ready" ? "" : "animate-spin"
            }`}
          />
        </div>
        {/* Captions live inside the stage, bottom corners, like the other acts */}
        <div className="pointer-events-none absolute inset-x-6 bottom-2 flex items-baseline justify-between font-mono text-[10px] tracking-[0.12em] text-fg-tertiary sm:inset-x-10">
          <span>{hint}</span>
          <a
            href="https://sketchfab.com/3d-models/gaming-desktop-pc-d1d8282c9916438091f11aeb28787b66"
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto opacity-60 transition-opacity hover:opacity-100"
          >
            © Yolala1232 · CC-BY-4.0
          </a>
        </div>
      </div>
    </div>
  );
}
