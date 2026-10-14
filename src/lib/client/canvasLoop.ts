import "client-only";
import { gsap } from "./gsap";

export type CanvasLoop = {
  /** Start after the effect's textures are ready. Repeated starts are harmless. */
  start: () => void;
  dispose: () => void;
  readonly disposed: boolean;
};

/**
 * The browser lifetime shared by the imperative canvas studies. Effects own
 * their shaders and dirty-frame drawing; this owns sizing, GSAP's clock,
 * visibility/context pauses and one release. No three.js import here.
 */
export function mountCanvasLoop({
  canvas,
  box,
  dirty,
  resize,
  frame,
  release,
}: {
  canvas: HTMLCanvasElement;
  box: () => HTMLElement | null;
  dirty: { current: boolean };
  resize: (width: number, height: number, dpr: number) => void;
  frame: (time: number, delta: number) => void;
  release: () => void;
}): CanvasLoop {
  let disposed = false;
  let started = false;
  let ticking = false;
  let onScreen = true;
  let lost = false;

  const tick = (time: number, delta: number) => {
    if (!disposed && started && onScreen && !document.hidden && !lost) frame(time, delta);
  };
  const sync = () => {
    const run = !disposed && started && onScreen && !document.hidden && !lost;
    if (run === ticking) return;
    ticking = run;
    if (run) {
      dirty.current = true;
      gsap.ticker.add(tick);
      tick(0, 0);
    } else {
      gsap.ticker.remove(tick);
    }
  };
  const measure = () => {
    if (disposed) return;
    const element = box();
    const width = element?.clientWidth || window.innerWidth;
    const height = element?.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, width * height > 2_600_000 ? 1.5 : 2);
    resize(width, height, dpr);
    dirty.current = true;
  };
  measure();

  // Observe the sticky box: browser chrome can resize the window without
  // resizing a 100svh stage. ScrollTrigger alone owns pin measurements.
  const element = box();
  const sizeObserver = element ? new ResizeObserver(measure) : null;
  if (element) sizeObserver!.observe(element);
  else window.addEventListener("resize", measure, { passive: true });

  const visibilityObserver = new IntersectionObserver(([entry]) => {
    if (disposed) return;
    onScreen = entry?.isIntersecting ?? true;
    sync();
  });
  visibilityObserver.observe(element ?? canvas);
  const onVisibility = () => sync();
  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    sync();
  };
  const onRestored = () => {
    lost = false;
    dirty.current = true;
    sync();
  };
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  return {
    start: () => {
      if (disposed) return;
      started = true;
      sync();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      sync();
      sizeObserver?.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      release();
    },
    get disposed() {
      return disposed;
    },
  };
}
