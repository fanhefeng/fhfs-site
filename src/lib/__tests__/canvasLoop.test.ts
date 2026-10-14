import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const clock = vi.hoisted(() => ({
  callbacks: new Set<(time: number, delta: number) => void>(),
}));
vi.mock("client-only", () => ({}));
vi.mock("@/lib/client/gsap", () => ({
  gsap: {
    ticker: {
      add: (callback: (time: number, delta: number) => void) => clock.callbacks.add(callback),
      remove: (callback: (time: number, delta: number) => void) => clock.callbacks.delete(callback),
    },
  },
}));

import { mountCanvasLoop, type CanvasLoop } from "@/lib/client/canvasLoop";

let view: EventTarget & { innerWidth: number; innerHeight: number; devicePixelRatio: number };
let page: EventTarget & { hidden: boolean };
let resizeNotify: () => void;
let intersectionNotify: (visible?: boolean) => void;
let loops: CanvasLoop[];
const disconnectSize = vi.fn();
const disconnectVisibility = vi.fn();
const observeSize = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  clock.callbacks.clear();
  loops = [];
  view = Object.assign(new EventTarget(), {
    innerWidth: 1200,
    innerHeight: 800,
    devicePixelRatio: 3,
  });
  page = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal("window", view);
  vi.stubGlobal("document", page);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resizeNotify = callback;
      }
      observe = observeSize;
      disconnect = disconnectSize;
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        intersectionNotify = (visible) =>
          callback(visible === undefined ? [] : [{ isIntersecting: visible }]);
      }
      observe = vi.fn();
      disconnect = disconnectVisibility;
    },
  );
});

afterEach(() => {
  for (const loop of loops) loop.dispose();
  vi.unstubAllGlobals();
});

function mount(box: HTMLElement | null = { clientWidth: 1000, clientHeight: 600 } as HTMLElement) {
  const canvas = new EventTarget() as HTMLCanvasElement;
  const dirty = { current: false };
  const resize = vi.fn();
  const frame = vi.fn(() => {
    dirty.current = false;
  });
  const release = vi.fn();
  const loop = mountCanvasLoop({ canvas, box: () => box, dirty, resize, frame, release });
  loops.push(loop);
  return { canvas, dirty, resize, frame, release, loop };
}

describe("canvas lifetime", () => {
  it("measures the box with a bounded DPR and waits for ready textures before drawing", () => {
    const { loop, resize, dirty, frame } = mount();
    expect(resize).toHaveBeenLastCalledWith(1000, 600, 2);
    expect(observeSize).toHaveBeenCalledOnce();
    expect(dirty.current).toBe(true);
    expect(clock.callbacks.size).toBe(0);
    loop.start();
    loop.start();
    expect(clock.callbacks.size).toBe(1);
    expect(frame).toHaveBeenCalledExactlyOnceWith(0, 0);
    resizeNotify();
    expect(resize).toHaveBeenCalledTimes(2);
    expect(dirty.current).toBe(true);
  });

  it("limits large canvases to 1.5 DPR without raising a device's lower DPR", () => {
    const large = mount({ clientWidth: 2000, clientHeight: 1500 } as HTMLElement);
    expect(large.resize).toHaveBeenLastCalledWith(2000, 1500, 1.5);
    view.devicePixelRatio = 1;
    resizeNotify();
    expect(large.resize).toHaveBeenLastCalledWith(2000, 1500, 1);
  });

  it("uses window measurements only without a box, and removes the fallback listener", () => {
    view.devicePixelRatio = 0;
    const { loop, resize } = mount(null);
    expect(observeSize).not.toHaveBeenCalled();
    expect(resize).toHaveBeenLastCalledWith(1200, 800, 1);
    view.innerWidth = 900;
    view.dispatchEvent(new Event("resize"));
    expect(resize).toHaveBeenLastCalledWith(900, 800, 1);
    loop.dispose();
    view.dispatchEvent(new Event("resize"));
    expect(resize).toHaveBeenCalledTimes(2);
  });

  it("does not draw when mounted hidden and redraws immediately on returning", () => {
    page.hidden = true;
    const { loop, frame, dirty } = mount();
    loop.start();
    expect(clock.callbacks.size).toBe(0);
    expect(frame).not.toHaveBeenCalled();
    page.hidden = false;
    page.dispatchEvent(new Event("visibilitychange"));
    expect(frame).toHaveBeenCalledOnce();
    expect(dirty.current).toBe(false);
    page.hidden = true;
    page.dispatchEvent(new Event("visibilitychange"));
    expect(clock.callbacks.size).toBe(0);
    page.hidden = false;
    page.dispatchEvent(new Event("visibilitychange"));
    expect(frame).toHaveBeenCalledTimes(2);
  });

  it("leaves the clock off screen and renders the current state when revealed", () => {
    const { loop, frame } = mount();
    intersectionNotify(false);
    loop.start();
    expect(clock.callbacks.size).toBe(0);
    intersectionNotify(true);
    expect(frame).toHaveBeenCalledOnce();
    intersectionNotify(false);
    expect(clock.callbacks.size).toBe(0);
    intersectionNotify();
    expect(frame).toHaveBeenCalledTimes(2);
  });

  it("pauses on context loss and resumes only when also visible", () => {
    const { loop, canvas, frame, dirty } = mount();
    loop.start();
    const lost = new Event("webglcontextlost", { cancelable: true });
    canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(clock.callbacks.size).toBe(0);
    page.hidden = true;
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(frame).toHaveBeenCalledOnce();
    expect(dirty.current).toBe(true);
    page.hidden = false;
    page.dispatchEvent(new Event("visibilitychange"));
    expect(frame).toHaveBeenCalledTimes(2);
  });

  it("forwards clock deltas and ignores late events after releasing exactly once", () => {
    const { loop, frame, resize, canvas, release } = mount();
    loop.start();
    const tick = [...clock.callbacks][0]!;
    tick(2, 16);
    expect(frame).toHaveBeenLastCalledWith(2, 16);
    loop.dispose();
    loop.dispose();
    loop.start();
    tick(3, 32);
    resizeNotify();
    intersectionNotify(true);
    page.dispatchEvent(new Event("visibilitychange"));
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(loop.disposed).toBe(true);
    expect(release).toHaveBeenCalledOnce();
    expect(disconnectSize).toHaveBeenCalledOnce();
    expect(disconnectVisibility).toHaveBeenCalledOnce();
    expect(frame).toHaveBeenCalledTimes(2);
    expect(resize).toHaveBeenCalledOnce();
    expect(clock.callbacks.size).toBe(0);
  });
});
