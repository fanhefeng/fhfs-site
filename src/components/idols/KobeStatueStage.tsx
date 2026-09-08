"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { invalidate } from "@react-three/fiber";
import { gsap, EASE, isFinePointer } from "@/lib/gsap";
import { hasWebGL, prefersSaveData } from "@/lib/three/guards";

/** three, fiber, drei: fetched only once the probe has said the reader will see it. */
const KobeStatue = dynamic(() => import("./KobeStatue"), { ssr: false });

type Props = {
  hint: string;
  loading: string;
  fallbackNote: string;
  fallback: { src: string; width: number; height: number; alt: string };
  turnLeft: string;
  turnRight: string;
};

/** A quarter turn per press of the arrows. */
const STEP = Math.PI / 4;

/**
 * The stage the statue stands on: decides whether there will be a statue
 * at all (no WebGL, or Save-Data, and a photograph stands in), owns the
 * figure's turn — a drag on a fine pointer, the two arrows for everyone,
 * including keyboards and touch, where a drag would fight the page's
 * scroll — and stops the canvas drawing once it has scrolled away.
 */
export function KobeStatueStage({ hint, loading, fallbackNote, fallback, turnLeft, turnRight }: Props) {
  const [mode, setMode] = useState<"probing" | "3d" | "photo">("probing");
  const [ready, setReady] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const spin = useRef(0);
  const drag = useRef<{ x: number; spin: number } | null>(null);
  const tween = useRef<gsap.core.Tween | null>(null);

  // Both guards read the live browser: an effect, never the render.
  useEffect(() => {
    setMode(!hasWebGL() || prefersSaveData() ? "photo" : "3d");
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || mode !== "3d") return;
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin: "200px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mode]);

  const onReady = useCallback(() => setReady(true), []);

  const turn = (delta: number) => {
    tween.current?.kill();
    tween.current = gsap.to(spin, {
      current: spin.current + delta,
      duration: 0.7,
      ease: EASE.default,
      onUpdate: () => invalidate(),
    });
  };

  // A drag turns the figure on a fine pointer only: on touch the same gesture
  // is how the page scrolls, and a canvas that ate it would trap the reader.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (mode !== "3d" || !isFinePointer() || e.button !== 0) return;
    tween.current?.kill();
    drag.current = { x: e.clientX, spin: spin.current };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    spin.current = drag.current.spin + (e.clientX - drag.current.x) * 0.009;
    invalidate();
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="relative">
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`relative aspect-[4/5] overflow-hidden rounded-card bg-surface sm:aspect-[16/10] ${
          mode === "3d" && isFinePointer() ? "cursor-grab active:cursor-grabbing" : ""
        }`}
      >
        {mode === "photo" ? (
          <Image
            src={fallback.src}
            width={fallback.width}
            height={fallback.height}
            alt={fallback.alt}
            sizes="(min-width: 1100px) 1040px, 100vw"
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <>
            {mode === "3d" && (
              <div
                className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
              >
                <KobeStatue spin={spin} onScreen={onScreen} onReady={onReady} />
              </div>
            )}
            {!ready && (
              <p className="absolute inset-0 grid place-items-center font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                {loading}
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {mode === "photo" ? fallbackNote : hint}
        </p>
        {mode === "3d" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => turn(-STEP)}
              aria-label={turnLeft}
              className="grid size-11 place-items-center rounded-full border border-line text-fg-secondary transition-colors hover:border-accent hover:text-accent"
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              onClick={() => turn(STEP)}
              aria-label={turnRight}
              className="grid size-11 place-items-center rounded-full border border-line text-fg-secondary transition-colors hover:border-accent hover:text-accent"
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
