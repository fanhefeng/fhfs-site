"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";

type Props = {
  className: string;
  label: string;
  title: string;
  href: string;
  src: string;
  alt: string;
  /** Reading order: the Field Note reads label → title → plate, the other way up. */
  plateFirst?: boolean;
  /** How long after the entrance starts this plate resolves, in ms. */
  delay: number;
  linkLabel: string;
  style?: React.CSSProperties;
  /** Rendered outside the card, so it can sit in front of the moss. */
  knob?: boolean;
  /** The plate above the fold, so it is fetched with the document. */
  preload?: boolean;
};

const CUT_STEPS = 12;
const CUT_MS = 1450;

const Sprout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21v-7" />
    <path d="M12 14c0-3.3 2.4-6 5.5-6 .3 3.6-2.2 6.4-5.5 6Z" />
    <path d="M12 16c-.1-2.9-2.2-5.2-4.9-5.2C6.8 13.7 9 16 12 16Z" />
  </svg>
);

/**
 * A card whose photograph resolves like a low-bandwidth transmission.
 *
 * A stepped clip exposes the plate while sampled pixel-dots gather along the
 * advancing edge. The dot front, the white scan and the CSS clip all have to
 * sit on the same line, which means reproducing the CSS progression exactly
 * rather than approximating it — floor(t * STEPS) / STEPS, linear. An eased
 * curve here puts the dots a third of a plate ahead of the edge they are
 * supposed to be gathering on.
 */
export function PortalCard({ className, label, title, href, src, alt, plateFirst, delay, linkLabel, style, knob, preload }: Props) {
  const figRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const fig = figRef.current;
    if (!fig) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const img = fig.querySelector("img");
    const canvas = fig.querySelector<HTMLCanvasElement>(".gh-pixel");
    const media = fig.querySelector<HTMLElement>(".gh-media");
    if (!img || !canvas || !media) return;

    let raf = 0;
    let timer = 0;

    const launch = () => {
      timer = window.setTimeout(() => {
        const box = canvas.getBoundingClientRect();
        if (!box.width || !box.height) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.round(box.width * dpr));
        canvas.height = Math.max(1, Math.round(box.height * dpr));
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const cols = 52;
        const rows = Math.max(18, Math.round((cols * box.height) / box.width));

        const sample = document.createElement("canvas");
        sample.width = cols;
        sample.height = rows;
        const sg = sample.getContext("2d", { willReadFrequently: true });
        let rgba: Uint8ClampedArray | null = null;
        try {
          sg?.drawImage(img, 0, 0, cols, rows);
          rgba = sg?.getImageData(0, 0, cols, rows).data ?? null;
        } catch {
          // A tainted canvas still reveals — it just uses the page's own pale
          // transmission colour instead of the photograph's.
        }

        // layout offsets, not bounding rects: .gh-media carries a live
        // transform and its rect would drift with the pointer
        const over = -media.offsetLeft;
        const span = media.offsetWidth;
        const reach = box.width;

        canvas.style.opacity = "1";
        const startedAt = performance.now();

        const paint = (now: number) => {
          const t = Math.min(1, (now - startedAt) / CUT_MS);
          const stepped = Math.floor(t * CUT_STEPS) / CUT_STEPS;
          const front = (stepped * span - over) / reach;
          const tailFade = t < 0.88 ? 1 : (1 - t) / 0.12;
          ctx.clearRect(0, 0, box.width, box.height);

          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
              const delta = (x + 0.5) / cols - front;
              // symmetric about the front: an asymmetric band puts the
              // pattern's centre of mass ahead of the edge it belongs to
              if (delta < -0.16 || delta > 0.16) continue;
              const band = 1 - Math.abs(delta) / 0.16;
              const pulse = 0.68 + 0.32 * Math.sin(x * 2.71 + y * 1.93 + t * 26);
              const alpha = Math.max(0, band * pulse * tailFade);
              if (alpha < 0.08) continue;

              let r = 220, g = 238, b = 202;
              if (rgba) {
                const q = (y * cols + x) * 4;
                r = Math.min(255, rgba[q] * 1.18 + 20);
                g = Math.min(255, rgba[q + 1] * 1.18 + 24);
                b = Math.min(255, rgba[q + 2] * 1.12 + 14);
              }

              const jitter = (1 - band) * 5;
              const px = ((x + 0.5) * box.width) / cols + Math.sin(y * 3.17 + x) * jitter;
              const py = ((y + 0.5) * box.height) / rows + Math.cos(x * 2.41 - y) * jitter;
              const radius = (0.55 + band * 1.25) * Math.max(0.75, reach / 300);

              ctx.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha * 0.92})`;
              ctx.beginPath();
              ctx.arc(px, py, radius, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          if (t < 1) raf = requestAnimationFrame(paint);
          else {
            ctx.clearRect(0, 0, box.width, box.height);
            canvas.style.opacity = "0";
          }
        };
        raf = requestAnimationFrame(paint);
      }, delay);
    };

    if (img.complete && img.naturalWidth) launch();
    else img.addEventListener("load", launch, { once: true });

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      img.removeEventListener("load", launch);
    };
  }, [delay]);

  const plate = (
    <figure ref={figRef} className="gh-portal">
      <span className="gh-media">
        <Image src={src} alt={alt} fill sizes="34vw" preload={preload} />
      </span>
      <canvas className="gh-pixel" aria-hidden="true" />
    </figure>
  );

  return (
    <article className={`gh-card ${className} mask`} style={style}>
      {plateFirst && plate}
      <p className="gh-card-label">{label}</p>
      <h2 className="gh-card-title">{title}</h2>
      {!plateFirst && plate}
      {!knob && (
        <Link className="gh-knob" href={href} aria-label={linkLabel}>
          <Sprout />
        </Link>
      )}
    </article>
  );
}

/**
 * The card's knob, rendered outside it.
 *
 * The card body has to paint UNDER the moss canvas so the root drapes over its
 * shoulder, which means the card cannot carry a z-index of its own. Anything
 * that must sit in front of the moss therefore lives out here instead, sharing
 * the card's parallax origin so it stays glued to the corner it belongs to.
 */
export function FloatingKnob({ href, label, style }: { href: string; label: string; style?: React.CSSProperties }) {
  return (
    <span className="gh-knob-float" style={style}>
      <Link className="gh-knob gh-knob--float mask-circle" href={href} aria-label={label}>
        <Sprout />
      </Link>
    </span>
  );
}
