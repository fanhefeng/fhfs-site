"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { FULL_MIX, mountLiquidMetal, type LiquidMix } from "@/lib/grove/liquidMetalMount";
import { PILL_CSS } from "./pill.css";

type Props = {
  children: ReactNode;
  /** Button height in CSS pixels, as a CSS length. Everything else follows it. */
  height: string;
  className?: string;
  label?: string;
  href?: string;
  /**
   * How much bloom pad to leave around the button, in button heights. The
   * canvas IS the pad, so this has to clear the halo's full reach or it is cut
   * off against a visible rectangle.
   */
  pad?: number;
  /** Live pipeline settings. Mutate through the ref to scrub it. */
  mixRef?: RefObject<LiquidMix>;
  /**
   * The metal's floor brightness with nobody touching it.
   *
   * Zero on a page where the control is one element among many: it rests as
   * dark glass and pours only under the pointer, which is what keeps it from
   * competing with the headline for the eye. The lab study lights it at rest
   * instead, because there the control IS the subject.
   */
  base?: number;
  /** Fired on press, with the pointer's page coordinates. */
  onPress?: (clientX: number, clientY: number) => void;
};

/**
 * The site's primary control: a link or a button over a canvas of liquid
 * metal (`lib/grove/liquidMetalMount` has how the metal is made). The lab's
 * study of the same metal mounts the same pipeline and scrubs its mix.
 */
export function LiquidPill({
  children,
  height,
  className,
  label,
  href,
  pad = 1.744,
  mixRef,
  base,
  onPress,
}: Props) {
  const padRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const btnRef = useRef<HTMLElement>(null);
  const fallbackMix = useRef<LiquidMix>({ ...FULL_MIX, base: base ?? FULL_MIX.base });
  /** Bumped when a lost context comes back, so the effect rebuilds on it. */
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const pad = padRef.current;
    const button = btnRef.current;
    if (!canvas || !pad || !button) return;

    fallbackMix.current.base = base ?? FULL_MIX.base;
    const metal = mountLiquidMetal({
      canvas,
      pad,
      button,
      mix: () => mixRef?.current ?? fallbackMix.current,
      // This is the site's one primary control, and a backgrounded mobile tab
      // is where a context is most often taken away — without the remount the
      // label stays and the metal under it is gone for the rest of the visit.
      onContextRestored: () => setEpoch((n) => n + 1),
      onPress,
    });
    return metal.dispose;
  }, [mixRef, onPress, base, epoch]);

  const style = {
    "--lp-h": height,
    "--lp-pad": `calc(${pad} * var(--lp-h))`,
  } as React.CSSProperties;
  const inner = (
    <>
      <span className="lp-plate" aria-hidden="true" />
      <canvas ref={canvasRef} className="lp-canvas" aria-hidden="true" />
    </>
  );

  return (
    <span ref={padRef} className={`lp-pad${className ? ` ${className}` : ""}`} style={style}>
      {/* The control carries its own geometry — it is no longer the grove's
          guest. React dedupes by href, so several pills on a page cost one
          stylesheet. */}
      <style href="liquid-pill" precedence="medium">
        {PILL_CSS}
      </style>
      {inner}
      {href ? (
        <a
          ref={btnRef as RefObject<HTMLAnchorElement>}
          className="lp-btn"
          href={href}
          aria-label={label}
        >
          {children}
        </a>
      ) : (
        <button
          ref={btnRef as RefObject<HTMLButtonElement>}
          className="lp-btn"
          type="button"
          aria-label={label}
        >
          {children}
        </button>
      )}
    </span>
  );
}
