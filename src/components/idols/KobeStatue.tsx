"use client";

import { useEffect, useMemo, type MutableRefObject } from "react";
import { Canvas, invalidate, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { gsap, EASE } from "@/lib/gsap";

/**
 * The statue, built in code.
 *
 * Not a scan and not a sculpt: a figure of capsules and spheres in the pose
 * of the bronze on Star Plaza — feet set, left fist at the hip, the right
 * arm straight up and one finger further — cast in one bronze material and
 * lit like a plaza at dusk. It reads as a statue because everything about it
 * is statue: one metal, one base, one gesture. The number on the chest is
 * the only thing drawn, and it is drawn on a canvas, not loaded.
 *
 * Nothing here runs on a clock. The canvas renders on demand: the stage
 * around it turns the figure (a ref, and `invalidate()` per change) and
 * plays the one entrance; parked, the scene draws no frame at all.
 */

type Props = {
  /** The figure's turn, in radians — written by the stage, read per frame. */
  spin: MutableRefObject<number>;
  onScreen: boolean;
  /** The first frame is on its way: the stage can fade the canvas in. */
  onReady: () => void;
};

type V3 = [number, number, number];

/** A limb: a capsule from one joint to the next. */
function Bone({ from, to, r, material }: { from: V3; to: V3; r: number; material: THREE.Material }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const length = dir.length();
    const position = a.clone().add(b).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.normalize()
    );
    return { position, quaternion, length };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion} material={material} castShadow={false}>
      <capsuleGeometry args={[r, length, 6, 18]} />
    </mesh>
  );
}

/** The jersey number, painted once onto a canvas — no font file, no glyph mesh. */
function numberTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${size * 0.86}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("8", size / 2, size / 2 + size * 0.04);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/** A soft dark disc under the base, standing in for the plaza's shadow. */
function shadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(0,0,0,0.42)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function Figure({ spin, onReady }: Pick<Props, "spin" | "onReady">) {
  const bronze = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#7a5230"),
        metalness: 0.88,
        roughness: 0.42,
        envMapIntensity: 1.1,
      }),
    []
  );
  const bronzeLit = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#e0b76a"),
        metalness: 0.9,
        roughness: 0.28,
        envMapIntensity: 1.6,
        alphaMap: numberTexture(),
        transparent: true,
        depthWrite: false,
      }),
    []
  );
  // Polished granite reads as stone only if it stays dark: a low envMap
  // intensity and a coarser roughness keep the top face from washing out
  // into a white slab under the panels.
  const granite = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#17161a"),
        metalness: 0.1,
        roughness: 0.55,
        envMapIntensity: 0.2,
      }),
    []
  );
  const shadow = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: shadowTexture(),
        transparent: true,
        depthWrite: false,
      }),
    []
  );

  useEffect(() => {
    return () => {
      bronze.dispose();
      bronzeLit.alphaMap?.dispose();
      bronzeLit.dispose();
      granite.dispose();
      shadow.map?.dispose();
      shadow.dispose();
    };
  }, [bronze, bronzeLit, granite, shadow]);

  const group = useMemo(() => new THREE.Group(), []);
  const rise = useMemo(() => ({ y: 0 }), []);

  // The one entrance: the figure comes up out of the base and turns to face
  // the reader, once, then everything is still. Every tick asks for its own
  // frame — under "demand" nothing else would.
  useEffect(() => {
    spin.current = -0.9;
    rise.y = -0.28;
    const tl = gsap.timeline({ onUpdate: () => invalidate() });
    tl.to(spin, { current: 0, duration: 1.5, ease: EASE.default }, 0);
    tl.to(rise, { y: 0, duration: 1.2, ease: EASE.default }, 0.05);
    onReady();
    invalidate();
    return () => {
      tl.kill();
    };
  }, [spin, rise, onReady]);

  useFrame(() => {
    group.rotation.y = spin.current;
    group.position.y = rise.y;
  });

  return (
    <>
      <primitive object={group}>
        {/* Legs — feet set a shade wider than the hips, the right toe out. */}
        <Bone from={[-0.11, 0.93, 0]} to={[-0.15, 0.5, 0.02]} r={0.095} material={bronze} />
        <Bone from={[-0.15, 0.5, 0.02]} to={[-0.17, 0.1, 0]} r={0.072} material={bronze} />
        <mesh position={[-0.17, 0.05, 0.08]} material={bronze}>
          <boxGeometry args={[0.14, 0.09, 0.32]} />
        </mesh>
        <Bone from={[0.11, 0.93, 0]} to={[0.16, 0.5, -0.02]} r={0.095} material={bronze} />
        <Bone from={[0.16, 0.5, -0.02]} to={[0.19, 0.1, -0.04]} r={0.072} material={bronze} />
        <mesh position={[0.2, 0.05, 0.04]} rotation={[0, -0.18, 0]} material={bronze}>
          <boxGeometry args={[0.14, 0.09, 0.32]} />
        </mesh>

        {/* Shorts and torso. */}
        <mesh position={[0, 0.78, 0]} material={bronze}>
          <cylinderGeometry args={[0.215, 0.25, 0.34, 24]} />
        </mesh>
        <Bone from={[0, 0.9, 0]} to={[0, 1.2, 0]} r={0.19} material={bronze} />
        <Bone from={[0, 1.15, 0]} to={[0, 1.52, 0]} r={0.215} material={bronze} />
        <mesh position={[-0.25, 1.5, 0]} material={bronze}>
          <sphereGeometry args={[0.095, 20, 14]} />
        </mesh>
        <mesh position={[0.25, 1.5, 0]} material={bronze}>
          <sphereGeometry args={[0.095, 20, 14]} />
        </mesh>

        {/* The number, front and back — raised a hair off the jersey. */}
        <mesh position={[0, 1.34, 0.222]} material={bronzeLit}>
          <planeGeometry args={[0.17, 0.21]} />
        </mesh>
        <mesh position={[0, 1.38, -0.222]} rotation={[0, Math.PI, 0]} material={bronzeLit}>
          <planeGeometry args={[0.22, 0.27]} />
        </mesh>

        {/* Left arm, down: a fist at the hip. */}
        <Bone from={[-0.27, 1.5, 0]} to={[-0.35, 1.23, -0.03]} r={0.068} material={bronze} />
        <Bone from={[-0.35, 1.23, -0.03]} to={[-0.31, 0.98, 0.03]} r={0.058} material={bronze} />
        <mesh position={[-0.3, 0.92, 0.04]} material={bronze}>
          <sphereGeometry args={[0.072, 18, 12]} />
        </mesh>

        {/* Right arm, straight up — and one finger further. */}
        <Bone from={[0.27, 1.5, 0]} to={[0.37, 1.86, 0.02]} r={0.068} material={bronze} />
        <Bone from={[0.37, 1.86, 0.02]} to={[0.41, 2.2, 0.03]} r={0.058} material={bronze} />
        <mesh position={[0.41, 2.25, 0.03]} material={bronze}>
          <sphereGeometry args={[0.066, 18, 12]} />
        </mesh>
        <Bone from={[0.41, 2.29, 0.03]} to={[0.42, 2.47, 0.035]} r={0.021} material={bronze} />

        {/* Neck and head, tilted a little back toward the finger. */}
        <Bone from={[0, 1.52, 0]} to={[0.01, 1.66, 0.01]} r={0.062} material={bronze} />
        <mesh position={[0.015, 1.8, 0.015]} material={bronze}>
          <sphereGeometry args={[0.137, 28, 20]} />
        </mesh>
      </primitive>

      {/* The base: granite, and a bronze plate for the box score. */}
      <mesh position={[0, -0.45, 0]} material={granite}>
        <boxGeometry args={[1.5, 0.9, 1.15]} />
      </mesh>
      <mesh position={[0, -0.4, 0.586]} material={bronze}>
        <boxGeometry args={[0.72, 0.3, 0.02]} />
      </mesh>
      <mesh position={[0, -0.899, 0]} rotation={[-Math.PI / 2, 0, 0]} material={shadow}>
        <planeGeometry args={[3.2, 3.2]} />
      </mesh>
    </>
  );
}

export default function KobeStatue({ spin, onScreen, onReady }: Props) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={onScreen ? "demand" : "never"}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 1.05, 5.3], fov: 34, near: 0.1, far: 50 }}
      onCreated={({ camera, gl }) => {
        // Framed on the whole monument, finger to plinth, with a little air.
        camera.lookAt(0, 0.82, 0);
        // A recovered context has nothing to prompt a frame under "demand".
        gl.domElement.addEventListener("webglcontextrestored", () => invalidate());
      }}
    >
      {/* Dusk on a plaza: a warm key from the front-right, a cool rim from
          behind, and a sky-to-ground hemisphere so the underside is not black. */}
      <hemisphereLight args={["#fff1dc", "#2a2420", 0.7]} />
      <directionalLight position={[3, 5, 4]} intensity={2.4} color="#fff3e0" />
      <directionalLight position={[-4, 3, -3]} intensity={1.3} color="#bcd0ff" />
      {/* The bronze wants something to reflect. Three panels of light,
          rendered into an environment map once — no HDR file fetched. */}
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={2} position={[0, 5, -9]} scale={[10, 10, 1]} color="#fff4e0" />
        <Lightformer intensity={1.2} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer intensity={1} position={[6, 2, 2]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} color="#cfe0ff" />
      </Environment>
      <Figure spin={spin} onReady={onReady} />
    </Canvas>
  );
}
