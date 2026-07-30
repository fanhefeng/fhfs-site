"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const GOLD_COUNT = 1100;
const BLUE_COUNT = 500;
const SPHERE_RADIUS = 1.2;
const BASE_TILT = Math.PI / 4;

type Props = {
  className?: string;
};

/**
 * Fill `count * 3` floats with points uniformly distributed inside a
 * sphere: random unit direction scaled by radius * cbrt(u) so density
 * stays even from core to shell.
 */
function inSphere(count: number, radius: number): Float32Array {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Uniform direction via normal-ish trick: acos for polar angle.
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radius * Math.cbrt(Math.random());
    out[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    out[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    out[i * 3 + 2] = r * Math.cos(phi);
  }
  return out;
}

function makeStars(count: number, color: string, size: number): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(inSphere(count, SPHERE_RADIUS), 3)
  );
  const material = new THREE.PointsMaterial({
    color,
    size,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geometry, material);
}

/**
 * Night-sky particle field behind the hero — the planetarium scene's
 * quieter cousin. Two point clouds (gold + neon blue) drift in a slow
 * self-rotation while scroll nudges the roll angle, so the sky feels
 * pinned to the record player's motion. Rendering pauses off-screen
 * and reduced-motion visitors get a single static frame.
 *
 * The stylized planet used to hang here too — it now has its own act,
 * see home/PlanetStage.tsx (ENCORE · City of stars).
 */
export function Starfield({ className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      10
    );
    camera.position.z = 1;

    const group = new THREE.Group();
    group.rotation.z = BASE_TILT;
    const goldStars = makeStars(GOLD_COUNT, "#e8b44f", 0.004);
    const blueStars = makeStars(BLUE_COUNT, "#4cc9f0", 0.005);
    group.add(goldStars, blueStars);
    scene.add(group);

    // Point sprites don't benefit from antialiasing — keep the cheap path.
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);

    // Own clock rather than THREE.Clock, which is deprecated in this version.
    let lastFrame = 0;
    const loop = () => {
      const now = performance.now();
      // Cap the step so a paused tab does not resume with a jolt.
      const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.1) : 0;
      lastFrame = now;
      group.rotation.x -= delta / 10;
      group.rotation.y -= delta / 15;
      renderer.render(scene, camera);
    };

    if (reducedMotion) {
      // Static but complete: one frame of sky, no motion at all.
      renderer.render(scene, camera);
    }

    // Pause rendering while the hero is scrolled out of view. Resetting the
    // frame stamp on resume keeps the first delta from being a huge jump.
    const setLoop = (on: boolean) => {
      if (reducedMotion) return;
      renderer.setAnimationLoop(on ? loop : null);
      if (on) lastFrame = 0;
    };
    const io = new IntersectionObserver(([entry]) => {
      setLoop(entry?.isIntersecting ?? false);
    });
    io.observe(container);

    // Scroll parallax — rAF-throttled so fast scrolling coalesces into
    // one rotation update per frame; the render itself happens in loop().
    let scrollRaf = 0;
    const onScroll = () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        group.rotation.z = BASE_TILT + window.scrollY * 0.00012;
      });
    };
    if (!reducedMotion) {
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    const onResize = () => {
      const w = container.clientWidth;
      const h = Math.max(container.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (reducedMotion) renderer.render(scene, camera);
    };
    window.addEventListener("resize", onResize);

    return () => {
      renderer.setAnimationLoop(null);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      for (const stars of [goldStars, blueStars]) {
        stars.geometry.dispose();
        (stars.material as THREE.Material).dispose();
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={"pointer-events-none absolute inset-0 " + (className ?? "")}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
