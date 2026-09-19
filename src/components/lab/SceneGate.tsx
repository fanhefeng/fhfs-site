"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { hasWebGL, prefersSaveData } from "@/lib/three/guards";

/** Why a scene was never mounted — the note under the fallback says which. */
export type SceneRefusal = "save-data" | "no-webgl";

type Verdict = "pending" | "go" | SceneRefusal;

/**
 * The question a three.js study has to ask *before* its chunk is fetched.
 *
 * Every demo used to ask it itself, in an effect — which runs after
 * `next/dynamic` has already downloaded the chunk, three.js with it. A reader on
 * Save-Data, the one who asked most plainly not to be sent megabytes of
 * decoration, got the whole library and then a still picture. So the answer
 * is taken here, outside the chunk, and `children` (the dynamic element) is
 * rendered — and therefore fetched — only on a yes. The same shape as
 * `KobeStatueStage` and `GroveApproach`.
 *
 * The demos keep their own try/catch around `new WebGLRenderer`: this probe
 * cannot see a blocklisted GPU or a driver that dies mid-construction.
 */
export function SceneGate({
  hold,
  fallback,
  children,
}: {
  /** What stands in while the answer is not in yet — the same blank the
   *  dynamic import holds open, so the page does not jump twice. */
  hold: ReactNode;
  fallback: (why: SceneRefusal) => ReactNode;
  children: ReactNode;
}) {
  const [verdict, setVerdict] = useState<Verdict>("pending");
  useEffect(() => {
    // Both read the live browser, so they cannot be answered on the server.
    setVerdict(prefersSaveData() ? "save-data" : hasWebGL() ? "go" : "no-webgl");
  }, []);
  if (verdict === "pending") return hold;
  if (verdict === "go") return children;
  return fallback(verdict);
}

/**
 * One screen standing in for a scroll-driven scene that was never built: the
 * scene's own copy over a still of what it would have drawn, and the note
 * saying why. One screen, not the scene's scroll track — with nothing pinned
 * and nothing driven, the extra height would only be blank screens.
 */
export function StageFallback({
  accent,
  image,
  backdrop,
  headline,
  body,
  tail,
  note,
}: {
  accent: string;
  /** A still of the scene; the backdrop colour shows around it while it loads. */
  image?: string;
  backdrop: string;
  headline: string;
  body: string;
  tail: string;
  note: string;
}) {
  return (
    <div
      className="sf-stage"
      style={
        {
          "--sf-accent": accent,
          "--sf-backdrop": backdrop,
          ...(image ? { "--sf-image": `url("${image}")` } : {}),
        } as CSSProperties
      }
    >
      <style href="lab-stage-fallback" precedence="medium">
        {CSS}
      </style>
      <div className="sf-copy">
        <h2 className="sf-headline">{headline}</h2>
        <p className="sf-body">{body}</p>
        <p className="sf-tail">{tail}</p>
        <p className="sf-note">{note}</p>
      </div>
    </div>
  );
}

/**
 * The desk's stand-in: the stage's own footprint, so the notes under it stay
 * where they were, holding the one sentence that says why it is empty.
 */
export function DeskFallback({ note }: { note: string }) {
  return (
    <div className="mx-auto grid h-[360px] w-full max-w-5xl place-items-center px-6 md:h-[460px]">
      <p className="max-w-[36ch] text-center text-caption text-fg-tertiary">{note}</p>
    </div>
  );
}

const CSS = `
.sf-stage {
  position: relative;
  height: 100svh;
  overflow: hidden;
  border-block: 1px solid var(--line);
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0) 35%, rgba(0, 0, 0, 0.55) 100%),
    var(--sf-image, none) center / cover no-repeat,
    var(--sf-backdrop);
}
.sf-copy {
  position: absolute;
  inset: auto 0 12vh;
  margin-inline: auto;
  max-width: min(34ch, 82vw);
  text-align: center;
  color: #f2efe4;
  text-shadow: 0 2px 28px rgba(0, 0, 0, 0.55);
}
.sf-headline {
  margin: 0;
  font-size: clamp(1.7rem, 5vw, 3rem);
  font-weight: 600;
  letter-spacing: -0.02em;
}
.sf-body {
  margin: 0.9rem 0 0;
  font-size: 0.9375rem;
  line-height: 1.7;
  opacity: 0.82;
}
.sf-tail {
  margin: 1.1rem 0 0;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--sf-accent);
  text-shadow: none;
}
.sf-note {
  margin: 1rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.6;
  opacity: 0.72;
}
`;
