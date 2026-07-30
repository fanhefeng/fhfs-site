"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

/** Fixed recycling pool — never more DOM than this, however fast the hand. */
const POOL = 12;
/** Cursor must travel this many px before the next note pops out. */
const SPAWN_DIST = 110;

const CHARS = ["♪", "♫", "♩", "♬"] as const;
/* Neon rotation, same gold / blue / red cycle as the rest of the club. */
const TONES = [
  { color: "var(--gold)", glow: "var(--glow-gold)" },
  { color: "var(--neon-blue)", glow: "var(--glow-blue)" },
  { color: "var(--neon-red)", glow: "var(--glow-red)" },
] as const;

type Props = { className?: string };

/**
 * Hero cursor trail (after the GSAP demo WbbEGmp): as the cursor sweeps
 * across the hero, little glowing notes pop out along the path — elastic
 * pop, a lazy spin, then a back.in fall out of the stage, like sparks off
 * a needle on vinyl.
 *
 * Mount it inside a `position: relative` hero section; it renders one
 * absolutely-positioned, pointer-events-none layer. Desktop fine-pointer
 * only; fully inert under reduced motion; the ticker is IntersectionObserver
 * gated so an off-screen hero costs nothing.
 */
export function NoteTrail({ className }: Props) {
  const layerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const layer = layerRef.current;
      if (!layer) return;
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const host = layer.parentElement;
      if (!host) return;

      const pool = Array.from(layer.children) as HTMLSpanElement[];
      if (pool.length === 0) return;

      /* Geometry cache — refreshed on resize and IO entry only. The layer's
       * document-space top is stored so the frame loop can convert client
       * coords with just window.scrollY (no per-frame rect reads). */
      let left = 0;
      let topDoc = 0;
      let height = 0;
      const measure = () => {
        const r = layer.getBoundingClientRect();
        left = r.left;
        topDoc = r.top + window.scrollY;
        height = r.height;
      };

      /* Pointer state, written by the (cheap) move handler and consumed by
       * the ticker. `lastX < 0` marks "no previous sample yet". */
      let cx = 0;
      let cy = 0;
      let fresh = false;
      let lastX = -1;
      let lastY = -1;
      let acc = 0;
      const onMove = (e: PointerEvent) => {
        cx = e.clientX;
        cy = e.clientY;
        fresh = true;
      };
      const onLeave = () => {
        lastX = -1;
        acc = 0;
      };

      let slot = 0;
      let spawned = 0;
      const spawn = (x: number, y: number) => {
        const el = pool[slot];
        slot = (slot + 1) % pool.length;
        const tone = TONES[spawned % TONES.length];
        const char = CHARS[spawned % CHARS.length];
        spawned += 1;

        // Recycle: stop whatever this span was doing and reset it fully.
        gsap.killTweensOf(el);
        gsap.set(el, { clearProps: "all" });
        el.textContent = char;
        el.style.color = tone.color;
        el.style.textShadow = tone.glow;
        gsap.set(el, {
          x,
          y,
          xPercent: -50,
          yPercent: -50,
          scale: 0,
          rotation: 0,
          opacity: 1,
        });
        gsap
          .timeline()
          // Pop: elastic burst to a slightly random size…
          .to(el, {
            scale: gsap.utils.random(0.7, 1.25),
            duration: 0.6,
            ease: "elastic.out(1, 0.3)",
          })
          // …spinning lazily the whole time…
          .to(el, { rotation: gsap.utils.random(-360, 360), duration: 1.2, ease: "power1.out" }, 0)
          // …then it loses its lift and drops out of the stage.
          .to(el, { y: height + 80, duration: 0.9, ease: "back.in(1.2)" }, 0.35)
          .to(el, { opacity: 0, duration: 0.18, ease: "power1.in" }, "-=0.18");
      };

      /* Per frame: accumulate cursor travel, pop a note every SPAWN_DIST px.
       * Pure arithmetic on cached values — no layout reads in here. */
      const tick = () => {
        if (!fresh) return;
        fresh = false;
        if (lastX < 0) {
          lastX = cx;
          lastY = cy;
          return;
        }
        acc += Math.hypot(cx - lastX, cy - lastY);
        lastX = cx;
        lastY = cy;
        if (acc >= SPAWN_DIST) {
          acc = 0;
          spawn(cx - left, cy - (topDoc - window.scrollY));
        }
      };

      // Off-screen hero costs nothing: ticker joins/leaves with visibility.
      let running = false;
      const io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true;
          measure();
          gsap.ticker.add(tick);
        } else if (!entry.isIntersecting && running) {
          running = false;
          gsap.ticker.remove(tick);
          lastX = -1;
          acc = 0;
        }
      });
      io.observe(host);

      const onResize = () => measure();
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerleave", onLeave);
      window.addEventListener("resize", onResize);

      return () => {
        io.disconnect();
        if (running) gsap.ticker.remove(tick);
        host.removeEventListener("pointermove", onMove);
        host.removeEventListener("pointerleave", onLeave);
        window.removeEventListener("resize", onResize);
        gsap.killTweensOf(pool);
      };
    },
    { scope: layerRef }
  );

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
    >
      {Array.from({ length: POOL }, (_, i) => (
        <span
          key={i}
          className="absolute left-0 top-0 select-none text-2xl opacity-0 will-change-transform"
        />
      ))}
    </div>
  );
}
