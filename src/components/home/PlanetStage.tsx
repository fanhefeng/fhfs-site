"use client";

import { useRef, useState } from "react";
import * as THREE from "three";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";

// Referenced so bundlers keep the plugin; registration lives in @/lib/gsap.
void ScrollTrigger;

/* "Stylized planet" by cmzw (sketchfab.com/cmzw), CC-BY-4.0 — carried over
 * from the owner's old fhf-portfolio, where a big slowly-turning globe was
 * the sign-off of the page. Same idea here: one large model, front and
 * centre, as the encore before the finale. Credited in the footer. */
const MODEL_URL = "/models/planet/scene.gltf";
const PLANET_RADIUS = 0.9;
const PLANET_X = 0.62;
/** Idle turntable speed, rad/s. */
const IDLE_SPIN = 0.1;
/** Vinyl ring band — inner/outer world radii of the record. */
const RING_INNER_R = PLANET_RADIUS * 1.28;
const RING_OUTER_R = PLANET_RADIUS * 1.95;
/** Courier light orbit — rides the middle of the ring band. */
const COURIER_ORBIT_R = PLANET_RADIUS * 1.6;
/** Resting roll of the whole assembly; cursor tilt is added on top. */
const BASE_ROLL = 0.16;
/** Resting z-rotation of the ring group (see makeRings). */
const RING_ROLL = -0.3;

type Props = {
  kicker: string;
  heading: string;
  line: string;
  hint: string;
};

/** Points uniformly inside a sphere — same trick as fx/Starfield. */
function inSphere(count: number, radius: number): Float32Array {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radius * Math.cbrt(Math.random());
    out[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    out[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    out[i * 3 + 2] = r * Math.cos(phi);
  }
  return out;
}

/**
 * "ENCORE · City of stars" — the stylized planet on its own full stage.
 *
 * Directed, not idling: the planet rises from below the horizon as the act
 * scrolls in, the rings unfold a beat later, the copy lifts out of its slice
 * masks. After that it is playable — drag to fling it (inertia carries on),
 * the whole assembly leans towards the cursor, a courier light rides the
 * gold ring like a night train, and the odd meteor crosses the dust field.
 * Loads only when the visitor approaches, renders only while visible,
 * skips itself under Save-Data, and reduced-motion gets one static frame
 * of the finished stage.
 */
export function PlanetStage({ kicker, heading, line, hint }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useGSAP(
    (_, contextSafe) => {
      const section = sectionRef.current;
      const canvas = canvasRef.current;
      if (!section || !canvas || !contextSafe) return;

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const nav = navigator as Navigator & {
        connection?: { saveData?: boolean };
      };
      if (nav.connection?.saveData) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        38,
        section.clientWidth / Math.max(section.clientHeight, 1),
        0.1,
        20
      );
      camera.position.set(0, 0.1, 3.6);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.AmbientLight(0xbfd4ff, 2.2));
      const keyLight = new THREE.DirectionalLight(0xffd9a0, 3.2);
      keyLight.position.set(-1.5, 0.8, 1.2);
      scene.add(keyLight);

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(section.clientWidth, section.clientHeight);

      let disposed = false;
      let running = false;
      let root: THREE.Group | null = null;
      let spin: THREE.Object3D | null = null;
      let clouds: THREE.Object3D | null = null;
      let rings: THREE.Group | null = null;
      let courier: THREE.Sprite | null = null;

      /* Entrance proxy — the frame loop is the single writer of object
       * transforms (breathing, tilt, precession all compose there), so the
       * intro timeline animates this proxy instead of fighting the loop. */
      const intro = { y: -1.3, scale: 0.75, ringScale: 0.55, ringSpin: -0.6 };
      const introDone = () => {
        intro.y = 0;
        intro.scale = 1;
        intro.ringScale = 1;
        intro.ringSpin = 0;
      };

      const disposeAll = (obj: THREE.Object3D) => {
        obj.traverse((child) => {
          const sprite = child as THREE.Sprite;
          if (sprite.isSprite) {
            sprite.material.map?.dispose();
            sprite.material.dispose();
            return;
          }
          const points = child as THREE.Points;
          if (points.isPoints) {
            points.geometry.dispose();
            (points.material as THREE.Material).dispose();
            return;
          }
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry.dispose();
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          for (const mat of mats) {
            (mat as THREE.MeshStandardMaterial).map?.dispose();
            mat.dispose();
          }
        });
      };

      const radialGlowTexture = (size: number, core: string, mid: string) => {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        if (ctx) {
          const g = ctx.createRadialGradient(
            size / 2, size / 2, 0,
            size / 2, size / 2, size / 2
          );
          g.addColorStop(0, core);
          g.addColorStop(0.4, mid);
          g.addColorStop(1, "rgba(232,180,79,0)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, size, size);
        }
        return new THREE.CanvasTexture(c);
      };

      const makeHalo = () => {
        const size = 256;
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        if (ctx) {
          const g = ctx.createRadialGradient(
            size / 2, size / 2, 0,
            size / 2, size / 2, size / 2
          );
          g.addColorStop(0, "rgba(232,180,79,0.5)");
          g.addColorStop(0.35, "rgba(232,180,79,0.16)");
          g.addColorStop(0.7, "rgba(76,201,240,0.07)");
          g.addColorStop(1, "rgba(76,201,240,0)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, size, size);
        }
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(c),
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            // Kept low so the halo doesn't wash out the ring band's grooves.
            opacity: 0.7,
          })
        );
        sprite.scale.setScalar(PLANET_RADIUS * 3.4);
        return sprite;
      };

      /* A small gold light that patrols the gold ring — a night train on
       * its orbit. Same radial-gradient trick as the halo, sized down. */
      const makeCourier = () => {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: radialGlowTexture(
              64,
              "rgba(255,228,160,1)",
              "rgba(232,180,79,0.45)"
            ),
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
        );
        sprite.scale.setScalar(0.07);
        sprite.position.set(COURIER_ORBIT_R, 0, 0);
        return sprite;
      };

      /* Vinyl-groove texture for the ring band. RingGeometry's UVs are a
       * planar map of the disc (position / outerRadius, recentred), so
       * concentric circles drawn around the canvas centre line up with the
       * geometry exactly. Painted as glowing haze plus etched grooves —
       * a record pressed out of stage light, not a solid colour disc. */
      const makeRingTexture = () => {
        const size = 512;
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        if (ctx) {
          const cx = size / 2;
          // World radius -> canvas px; the outer rim maps to the canvas edge.
          const px = (r: number) => (r / RING_OUTER_R) * cx;
          const rIn = px(RING_INNER_R);
          const rOut = cx;
          const span = rOut - rIn;

          // Base band: translucent gold that swells mid-band and trails off
          // to nothing at the outer rim — the long fading tail of the disc.
          const g = ctx.createRadialGradient(cx, cx, rIn, cx, cx, rOut);
          g.addColorStop(0, "rgba(232,180,79,0.16)");
          g.addColorStop(0.25, "rgba(232,180,79,0.10)");
          g.addColorStop(0.5, "rgba(232,180,79,0.14)");
          g.addColorStop(0.8, "rgba(232,180,79,0.06)");
          g.addColorStop(1, "rgba(232,180,79,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(cx, cx, rOut, 0, Math.PI * 2);
          ctx.arc(cx, cx, rIn, 0, Math.PI * 2, true);
          ctx.fill();

          const circle = (r: number, w: number, style: string) => {
            ctx.strokeStyle = style;
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.arc(cx, cx, r, 0, Math.PI * 2);
            ctx.stroke();
          };

          // Bright rim line hugging the inner edge.
          circle(rIn + 1.5, 2.5, "rgba(232,180,79,0.55)");

          // Record grooves: thin bright circles with widening spacing, two
          // cooled to neon blue as accents. Gold grooves dim towards the
          // tail; the blue pair keeps full strength so the accent reads.
          const grooves = [0.08, 0.17, 0.28, 0.41, 0.56, 0.73, 0.92];
          grooves.forEach((t, i) => {
            const blue = i === 2 || i === 5;
            const fade = 1 - t * 0.55;
            circle(
              rIn + span * t,
              1,
              blue
                ? "rgba(76,201,240,0.3)"
                : `rgba(232,180,79,${(0.28 * fade).toFixed(3)})`
            );
          });
        }
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        // The band sits near edge-on, so anisotropy keeps grooves readable.
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        return tex;
      };

      const makeRings = () => {
        const group = new THREE.Group();
        group.add(
          new THREE.Mesh(
            new THREE.RingGeometry(RING_INNER_R, RING_OUTER_R, 128),
            new THREE.MeshBasicMaterial({
              map: makeRingTexture(),
              transparent: true,
              side: THREE.DoubleSide,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            })
          )
        );
        // Tipped towards edge-on so the ellipse sweeps up-right, away from
        // the copy on the left. The planet writes depth and the band does
        // not, so the far half of the band ducks behind the globe for free.
        group.rotation.set(1.42, 0, RING_ROLL);
        return group;
      };

      /* Ambient dust — ~240 dim stars local to this act so the planet
       * hangs in space rather than floating on a flat backdrop. */
      const makeDust = () => {
        const group = new THREE.Group();
        const cloud = (count: number, color: string, size: number) => {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(inSphere(count, 3), 3)
          );
          return new THREE.Points(
            geometry,
            new THREE.PointsMaterial({
              color,
              size,
              sizeAttenuation: true,
              transparent: true,
              opacity: 0.5,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            })
          );
        };
        group.add(cloud(160, "#e8b44f", 0.012), cloud(80, "#4cc9f0", 0.015));
        return group;
      };

      const dust = makeDust();
      dust.position.set(0.35, 0, -1);
      scene.add(dust);

      /* Meteor — one reusable thin streak sprite, faded out between runs. */
      const makeMeteorTexture = () => {
        const c = document.createElement("canvas");
        c.width = 128;
        c.height = 6;
        const ctx = c.getContext("2d");
        if (ctx) {
          // Tail (transparent) on the left, white-hot head on the right; the
          // sprite is rotated so +x points along the travel direction.
          const g = ctx.createLinearGradient(0, 0, 128, 0);
          g.addColorStop(0, "rgba(245,240,232,0)");
          g.addColorStop(0.75, "rgba(245,240,232,0.35)");
          g.addColorStop(0.97, "rgba(255,255,255,1)");
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 2, 128, 2);
          // Soft sheath around the 2px core so the streak isn't a hard bar.
          ctx.globalAlpha = 0.35;
          ctx.fillRect(0, 1, 128, 4);
        }
        return new THREE.CanvasTexture(c);
      };
      const meteor = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: makeMeteorTexture(),
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      meteor.scale.set(0.9, 0.05, 1);
      meteor.position.set(0, 1.4, -1.4);
      scene.add(meteor);

      let meteorTimer = 0;
      const scheduleMeteor = () => {
        if (disposed) return;
        meteorTimer = window.setTimeout(
          spawnMeteor,
          5000 + Math.random() * 4000
        );
      };
      const spawnMeteor = contextSafe(() => {
        if (disposed) return;
        // Off screen — skip this one quietly and try again later.
        if (!running) {
          scheduleMeteor();
          return;
        }
        const x0 = -0.4 + Math.random() * 2.6;
        const y0 = 1.1 + Math.random() * 0.6;
        const dx = -(1.6 + Math.random() * 0.9);
        const dy = -(0.8 + Math.random() * 0.5);
        meteor.material.rotation = Math.atan2(dy, dx);
        gsap
          .timeline({ onComplete: scheduleMeteor })
          .fromTo(
            meteor.position,
            { x: x0, y: y0, z: -1.4 },
            { x: x0 + dx, y: y0 + dy, duration: 0.9, ease: "power1.in" },
            0
          )
          // Kept dim on purpose — a passer-by, not a headline act.
          .fromTo(
            meteor.material,
            { opacity: 0 },
            { opacity: 0.65, duration: 0.15, ease: "power1.out" },
            0
          )
          .to(
            meteor.material,
            { opacity: 0, duration: 0.75, ease: "power1.in" },
            0.15
          );
      });

      /* ---- drag to fling, cursor tilt, idle spin ---- */
      let rotY = 0;
      let targetY = 0;
      let vel = 0;
      let dragging = false;
      let lastX = 0;
      let lastPointerAt = 0;
      let tiltX = 0;
      let tiltZ = 0;
      let tiltTargetX = 0;
      let tiltTargetZ = 0;

      const onPointerDown = (e: PointerEvent) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        dragging = true;
        vel = 0;
        lastX = e.clientX;
        section.setPointerCapture(e.pointerId);
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!dragging) {
          // Cursor-follow lean. The section is near-fullscreen, so viewport
          // normalisation stands in for its rect — no per-frame rect reads.
          const nx = (e.clientX / window.innerWidth) * 2 - 1;
          const ny = (e.clientY / window.innerHeight) * 2 - 1;
          tiltTargetX = ny * 0.09;
          tiltTargetZ = -nx * 0.09;
          return;
        }
        const dx = e.clientX - lastX;
        targetY += dx * 0.006;
        // Same velocity smoothing as the site's sliders.
        vel = vel * 0.6 + dx * 0.4;
        lastX = e.clientX;
        lastPointerAt = performance.now();
      };
      const onPointerUp = (e: PointerEvent) => {
        dragging = false;
        if (section.hasPointerCapture(e.pointerId)) {
          section.releasePointerCapture(e.pointerId);
        }
      };
      const onPointerLeave = () => {
        tiltTargetX = 0;
        tiltTargetZ = 0;
      };
      if (!reducedMotion) {
        section.addEventListener("pointerdown", onPointerDown);
        section.addEventListener("pointermove", onPointerMove);
        section.addEventListener("pointerup", onPointerUp);
        section.addEventListener("pointercancel", onPointerUp);
        section.addEventListener("pointerleave", onPointerLeave);
      }

      let ringPrecess = 0;
      let courierAngle = Math.random() * Math.PI * 2;
      let lastFrame = 0;
      const loop = () => {
        const now = performance.now();
        const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.1) : 0;
        lastFrame = now;

        if (!dragging) {
          // Flick inertia carries the last drag on, decaying like the sliders.
          if (Math.abs(vel) > 0.02) {
            targetY += vel * 0.006;
            vel *= 0.94;
          } else {
            vel = 0;
          }
          if (now - lastPointerAt > 1200) targetY += delta * IDLE_SPIN;
        }
        rotY += (targetY - rotY) * 0.08;
        tiltX += (tiltTargetX - tiltX) * 0.05;
        tiltZ += (tiltTargetZ - tiltZ) * 0.05;

        if (spin) spin.rotation.y = rotY;
        // Clouds run 35% ahead of the surface — the drift reads as weather.
        if (clouds) clouds.rotation.y = rotY * 1.35;
        ringPrecess += delta * 0.015;
        if (rings) {
          rings.rotation.z = RING_ROLL + ringPrecess + intro.ringSpin;
          rings.scale.setScalar(intro.ringScale);
        }
        if (root) {
          root.position.y = intro.y + Math.sin(now * 0.0004) * 0.035;
          root.scale.setScalar(intro.scale);
          root.rotation.x = tiltX;
          root.rotation.z = BASE_ROLL + tiltZ;
        }
        if (courier) {
          courierAngle += delta * 0.5;
          courier.position.set(
            Math.cos(courierAngle) * COURIER_ORBIT_R,
            Math.sin(courierAngle) * COURIER_ORBIT_R,
            0
          );
          // 0.5s pulse: 2π / 500ms.
          courier.scale.setScalar(0.07 * (1 + 0.13 * Math.sin(now * 0.01257)));
        }
        dust.rotation.y += delta / 18;
        renderer.render(scene, camera);
      };

      /* ---- entrance choreography ---- */

      // Copy rises out of its slice masks alongside the planet. Hidden via
      // JS only so a no-JS visitor still reads the section.
      const inners = gsap.utils.selector(section)(".split-inner");
      if (!reducedMotion && inners.length > 0) {
        gsap.set(inners, { yPercent: 110 });
        gsap
          .timeline({
            scrollTrigger: { trigger: section, start: "top 70%", once: true },
            defaults: { ease: "expo.out" },
          })
          .to(inners, { yPercent: 0, duration: 1, stagger: 0.1 }, 0.35);
      }

      // 3D half of the same cue — built once the GLTF is in. If the visitor
      // has already scrolled past the trigger by then, jump to the end state.
      const buildEntrance = contextSafe(() => {
        // One-off rect read at load time, never in the frame loop.
        const past =
          section.getBoundingClientRect().top < window.innerHeight * 0.7;
        if (past) {
          introDone();
          return;
        }
        gsap
          .timeline({
            scrollTrigger: { trigger: section, start: "top 70%", once: true },
          })
          // The planet lifts off the lower horizon...
          .to(intro, { y: 0, scale: 1, duration: 1.6, ease: "power3.out" }, 0)
          // ...and the rings unfold on its heels, settling their extra turn.
          .to(
            intro,
            { ringScale: 1, ringSpin: 0, duration: 1.1, ease: "power3.out" },
            0.8
          );
      });

      let loaded = false;
      const load = () => {
        if (loaded || disposed) return;
        loaded = true;
        import("three/examples/jsm/loaders/GLTFLoader.js").then(
          ({ GLTFLoader }) => {
            if (disposed) return;
            new GLTFLoader().load(
              MODEL_URL,
              (gltf) => {
                if (disposed) {
                  disposeAll(gltf.scene);
                  return;
                }
                const model = gltf.scene;
                const sphere = new THREE.Box3()
                  .setFromObject(model)
                  .getBoundingSphere(new THREE.Sphere());
                const s = PLANET_RADIUS / Math.max(sphere.radius, 1e-5);
                model.scale.setScalar(s);
                model.position.sub(sphere.center.multiplyScalar(s));
                model.traverse((obj) => {
                  const mesh = obj as THREE.Mesh;
                  if (!mesh.isMesh) return;
                  const mat = mesh.material as THREE.MeshStandardMaterial;
                  if (mat.name === "Clouds") clouds = mesh;
                });

                const group = new THREE.Group();
                group.add(makeHalo());
                const ringGroup = makeRings();
                const courierSprite = makeCourier();
                ringGroup.add(courierSprite);
                group.add(ringGroup);
                group.add(model);
                group.position.set(PLANET_X, 0, 0);
                group.rotation.z = BASE_ROLL;
                scene.add(group);
                root = group;
                spin = model;
                rings = ringGroup;
                courier = courierSprite;
                setReady(true);
                if (reducedMotion) {
                  // Static but complete: the finished stage, one frame.
                  introDone();
                  renderer.render(scene, camera);
                } else {
                  buildEntrance();
                }
              },
              undefined,
              () => {
                /* Sky stays empty; the copy still reads as a section. */
              }
            );
          },
          () => {}
        );
      };

      const setLoop = (on: boolean) => {
        if (reducedMotion) return;
        renderer.setAnimationLoop(on ? loop : null);
        if (on) lastFrame = 0;
      };
      const io = new IntersectionObserver(
        ([entry]) => {
          const near = entry?.isIntersecting ?? false;
          if (near) load();
          running = near;
          setLoop(near);
        },
        { rootMargin: "400px" }
      );
      io.observe(section);

      if (!reducedMotion) scheduleMeteor();

      const onResize = () => {
        const w = section.clientWidth;
        const h = Math.max(section.clientHeight, 1);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (reducedMotion) renderer.render(scene, camera);
      };
      window.addEventListener("resize", onResize);

      return () => {
        disposed = true;
        io.disconnect();
        renderer.setAnimationLoop(null);
        window.clearTimeout(meteorTimer);
        window.removeEventListener("resize", onResize);
        section.removeEventListener("pointerdown", onPointerDown);
        section.removeEventListener("pointermove", onPointerMove);
        section.removeEventListener("pointerup", onPointerUp);
        section.removeEventListener("pointercancel", onPointerUp);
        section.removeEventListener("pointerleave", onPointerLeave);
        disposeAll(dust);
        scene.remove(dust);
        meteor.material.map?.dispose();
        meteor.material.dispose();
        scene.remove(meteor);
        if (root) {
          disposeAll(root);
          scene.remove(root);
        }
        renderer.dispose();
      };
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      data-act="encore"
      className="relative min-h-[92svh] cursor-grab touch-pan-y overflow-hidden active:cursor-grabbing"
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      />
      {/* Copy sits on the left, the planet fills the right */}
      <div className="pointer-events-none relative z-10 mx-auto flex min-h-[92svh] max-w-5xl flex-col justify-center px-6">
        <p className="split-line">
          <span className="split-inner track-kicker">{kicker}</span>
        </p>
        <h2 className="mt-4 max-w-[12ch] font-deco text-4xl leading-tight text-gold [text-shadow:var(--glow-gold)] md:text-6xl">
          <span className="split-line">
            <span className="split-inner">{heading}</span>
          </span>
        </h2>
        <p className="split-line mt-6 max-w-sm text-sm leading-relaxed text-muted-fg">
          <span className="split-inner">{line}</span>
        </p>
      </div>
      {ready && (
        <p className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 font-mono text-[10px] tracking-[0.18em] text-muted-fg">
          {hint}
        </p>
      )}
    </section>
  );
}
