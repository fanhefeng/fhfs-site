"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { prefersSaveData } from "@/lib/client/three/guards";
import { supportsHtmlInCanvas } from "@/lib/client/htmlInCanvas";
import { StudyPanel } from "./StudyPanel";
import type { StudyText } from "./LabStudy";
import type { MagazineRenderer, mountMagazine } from "./magazineRenderer";
import { MAGAZINE_CSS } from "./magazine.css";

function MagazineCover({
  text,
  saved,
  onSave,
}: {
  text: StudyText;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <article className="mag-cover" aria-label={text.coverAria}>
      <header className="mag-masthead">
        <span lang="en">fhf’s</span>
        <span className="mag-edition">{text.edition}</span>
      </header>
      <div className="mag-art" aria-hidden="true">
        <span className="mag-orbit mag-orbit-one" />
        <span className="mag-orbit mag-orbit-two" />
        <span className="mag-sun" />
        <span className="mag-art-index">01</span>
        <span className="mag-art-caption" lang="en">
          A WORLD IN THE MAKING
        </span>
      </div>
      <div className="mag-copy">
        <p className="mag-kicker">{text.coverKicker}</p>
        <h2>{text.coverTitle}</h2>
        <p className="mag-deck">{text.coverBody}</p>
      </div>
      <footer className="mag-footer">
        <Link href="/about" className="mag-read">
          {text.read}
        </Link>
        <button type="button" className="mag-save" aria-pressed={saved} onClick={onSave}>
          <span aria-hidden="true">{saved ? "◆" : "◇"}</span>
          {saved ? text.saved : text.save}
        </button>
      </footer>
    </article>
  );
}

/** The HTML cover is the baseline, including SSR and failed GPU/chunk loads. */
export function MagazineDemo({ accent, text }: { accent: string; text: StudyText }) {
  const [mount, setMount] = useState<typeof mountMagazine | null>(null);
  const [live, setLive] = useState(false);
  const [flat, setFlat] = useState(false);
  const [saved, setSaved] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<MagazineRenderer | null>(null);

  useEffect(() => {
    if (
      prefersSaveData() ||
      window.matchMedia("(forced-colors: active)").matches ||
      !supportsHtmlInCanvas()
    )
      return;
    let cancelled = false;
    import("./magazineRenderer").then(
      (module) => {
        if (!cancelled) setMount(() => module.mountMagazine);
      },
      () => {
        /* The HTML edition is already readable. */
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const box = stage.current;
    const surface = canvas.current;
    const cover = surface?.querySelector<HTMLElement>(".mag-cover");
    if (!mount || flat || !box || !surface || !cover) return;
    let cancelled = false;
    const fallback = () => {
      if (cancelled) return;
      setLive(false);
      setMount(null);
    };
    renderer.current = mount({
      canvas: surface,
      cover,
      stage: box,
      onLive: () => {
        if (!cancelled) setLive(true);
      },
      onFail: fallback,
    });
    return () => {
      cancelled = true;
      renderer.current?.dispose();
      renderer.current = null;
    };
  }, [mount, flat]);

  const toggleView = () => {
    setLive(false);
    setFlat((value) => !value);
  };
  const cover = <MagazineCover text={text} saved={saved} onSave={() => setSaved((v) => !v)} />;
  return (
    <StudyPanel accent={accent} label={text.label!} lede={text.lede!}>
      <style href="lab-magazine" precedence="medium">
        {MAGAZINE_CSS}
      </style>
      <div className="mag-study">
        <div ref={stage} className="mag-stage" data-view={live ? "3d" : "html"}>
          <span className="mag-stage-note" aria-hidden="true">
            {text.stageNote}
          </span>
          <div className="mag-html" aria-hidden={live ? true : undefined} inert={live}>
            {cover}
          </div>
          {mount && !flat && (
            <canvas
              ref={canvas}
              className="mag-canvas"
              aria-hidden={live ? undefined : true}
              inert={!live}
            >
              {cover}
            </canvas>
          )}
        </div>
        <div className="mag-toolbar">
          <p className="mag-status" role="status">
            {live ? text.live : text.fallback}
          </p>
          {mount && (
            <div className="mag-controls">
              <div role="group" aria-label={text.turnAria} className="mag-turn">
                <button
                  type="button"
                  disabled={!live}
                  onClick={() => renderer.current?.turn(-1)}
                  aria-label={text.turnLeft}
                >
                  ↶
                </button>
                <button type="button" disabled={!live} onClick={() => renderer.current?.reset()}>
                  {text.reset}
                </button>
                <button
                  type="button"
                  disabled={!live}
                  onClick={() => renderer.current?.turn(1)}
                  aria-label={text.turnRight}
                >
                  ↷
                </button>
              </div>
              <button type="button" className="spn-btn" aria-pressed={flat} onClick={toggleView}>
                {flat ? text.spatialView : text.flatView}
              </button>
            </div>
          )}
        </div>
        <p className="mag-hint">{live ? text.liveHint : text.flatHint}</p>
      </div>
    </StudyPanel>
  );
}
