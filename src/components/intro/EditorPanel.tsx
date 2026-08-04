"use client";

import { useEffect } from "react";
import { Leva, useControls, button } from "leva";

import { INTRO_STICKERS } from "@/lib/intro/stickers";
import { useIntroStore, resolveSticker } from "@/lib/intro/store";

/**
 * DEVELOPMENT INSTRUMENT. This is a workbench for whoever maintains the head
 * model, not a feature: the UI is Chinese-only, undocumented, and its whole
 * output is numbers you paste into a source file by hand. No visitor should
 * ever reach it.
 *
 * Placing a decal by arithmetic is hopeless, so the loop is: click the face →
 * get a direction angle → nudge with the sliders → "export JSON" → paste the
 * numbers back into `src/lib/intro/stickers.ts`. Every angle in that file was
 * produced this way.
 *
 * None of this reaches a production build, and `next/dynamic` is not what
 * stops it: a dynamic import still emits the chunk and still serves it to
 * anyone who guesses `?edit=1`. What removes it is the pair of gates outside
 * this file — the `process.env.NODE_ENV === "production" ? null : dynamic(…)`
 * ternary at the import site in IntroStage, which Next folds away at build
 * time so the `import()` becomes unreachable, and leva sitting in
 * devDependencies. Verified: `leva` appears in no chunk under
 * `.next/static/chunks`.
 *
 * Both are load-bearing and neither is visible from here, so if either moves,
 * this file starts shipping ~200 KB of Chinese-only editor to every visitor
 * who guesses a query string.
 */
export default function EditorPanel() {
  const selectedId = useIntroStore((s) => s.selectedId);
  const setSelectedId = useIntroStore((s) => s.setSelectedId);
  const patch = useIntroStore((s) => s.patchOverride);
  const reset = useIntroStore((s) => s.resetOverrides);
  const pick = useIntroStore((s) => s.pick);

  // leva rebuilds the schema only when the deps below change, so the factory
  // is also the only moment the sliders need a starting value — hence the
  // one-shot `getState()` read rather than a subscription. Subscribing to
  // `overrides` would re-render this component on every frame of every drag
  // (the sliders write the store continuously) and change nothing: leva owns
  // the slider values from here on and ignores a new `base` until `selectedId`
  // moves. Keeping the read inside the factory is what keeps the component
  // body itself pure.
  const [, set] = useControls(
    () => {
      const sticker =
        INTRO_STICKERS.find((n) => n.id === selectedId) ?? INTRO_STICKERS[0];
      const base = resolveSticker(sticker, useIntroStore.getState().overrides);

      return {
        贴纸: {
          value: selectedId,
          options: Object.fromEntries(
            INTRO_STICKERS.map((n) => [`${n.icon} ${n.label}`, n.id])
          ),
          onChange: (v: string) => setSelectedId(v),
        },
        theta: {
          label: "水平角",
          value: base.dir.theta,
          min: -180,
          max: 180,
          step: 0.5,
          onChange: (v: number) => patch(selectedId, { theta: v }),
        },
        phi: {
          label: "垂直角",
          value: base.dir.phi,
          min: -89,
          max: 89,
          step: 0.5,
          onChange: (v: number) => patch(selectedId, { phi: v }),
        },
        size: {
          label: "尺寸",
          value: base.size,
          min: 0.05,
          max: 0.8,
          step: 0.005,
          onChange: (v: number) => patch(selectedId, { size: v }),
        },
        rotation: {
          label: "自转",
          value: base.rotation,
          min: -180,
          max: 180,
          step: 1,
          onChange: (v: number) => patch(selectedId, { rotation: v }),
        },
        distance: {
          label: "机位距离",
          value: base.distance,
          min: 0.4,
          max: 3,
          step: 0.01,
          onChange: (v: number) => patch(selectedId, { distance: v }),
        },
        "导出 JSON（同时复制到剪贴板）": button(() => {
          const overrides = useIntroStore.getState().overrides;
          const payload = INTRO_STICKERS.map((n) => {
            const r = resolveSticker(n, overrides);
            return {
              id: r.id,
              dir: {
                theta: +r.dir.theta.toFixed(1),
                phi: +r.dir.phi.toFixed(1),
              },
              size: +r.size.toFixed(3),
              rotation: +r.rotation.toFixed(1),
              distance: +r.distance.toFixed(2),
            };
          });
          const text = JSON.stringify(payload, null, 2);
          // The console IS the export here: the clipboard write below is
          // best-effort (it needs a secure context and can be denied), so this
          // is the copy of the numbers that always survives.
          // oxlint-disable-next-line no-console
          console.log(
            "[intro] paste these back into src/lib/intro/stickers.ts:\n" + text
          );
          navigator.clipboard?.writeText(text).catch(() => {});
        }),
        重置: button(() => reset()),
      };
    },
    [selectedId]
  );

  // Feed the angle picked on the model back into the panel; `set` fires the
  // onChange handlers above, which are what write the store.
  useEffect(() => {
    if (!pick) return;
    set({ theta: pick.theta, phi: pick.phi });
  }, [pick, set]);

  return (
    <>
      <Leva titleBar={{ title: "贴纸编辑器" }} collapsed={false} />
      {/* Lifted clear of Next's dev indicator in the corner. */}
      <div className="pointer-events-none fixed bottom-20 left-4 z-[90] max-w-xs rounded-card bg-fg/85 px-4 py-3 text-caption leading-relaxed text-bg backdrop-blur">
        编辑模式：拖拽旋转视角，<b>在脸上点击</b>
        可把当前选中的贴纸移到该处。调完点「导出 JSON」，把数值粘回{" "}
        <code>src/lib/intro/stickers.ts</code>。
      </div>
    </>
  );
}
