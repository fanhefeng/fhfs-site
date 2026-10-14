import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

type Texture = { image: { width: number; height: number }; dispose: () => void };
const state = vi.hoisted(() => ({
  loads: [] as { success: (texture: Texture) => void; fail: (error: Error) => void }[],
  started: vi.fn(),
  released: vi.fn(),
  uniforms: {} as Record<string, { value: unknown }>,
}));
vi.mock("three", () => {
  class Resource {
    dispose = vi.fn();
  }
  return {
    WebGLRenderer: class {
      setClearColor = vi.fn();
      setPixelRatio = vi.fn();
      setSize = vi.fn();
      render = vi.fn();
    },
    Scene: class {
      add = vi.fn();
    },
    Camera: class {},
    Vector2: class {
      set = vi.fn();
    },
    ShaderMaterial: class extends Resource {
      constructor({ uniforms }: { uniforms: typeof state.uniforms }) {
        super();
        state.uniforms = uniforms;
      }
    },
    PlaneGeometry: Resource,
    Mesh: class {},
    TextureLoader: class {
      setCrossOrigin = vi.fn();
      load(
        _src: string,
        success: (texture: Texture) => void,
        _progress: unknown,
        fail: (error: Error) => void,
      ) {
        state.loads.push({ success, fail });
      }
    },
    LinearFilter: 1,
    ClampToEdgeWrapping: 2,
  };
});
vi.mock("@/lib/client/three/release", () => ({ releaseRenderer: state.released }));
vi.mock("@/lib/client/canvasLoop", () => ({
  mountCanvasLoop: ({ release }: { release: () => void }) => {
    let disposed = false;
    return {
      start: state.started,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        release();
      },
      get disposed() {
        return disposed;
      },
    };
  },
}));

import { mountLens } from "@/components/lab/lensRenderer";

beforeEach(() => {
  vi.clearAllMocks();
  state.loads = [];
});

const texture = (): Texture => ({ image: { width: 1200, height: 800 }, dispose: vi.fn() });
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
function mount() {
  const onLive = vi.fn();
  const onFail = vi.fn();
  const dispose = mountLens({
    canvas: {} as HTMLCanvasElement,
    box: () => null,
    srcs: ["one.jpg", "two.jpg", "three.jpg"],
    progress: { value: 0 },
    dirty: { current: true },
    shown: () => 0,
    onLive,
    onFail,
  })!;
  return { dispose, onLive, onFail };
}

describe("lens texture ownership", () => {
  it("releases successful siblings and later arrivals when one photograph fails", async () => {
    const { dispose, onFail, onLive } = mount();
    const first = texture();
    const late = texture();
    state.loads[0]!.success(first);
    state.loads[1]!.fail(new Error("image unavailable"));
    await settle();
    expect(onFail).toHaveBeenCalledOnce();
    expect(first.dispose).toHaveBeenCalledOnce();
    state.loads[2]!.success(late);
    await settle();
    dispose();
    expect(late.dispose).toHaveBeenCalledOnce();
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(state.released).toHaveBeenCalledOnce();
    expect(state.started).not.toHaveBeenCalled();
    expect(onLive).not.toHaveBeenCalled();
  });

  it("releases textures arriving after unmount without reviving the scene", async () => {
    const { dispose, onFail, onLive } = mount();
    dispose();
    const arrivals = state.loads.map(() => texture());
    state.loads.forEach((load, index) => load.success(arrivals[index]!));
    await settle();
    for (const arrival of arrivals) expect(arrival.dispose).toHaveBeenCalledOnce();
    expect(state.released).toHaveBeenCalledOnce();
    expect(state.started).not.toHaveBeenCalled();
    expect(onLive).not.toHaveBeenCalled();
    expect(onFail).not.toHaveBeenCalled();
  });

  it("binds by slide order even when downloads finish in a different order", async () => {
    const { dispose, onLive } = mount();
    const arrivals = state.loads.map(() => texture());
    for (const index of [2, 0, 1]) state.loads[index]!.success(arrivals[index]!);
    await settle();
    expect(state.started).toHaveBeenCalledOnce();
    const bind = onLive.mock.calls[0]![0] as (from: number, to: number) => void;
    bind(0, 1);
    expect(state.uniforms.uTex1!.value).toBe(arrivals[0]);
    expect(state.uniforms.uTex2!.value).toBe(arrivals[1]);
    dispose();
    dispose();
    for (const arrival of arrivals) expect(arrival.dispose).toHaveBeenCalledOnce();
  });
});
