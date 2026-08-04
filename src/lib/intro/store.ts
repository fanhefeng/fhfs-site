import { create } from "zustand";
import { INTRO_STICKERS, type IntroSticker } from "@/lib/intro/stickers";

/**
 * Scroll progress deliberately bypasses React state — it changes every frame,
 * and putting it in state re-renders the whole tree into a slideshow.
 * ScrollTrigger writes here, useFrame reads. The zustand store below holds
 * only the low-frequency things.
 */
export const scrollState = { progress: 0 };

/**
 * The scene renders on demand, not on a loop: with `frameloop="demand"` a
 * still camera costs nothing, where `"always"` kept redrawing an identical
 * 2.7 MP frame — plus its shadow pass — at 120 Hz for as long as the stage was
 * on screen.
 *
 * On demand means someone has to say when. Anything outside the R3F tree that
 * changes what the camera would see calls this; `AvatarScene` installs the
 * real implementation (R3F's `invalidate`) on mount and takes it away again on
 * unmount, so the no-op default is what runs before the canvas exists and
 * after it is gone.
 *
 * Movement that continues after the triggering event — the scroll damping, the
 * light rig easing between themes — cannot be covered by a single call. Those
 * live in `useFrame` and re-arm themselves each frame until they settle; see
 * `CameraRig` and `Atmosphere`.
 */
export const renderOnDemand = { request: (() => {}) as () => void };

/** Temporary per-sticker tweaks made in edit mode (`?edit=1`). */
export type StickerOverride = Partial<{
  theta: number;
  phi: number;
  size: number;
  rotation: number;
  distance: number;
}>;

type State = {
  /** -1 = the opening frame, 0..n-1 = the stickers, n = the closing frame. */
  activeIndex: number;
  setActiveIndex: (i: number) => void;

  ready: boolean;
  setReady: (v: boolean) => void;

  editing: boolean;
  setEditing: (v: boolean) => void;
  selectedId: string;
  setSelectedId: (id: string) => void;
  overrides: Record<string, StickerOverride>;
  patchOverride: (id: string, patch: StickerOverride) => void;
  resetOverrides: () => void;

  /**
   * The direction angle picked by clicking the model. Clicking does not write
   * `overrides` directly — the editor panel consumes this and writes them, so
   * the data flow stays one-way. Otherwise "panel edits store" and "click
   * edits store" retrigger each other. `seq` distinguishes two clicks that
   * land on the same spot.
   */
  pick: { theta: number; phi: number; seq: number } | null;
  setPick: (theta: number, phi: number) => void;
};

export const useIntroStore = create<State>((set) => ({
  activeIndex: -1,
  setActiveIndex: (i) =>
    set((s) => (s.activeIndex === i ? s : { activeIndex: i })),

  ready: false,
  setReady: (v) => set({ ready: v }),

  editing: false,
  setEditing: (v) => set({ editing: v }),
  selectedId: INTRO_STICKERS[0]?.id ?? "",
  setSelectedId: (id) => set({ selectedId: id }),
  overrides: {},
  patchOverride: (id, patch) =>
    set((s) => ({
      overrides: { ...s.overrides, [id]: { ...s.overrides[id], ...patch } },
    })),
  resetOverrides: () => set({ overrides: {} }),

  pick: null,
  setPick: (theta, phi) =>
    set((s) => ({ pick: { theta, phi, seq: (s.pick?.seq ?? 0) + 1 } })),
}));

/** Merge a configured sticker with whatever the editor is overriding. */
export function resolveSticker(
  sticker: IntroSticker,
  overrides: Record<string, StickerOverride>
): IntroSticker {
  const o = overrides[sticker.id];
  if (!o) return sticker;
  return {
    ...sticker,
    dir: {
      theta: o.theta ?? sticker.dir.theta,
      phi: o.phi ?? sticker.dir.phi,
    },
    size: o.size ?? sticker.size,
    rotation: o.rotation ?? sticker.rotation,
    distance: o.distance ?? sticker.distance,
  };
}
