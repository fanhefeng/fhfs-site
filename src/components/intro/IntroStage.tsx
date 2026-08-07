"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useGSAP, ScrollTrigger } from "@/lib/gsap";

import {
  INTRO_STICKERS,
  type IntroCopy,
  type IntroLink,
  type IntroText,
} from "@/lib/intro/stickers";
import { renderOnDemand, scrollState, useIntroStore } from "@/lib/intro/store";
import { hasWebGL, prefersSaveData } from "@/lib/three/guards";
import { readTheme } from "@/lib/theme";
// Type-only, and therefore erased before bundling — importing the value would
// drag the entire 3D graph back into this chunk and undo the split below.
import type { Tone } from "./AvatarScene";
import { Narrative } from "./Narrative";
import { IntroResume } from "./IntroResume";

// The sticker rig, and with it leva and a Chinese-only development UI.
//
// The ternary is the gate, not a style: Next inlines `process.env.NODE_ENV` at
// build time, so in a production build this folds to `null` and the `import()`
// below becomes unreachable — which is what actually keeps leva out of the
// output. A `dynamic()` behind a runtime `if` would still emit the chunk and
// still serve it to anyone who guessed the query string.
const EditorPanel =
  process.env.NODE_ENV === "production"
    ? null
    : dynamic(() => import("./EditorPanel"), { ssr: false });

// three, fiber, drei and the head, behind a chunk that is only fetched
// once the probe below says this visitor will actually see them. Statically
// imported, they were preloaded straight from the route's HTML — i.e. before
// the probe had run — so Save-Data and no-WebGL visitors paid for a scene they
// are deliberately never shown.
const AvatarCanvas = dynamic(() => import("./AvatarCanvas"), { ssr: false });

type Props = {
  text: IntroText;
  copy: IntroCopy[];
  links: IntroLink[];
  /** Localized label for the loading bar. */
  loadingLabel: string;
};

/** Which half of the site's palette we are in. LightSwitch writes
 *  `data-theme` on <html>; the 3D rig reads it from here. */
function useThemeTone() {
  const [tone, setTone] = useState<Tone>("light");
  useEffect(() => {
    const read = () => setTone(readTheme());
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => mo.disconnect();
  }, []);
  return tone;
}

/**
 * The scroll-driven avatar.
 *
 * Unlike the standalone prototype this came from, the stage is a `sticky`
 * child of a tall track rather than a `fixed` overlay: that keeps it inside
 * the document, so the site's footer follows it naturally and the header
 * island keeps floating over it. The track is one viewport per stop — an
 * opening frame, each sticker, a closing frame — and ScrollTrigger turns
 * that into a 0..1 progress that AvatarScene reads every frame.
 *
 * Progress is written to a plain module object, never React state: it changes
 * every frame and would otherwise re-render the tree into a slideshow.
 *
 * No GSAP plugin is registered here — `@/lib/gsap` is the site's single
 * registration point, and it has already wired ScrollTrigger to Lenis.
 */
export function IntroStage({ text, copy, links, loadingLabel }: Props) {
  const [mode, setMode] = useState<"probing" | "webgl" | "fallback">("probing");
  /** Pause rendering once the stage has scrolled away (the footer sits below
   *  the track, and an off-screen canvas has no business burning frames). */
  const [onScreen, setOnScreen] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const setEditing = useIntroStore((s) => s.setEditing);
  const editing = useIntroStore((s) => s.editing);
  const tone = useThemeTone();

  useEffect(() => {
    // Presence, not value: the docs say `?edit=1` because that is the form
    // worth remembering, but a bare `?edit` opening the rig is the friendlier
    // behaviour and nothing downstream reads the value.
    //
    // Gated on the build as well, and not only because the panel is dead
    // weight in production: editing skips every guard below, so on the live
    // site the query string alone would hand a Save-Data visitor the full
    // 3D scene.
    const wantsEditor =
      EditorPanel !== null &&
      new URLSearchParams(window.location.search).has("edit");
    setEditing(wantsEditor);

    // The rig exists to reposition stickers on the model, so it outranks every
    // guard below — there is nothing to edit without a canvas.
    if (wantsEditor) {
      setMode("webgl");
      return;
    }

    // Save-Data is not a hint about connection speed here: the model plus
    // the whole 3D runtime is precisely the spend that setting exists to
    // refuse, and the résumé says the same things in text.
    //
    // prefers-reduced-motion is deliberately absent — see the note in
    // lib/three/guards.ts. The face is the page; gating it on a signal most
    // Windows visitors trip while chasing speed cost far more people the
    // whole point of /intro than it ever protected.
    setMode(prefersSaveData() || !hasWebGL() ? "fallback" : "webgl");
  }, [setEditing]);

  // A model that never arrives lands on the same visible résumé Save-Data
  // visitors get, rather than taking the route down with it.
  const handleCanvasFailure = useCallback(() => setMode("fallback"), []);

  useGSAP(
    () => {
      if (mode !== "webgl" || editing || !trackRef.current) return;
      const trigger = ScrollTrigger.create({
        trigger: trackRef.current,
        start: "top top",
        // Progress finishes one viewport before the track does. Without that
        // slack the closing frame lands exactly as the footer starts pushing
        // the stage off screen, so it never holds still — you scroll to the
        // bottom and stop on a half-shoved-up portrait. The spare viewport is
        // the closing frame's own screen; the footer arrives after it.
        //
        // Written as a travel distance, not a `bottom bottom-=…` alignment:
        // that form reads as "end even later", which pushes the end past what
        // the document can scroll, and progress then never reaches 1 — the
        // last sticker becomes the final frame and the closing card never
        // shows. A function re-measures on every refresh, so resizes are fine.
        end: () => {
          const vh = window.innerHeight;
          const track = trackRef.current?.offsetHeight ?? vh * 2;
          return `+=${Math.max(vh, track - vh * 2)}`;
        },
        onUpdate: (self) => {
          scrollState.progress = self.progress;
          // The scene renders on demand, so writing progress is not enough —
          // someone has to ask for the frame that reads it.
          renderOnDemand.request();
        },
      });
      // The track is taller than anything else on the site; if a font or the
      // model lands late, re-measure so the last stop is really at the end.
      ScrollTrigger.refresh();
      return () => trigger.kill();
    },
    // revertOnUpdate, or the teardown above never runs on a dependency change
    // (useGSAP defers cleanup to unmount otherwise) and the fall back to the
    // résumé leaves a trigger writing progress for a canvas that is gone.
    { dependencies: [mode, editing], revertOnUpdate: true }
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry?.isIntersecting ?? true),
      { rootMargin: "10%" }
    );
    io.observe(stage);
    return () => io.disconnect();
  }, [mode]);

  // Leaving the page must not strand a stale progress value in the module
  // object — the next visit starts at the opening frame.
  useEffect(() => {
    return () => {
      scrollState.progress = 0;
      useIntroStore.setState({ activeIndex: -1, ready: false });
    };
  }, []);

  if (mode === "fallback") {
    return <IntroResume text={text} copy={copy} links={links} variant="visible" />;
  }

  // One viewport per stop — opening frame, each sticker, closing frame — plus
  // one more so the closing frame gets a screen of its own to rest on before
  // the footer scrolls in. In edit mode there is nothing to scroll through.
  const trackHeight = editing
    ? "100dvh"
    : `${(INTRO_STICKERS.length + 3) * 100}dvh`;

  return (
    <>
      <div ref={trackRef} style={{ height: trackHeight }} className="relative">
        <div
          ref={stageRef}
          className="sticky top-0 h-dvh overflow-hidden"
          /* The canvas is transparent, so the page's paper, aurora and grain
             read straight through it — and the theme cross-fade stays CSS. */
        >
          {mode === "webgl" && (
            <>
              {/* The loading overlay travels with the canvas, so the words
                  now sit below it in the DOM. Stacking is unaffected: the
                  overlay is z-20 and this layer z-10. */}
              <AvatarCanvas
                tone={tone}
                onScreen={onScreen}
                loadingLabel={loadingLabel}
                onFailed={handleCanvasFailure}
              />
              {!editing && <Narrative text={text} copy={copy} links={links} />}
            </>
          )}
        </div>
      </div>

      {/* The accessible copy of everything the canvas is showing. Rendered on
          the server too, so it is what a crawler reads. */}
      {!editing && (
        <IntroResume text={text} copy={copy} links={links} variant="seo" />
      )}

      {editing && EditorPanel !== null && <EditorPanel />}
    </>
  );
}
