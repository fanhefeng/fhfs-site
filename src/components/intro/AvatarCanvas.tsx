"use client";

import {
  Component,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Canvas } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";

import { renderOnDemand, useIntroStore } from "@/lib/intro/store";
import AvatarScene, { type Tone } from "./AvatarScene";

/**
 * Everything that costs bytes: three, fiber, drei, and — through
 * `AvatarScene`'s module-scope `useGLTF.preload` — the 680 KB head. It lives
 * behind its own file so `IntroStage` can reach it through `next/dynamic` and
 * this whole graph stays out of the HTML's preload set until the capability
 * probe has said the visitor will actually see it.
 */

type Props = {
  tone: Tone;
  /** False once the stage has scrolled away; freezes the render loop. */
  onScreen: boolean;
  /** Localized label for the loading bar. */
  loadingLabel: string;
  /** The scene cannot be shown — the caller drops back to the résumé. */
  onFailed: () => void;
};

/**
 * How long after the loader queue drains we keep waiting for a mesh before
 * calling the load a failure. `active` flips the moment the manager empties;
 * `ready` only lands a commit or two later, once the scene has walked the
 * model. The gap is milliseconds, so this is deliberately far larger than it
 * needs to be — the timer is only ever reached in an already-broken state.
 */
const MESH_GRACE_MS = 4000;

/**
 * React still has no hook that catches a render error, so this is a class on
 * purpose rather than for want of trying.
 *
 * It matters because `useGLTF` *throws* on a failed fetch and `<Suspense>`
 * only catches promises: without a boundary, one bad response for head.glb
 * takes the entire /intro route down — including the complete résumé sitting
 * in the same DOM, which is exactly the fallback we would have wanted.
 * `<Canvas>` re-throws anything raised inside the three tree from its own DOM
 * component, so catching out here does reach errors raised in there.
 */
class CanvasBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Degrading in silence would hide a genuine bug in the scene behind a
    // perfectly plausible-looking page.
    console.error(
      "[intro] avatar scene failed — falling back to the résumé",
      error
    );
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Loading state, scoped to the stage rather than the viewport — the site's
 * header island floats above this and must stay reachable while the model
 * lands.
 */
function LoadingOverlay({
  label,
  onStalled,
}: {
  label: string;
  onStalled: () => void;
}) {
  const { progress, active } = useProgress();
  const ready = useIntroStore((s) => s.ready);
  const done = ready && !active;
  const pct = Math.min(100, progress);

  // `ready` is written by AvatarScene only once it has found a mesh to sticker,
  // so a GLB that parses but yields no mesh strands this overlay at whatever
  // percentage it reached — nothing threw, so the boundary above never hears
  // about it. Latch on the queue having been busy, then treat "drained, still
  // no mesh" as the failure it is. The latch is what keeps a stale 100% left
  // in drei's page-global progress store (the /about workstation writes to the
  // same one) from firing this before our own load has even started.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (active) setStarted(true);
  }, [active]);
  useEffect(() => {
    if (!started || active || ready) return;
    const timer = setTimeout(onStalled, MESH_GRACE_MS);
    return () => clearTimeout(timer);
  }, [started, active, ready, onStalled]);

  return (
    <div
      aria-hidden={done}
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center bg-bg transition-opacity duration-700 ${
        done ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
        {label}
      </p>
      <div className="mt-5 h-px w-40 overflow-hidden bg-line">
        <div
          className="h-full bg-accent transition-[width] duration-300"
          style={{ width: `${pct.toFixed(0)}%` }}
        />
      </div>
      <p className="mt-4 font-mono text-caption text-fg-tertiary">
        {pct.toFixed(0)}%
      </p>
    </div>
  );
}

export default function AvatarCanvas({
  tone,
  onScreen,
  loadingLabel,
  onFailed,
}: Props) {
  // OrbitControls in edit mode drives the camera from its own pointer events,
  // which is exactly the case an on-demand loop cannot see coming; the panel
  // is a development tool, so it keeps the old always-on loop.
  const editing = useIntroStore((s) => s.editing);

  // Coming back on screen is not necessarily a scroll event — a resize or the
  // observer's own margin can do it — so the loop would otherwise resume on a
  // stale frame and sit there until the next wheel tick.
  useEffect(() => {
    if (onScreen) renderOnDemand.request();
  }, [onScreen]);

  return (
    <CanvasBoundary onError={onFailed}>
      <Canvas
        // "percentage" == PCFShadowMap. A bare `shadows` would ask
        // R3F for PCFSoftShadowMap, which three deprecated in r185
        // and silently downgrades to exactly this — same pixels, one
        // less console warning.
        shadows="percentage"
        dpr={[1, 2]}
        // "demand" rather than "always": nothing in this scene moves on its
        // own, so a frame is only worth drawing when the scroll, the theme or
        // the geometry has actually changed. On an untouched stage "always"
        // redrew the same 2.7 MP image, and its shadow pass, at the display's
        // refresh rate for as long as the stage was on screen — measurably a
        // third of a GPU process, spent on pixels identical to the last ones.
        // Who asks for frames, and how movement that outlives its trigger
        // keeps them coming, is documented on `renderOnDemand`.
        frameloop={!onScreen ? "never" : editing ? "always" : "demand"}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        // Losing the GL context is survivable: three preventDefaults the event
        // and rebuilds its state on `webglcontextrestored`. What it cannot do
        // is ask for the frame that would put the result on screen — under
        // "demand" no scroll or theme change is coming, so a recovered scene
        // would sit on whatever image it had drawn before the loss. The
        // listener dies with the canvas element R3F owns.
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextrestored", () =>
            renderOnDemand.request()
          );
        }}
        camera={{ position: [0, 0.2, 4.4], fov: 32, near: 0.1, far: 100 }}
      >
        <Suspense fallback={null}>
          <AvatarScene tone={tone} />
        </Suspense>
      </Canvas>

      <LoadingOverlay label={loadingLabel} onStalled={onFailed} />
    </CanvasBoundary>
  );
}
