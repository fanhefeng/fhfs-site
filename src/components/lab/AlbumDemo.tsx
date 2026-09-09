"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { CSSProperties } from "react";
import { prefersReducedMotion } from "@/lib/gsap";
import {
  CURL_STRIPS,
  curlPose,
  dragProgress,
  shouldCommit,
  showsBack,
  spreads,
  springStep,
  springSettled,
  SPRING_CANCEL,
  SPRING_COMMIT,
  ZOOM_IN,
  ZOOM_MAX,
  ZOOM_MIN,
  stripLight,
  tiltFor,
  TAP_SLOP,
  type CurlPose,
  type Spring,
} from "@/lib/pageCurl";

export type AlbumPlate = {
  src: string;
  alt: string;
  title: string;
  meta: string;
  width: number;
  height: number;
};

type Props = {
  accent: string;
  hint: string;
  plates: AlbumPlate[];
  prevLabel: string;
  nextLabel: string;
  /** "3 / 6", for the reader and for a screen reader. */
  counterAria: string;
  credit: string;
};

const DEG = 180 / Math.PI;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * An album whose pages actually bend.
 *
 * The leaf that turns is not a plane on a hinge: it is a chain of eighteen
 * nested strips (see lib/pageCurl.ts), each rotated a little further than its
 * parent about its own left edge, so the accumulated transform traces an arc
 * and the paper bows the way paper does. Every strip carries the same picture
 * at a different background offset, so the image stays continuous across a
 * surface that is being bent in eighteen pieces.
 *
 * It is DOM and CSS 3D throughout — no canvas, no WebGL, nothing to lose a
 * context. The only thing JavaScript does per frame is write three numbers per
 * strip onto custom properties; the compositor draws the rest.
 *
 * Every picture is in the DOM as a real `<img>` from the server, so the album
 * reads as a plain list of stills with no JavaScript at all, and the turn is
 * an enhancement over a page that already works.
 */
export function AlbumDemo({
  accent,
  hint,
  plates,
  prevLabel,
  nextLabel,
  counterAria,
  credit,
}: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const curlRef = useRef<HTMLDivElement>(null);
  const stripRefs = useRef<HTMLDivElement[]>([]);

  const sheets = spreads(plates);
  const [at, setAt] = useState(0);
  /** null when the book is at rest; otherwise the turn in flight. */
  const [turn, setTurn] = useState<{ dir: 1 | -1; from: number } | null>(null);
  /** False through the server render and the first paint; see the note below. */
  const [live, setLive] = useState(false);
  useEffect(() => setLive(true), []);

  /* The pointer handlers are bound once and read the current turn from a ref:
     re-subscribing them on every state change would drop a capture mid-drag. */
  const turnRef = useRef<{ dir: 1 | -1; from: number } | null>(null);
  turnRef.current = turn;
  const liveRef = useRef(false);
  liveRef.current = live;

  /**
   * Write a pose onto the DOM.
   *
   * Two custom properties on the chain's root drive the geometry — every strip
   * reads the same `--td`, and nesting is what turns one number into an arc —
   * and three per strip carry the shading. Nothing here reads layout, so a
   * turn never costs a reflow.
   */
  const pose = useCallback((p: CurlPose) => {
    const root = curlRef.current;
    if (!root) return;
    root.style.setProperty("--tt", `${(p.tilt * DEG).toFixed(2)}deg`);
    root.style.setProperty("--td", `${(p.delta * DEG).toFixed(3)}deg`);
    // How far into the turn we are, 0→1→0. The gloss is gated on it so a leaf
    // lying flat at either end has none, and it peaks as the leaf stands up.
    root.style.setProperty("--shade", p.lift.toFixed(3));
    root.dataset.face = showsBack(p) ? "back" : "front";
    for (let i = 0; i < stripRefs.current.length; i++) {
      const el = stripRefs.current[i];
      if (!el) continue;
      const { near, far } = stripLight(i, p);
      // Capped well short of black: a leaf edge-on to the reader is dim, but
      // it is still catching the light in the room, and a silhouette in the
      // middle of a turn reads as a hole in the picture.
      el.style.setProperty("--lit", near.toFixed(3));
      el.style.setProperty("--a1", ((1 - near) * 0.5).toFixed(3));
      el.style.setProperty("--a2", ((1 - far) * 0.5).toFixed(3));
    }
  }, []);

  /* ---- the turn, driven by hand or let go of ----
     One rAF loop owns the leaf while it is moving. It runs only while there
     is something left to integrate — a spring still settling, a lean still
     easing home — and stops itself the moment both have arrived, which is the
     standing rule for the moving layers here (DESIGN.md §5.3). */
  const raf = useRef<number | null>(null);
  const spring = useRef<{ to: number; k: number; c: number; done: () => void } | null>(null);
  const state = useRef<Spring>({ value: 0, velocity: 0 });
  const view = useRef({ rx: 0, ry: 0, z: 1, trx: 0, try_: 0, tz: 1 });
  const lastFrame = useRef(0);

  const applyView = useCallback(() => {
    const el = bookRef.current;
    if (!el) return;
    el.style.setProperty("--rx", `${view.current.rx.toFixed(2)}deg`);
    el.style.setProperty("--ry", `${view.current.ry.toFixed(2)}deg`);
    el.style.setProperty("--zoom", view.current.z.toFixed(3));
  }, []);

  const frame = useCallback(
    (now: number) => {
      raf.current = null;
      const dt = Math.min(0.032, (now - lastFrame.current) / 1000 || 0.016);
      lastFrame.current = now;

      const sp = spring.current;
      if (sp) {
        state.current = springStep(state.current, sp.to, dt, sp.k, sp.c);
        if (springSettled(state.current, sp.to)) {
          state.current = { value: sp.to, velocity: 0 };
          pose(curlPose(sp.to));
          spring.current = null;
          sp.done();
        } else {
          pose(curlPose(state.current.value));
        }
      }

      // The lean chases its target by a fixed fraction each frame — a spring
      // here would wobble the whole book every time the pointer twitched.
      const v = view.current;
      let leaning = false;
      for (const [k, t] of [["rx", "trx"], ["ry", "try_"], ["z", "tz"]] as const) {
        const d = v[t] - v[k];
        if (Math.abs(d) > 0.0006) {
          v[k] += d * 0.14;
          leaning = true;
        } else v[k] = v[t];
      }
      if (leaning) applyView();

      if ((spring.current || leaning) && raf.current === null) {
        raf.current = requestAnimationFrame(frame);
      }
    },
    [pose, applyView]
  );

  const kick = useCallback(() => {
    if (raf.current === null) {
      lastFrame.current = performance.now();
      raf.current = requestAnimationFrame(frame);
    }
  }, [frame]);

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    },
    []
  );

  /* The leaf is built entirely out of the book's own width, in pixels, so that
     width has to be on the element before a turn can draw. Observed rather
     than read on resize: the book is sized off the viewport AND off the
     surrounding column, and a column can change width without the window
     doing anything. */
  useEffect(() => {
    const el = bookRef.current;
    if (!el || !live) return;
    const write = () => {
      const bw = el.clientWidth;
      // --two-up is set in the stylesheet, so the one-page/two-page breakpoint
      // stays a single number living with the rest of the layout.
      const twoUp = getComputedStyle(el).getPropertyValue("--two-up").trim() !== "0";
      const page = twoUp ? bw / 2 : bw;
      /* Snapped to 1/64 of a pixel, which is the grid the layout engine
         quantises boxes onto — and the whole reason for the venetian blind.
         A strip asked for 26.6667px is laid out at 26.65625px, but its
         background is offset by the exact 26.6667px, so every strip slips
         another hundredth of a pixel against its own picture and by the far
         end of the chain the seams are a fifth of a pixel out. On paper that
         is invisible; on a photograph it is eighteen hairlines.
         Rounding the metric first makes the box and its background agree. */
      const sw = Math.round((page / CURL_STRIPS) * 64) / 64;
      el.style.setProperty("--bw", `${bw}px`);
      el.style.setProperty("--sw", `${sw}px`);
      // The leaf is exactly the strips it is made of, not the page it covers:
      // those differ by up to a quarter pixel, and the strips are the truth.
      el.style.setProperty("--pw", `${sw * CURL_STRIPS}px`);
    };
    write();
    const ro = new ResizeObserver(write);
    ro.observe(el);
    return () => ro.disconnect();
  }, [live]);

  /** Begin a turn, held at `t` — 0 when it is about to be dragged. */
  const startTurn = useCallback(
    (dir: 1 | -1, t = 0) => {
      const to = at + dir;
      if (to < 0 || to >= sheets.length) return false;
      spring.current = null;
      state.current = { value: t, velocity: 0 };
      setTurn({ dir, from: at });
      return true;
    },
    [at, sheets.length]
  );

  const settle = useCallback(
    (to: 0 | 1) => {
      const t = turnRef.current;
      if (!t) return;
      if (prefersReducedMotion()) {
        if (to === 1) setAt(t.from + t.dir);
        setTurn(null);
        return;
      }
      const { k, c } = to === 1 ? SPRING_COMMIT : SPRING_CANCEL;
      spring.current = {
        to,
        k,
        c,
        done: () => {
          if (to === 1) setAt(t.from + t.dir);
          setTurn(null);
        },
      };
      kick();
    },
    [kick]
  );

  /** Buttons and keys: start it and let the spring carry it all the way. */
  const go = useCallback(
    (dir: 1 | -1) => {
      if (turnRef.current || drag.current) return;
      if (!startTurn(dir, 0)) return;
      if (prefersReducedMotion()) {
        setAt(at + dir);
        setTurn(null);
        return;
      }
      spring.current = {
        to: 1,
        ...SPRING_COMMIT,
        done: () => {
          setAt(at + dir);
          setTurn(null);
        },
      };
      kick();
    },
    [at, startTurn, kick]
  );

  /* ---- pointer ----
     Pressing on a half of the book picks the direction and opens that turn at
     zero; moving pins its progress to the hand; letting go either finishes it
     or springs it back. A press that never really moved is a tap, and simply
     turns the page. */
  const drag = useRef<{ dir: 1 | -1; x0: number; w: number; moved: number; vel: number; at: number } | null>(null);

  useEffect(() => {
    const stage = bookRef.current;
    if (!stage) return;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || turnRef.current || !liveRef.current) return;
      const r = stage.getBoundingClientRect();
      const dir: 1 | -1 = (e.clientX - r.left) / r.width > 0.5 ? 1 : -1;
      if (!startTurn(dir, 0)) return;
      e.preventDefault();
      // Capture keeps the drag alive if the hand leaves the book mid-turn. It
      // throws for a pointer the browser does not consider active, and losing
      // the capture is survivable — losing the drag state is not, because the
      // page would hang half-turned with nothing left to finish it.
      try {
        stage.setPointerCapture(e.pointerId);
      } catch {
        /* not a live pointer; carry on without capture */
      }
      drag.current = { dir, x0: e.clientX, w: r.width, moved: 0, vel: 0, at: performance.now() };
    };

    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) {
        // No page in hand: the book leans toward the pointer, but only for a
        // pointer actually over it — this handler is also on the window.
        if (e.currentTarget !== stage) return;
        const r = stage.getBoundingClientRect();
        const { rx, ry } = tiltFor(e.clientX, e.clientY, r);
        view.current.trx = rx;
        view.current.try_ = ry;
        kick();
        return;
      }
      const dx = e.clientX - d.x0;
      d.moved = Math.max(d.moved, Math.abs(dx));
      const t = dragProgress(dx, d.dir, d.w);
      const now = performance.now();
      d.vel = (t - state.current.value) / Math.max(0.001, (now - d.at) / 1000);
      d.at = now;
      state.current = { value: t, velocity: 0 };
      pose(curlPose(t));
    };

    const onUp = () => {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      if (!turnRef.current) return;
      // A tap turns the page; a drag is judged on where it got to and how fast.
      settle(d.moved < TAP_SLOP || shouldCommit(state.current.value, d.vel) ? 1 : 0);
    };

    const onLeave = () => {
      view.current.trx = 0;
      view.current.try_ = 0;
      kick();
    };

    // Lean in, and back out again. Clamped so neither end can run away.
    const onDouble = () => {
      const z = view.current.tz > 1 ? 1 : ZOOM_IN;
      view.current.tz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
      kick();
    };

    const noDrag = (e: Event) => e.preventDefault();

    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);
    stage.addEventListener("dblclick", onDouble);
    stage.addEventListener("dragstart", noDrag);
    // The end of a drag is the window's business, not the book's: a hand that
    // leaves the book still owns the page it is holding, and pointer capture
    // is refused often enough that it cannot be the only thing keeping the
    // turn alive.
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
      stage.removeEventListener("dblclick", onDouble);
      stage.removeEventListener("dragstart", noDrag);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [startTurn, settle, kick, pose]);

  // Arrow keys, once the album has focus — the same two moves the buttons make.
  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [go]);

  // A fresh chain has to be posed before the browser paints it, or the first
  // frame of every turn is a flat page.
  useEffect(() => {
    if (turn) pose(curlPose(state.current.value));
  }, [turn, pose]);

  const leaving = turn ? sheets[turn.from] : null;
  const arriving = turn ? sheets[turn.from + turn.dir] : null;

  /* The two faces of the leaf in flight. Turning forward, the front of the
     leaf is the recto you are leaving and its back is the verso you are
     turning to; going back, it is the other way round. */
  const front = turn ? (turn.dir === 1 ? leaving?.[1] : arriving?.[1]) : null;
  const back = turn ? (turn.dir === 1 ? arriving?.[0] : leaving?.[0]) : null;

  /**
   * What each spread is doing this frame.
   *
   * At rest exactly one is up. Mid-turn two are, each clipped to the half the
   * reader will still be looking at when the leaf lands — the page that stays
   * put on one side, the page coming up from underneath on the other. The leaf
   * itself covers the seam between them, which is why nothing has to be hidden
   * behind it.
   */
  const roleOf = (i: number): string | undefined => {
    if (!turn) return i === at ? "whole" : undefined;
    const to = turn.from + turn.dir;
    if (turn.dir === 1) {
      if (i === turn.from) return "left";
      if (i === to) return "right";
    } else {
      if (i === turn.from) return "right";
      if (i === to) return "left";
    }
    return undefined;
  };

  return (
    <div
      ref={scope}
      tabIndex={-1}
      className="al-scope"
      style={{ "--al-accent": accent } as CSSProperties}
    >
      <style href="lab-album" precedence="medium">
        {CSS}
      </style>

      <div className="al-stage">
        {/* Until the client says otherwise this is a plain list of spreads,
            every still in the DOM at its own size. `data-live` is what turns
            it into a book — so with no JavaScript, or before the chunk lands,
            the album is still the whole album and a crawler sees all twelve
            pictures rather than the two on top of the pile. */}
        <div ref={bookRef} className="al-book" data-live={live || undefined}>
          {sheets.map(([l, r], i) => (
            <div key={i} className="al-sheet" data-role={roleOf(i)}>
              <div className="al-leaf al-verso">{l && <Plate plate={l} />}</div>
              <div className="al-leaf al-recto">{r && <Plate plate={r} />}</div>
            </div>
          ))}

          <div className="al-gutter" aria-hidden="true" />

          {turn && (
            <div
              ref={curlRef}
              className="al-curl"
              data-dir={turn.dir === 1 ? "next" : "prev"}
              aria-hidden="true"
            >
              <Strip
                index={0}
                front={front?.src}
                back={back?.src}
                register={(i, el) => {
                  if (el) stripRefs.current[i] = el;
                }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="al-bar" hidden={!live}>
        <button type="button" className="al-btn" onClick={() => go(-1)} disabled={at === 0}>
          <span aria-hidden="true">←</span>
          <span className="al-sr">{prevLabel}</span>
        </button>
        <p className="al-count" aria-label={counterAria} aria-live="polite">
          {pad(at + 1)} / {pad(sheets.length)}
        </p>
        <button
          type="button"
          className="al-btn"
          onClick={() => go(1)}
          disabled={at >= sheets.length - 1}
        >
          <span className="al-sr">{nextLabel}</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <p className="al-hint" aria-hidden="true">{hint}</p>
      <p className="al-credit">{credit}</p>
    </div>
  );
}

/** One page of the album: the still, and what it is. */
function Plate({ plate }: { plate: AlbumPlate }) {
  return (
    <figure className="al-plate">
      {/* The page at rest is a real image, so the album is a list of stills
          before it is ever a book. The turning leaf is separate: its faces are
          backgrounds, because sliding one picture across eighteen windows is
          the whole trick and an <img> cannot be offset that way. */}
      <Image
        src={plate.src}
        alt={plate.alt}
        width={plate.width}
        height={plate.height}
        draggable={false}
        sizes="(max-width: 720px) 92vw, 30rem"
      />
      <figcaption>
        <span className="al-title">{plate.title}</span>
        <span className="al-meta">{plate.meta}</span>
      </figcaption>
    </figure>
  );
}

/**
 * One strip of the turning leaf.
 *
 * Each is a child of the one before it — the nesting is in the DOM, not in a
 * transform stack this component maintains — so the browser accumulates the
 * rotation for free. The picture is a background rather than an `<img>`
 * because the offset per strip is the whole trick: eighteen windows onto the
 * same picture, side by side, add back up to one continuous page.
 */
function Strip({
  index,
  front,
  back,
  register,
}: {
  index: number;
  front?: string;
  back?: string;
  register: (index: number, el: HTMLDivElement | null) => void;
}) {
  if (index >= CURL_STRIPS) return null;

  const style = { "--i": index } as CSSProperties;

  return (
    <div ref={(el) => register(index, el)} className="al-strip" style={style}>
      <div
        className="al-face al-front"
        style={front ? { backgroundImage: `url(${front})` } : undefined}
      >
        <i className="al-sh" />
        <i className="al-gl" />
      </div>
      <div
        className="al-face al-back"
        style={back ? { backgroundImage: `url(${back})` } : undefined}
      >
        <i className="al-sh" />
        <i className="al-gl" />
      </div>
      {/* The next link of the chain lives inside this one — that is what makes
          the rotations accumulate without any transform maths here. */}
      <Strip index={index + 1} front={front} back={back} register={register} />
    </div>
  );
}

const CSS = `
.al-scope { outline: none; }

.al-stage {
  display: grid;
  place-items: center;
  padding: clamp(1rem, 4vw, 3rem) 1rem 0;
  /* One camera for the whole scene — the book leans inside it. */
  perspective: 4000px;
  perspective-origin: 50% 44%;
}

/* Before JavaScript: a stack of spreads, one under the next, every still at
   its own size. This is the whole album, readable and crawlable, and it is
   what the server sends. */
.al-book {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: min(92vw, 60rem);
}
.al-sheet {
  display: grid;
  grid-template-columns: 1fr 1fr;
  aspect-ratio: 32 / 9;
}
.al-gutter { display: none; }

/* After: one spread at a time, and a book to turn. Perspective lives on the
   book, so every leaf inside shares one vanishing point — put it on the leaf
   instead and each page gets its own camera. */
.al-book[data-live] {
  position: relative;
  display: block;
  aspect-ratio: 32 / 9;
  /* --bw, --pw and --sw are written by the component, in pixels, snapped to
     the layout grid — see the note where they are measured. This only says
     which layout we are in, so the breakpoint lives in one place. */
  --two-up: 1;
  /* Touch has its own idea about a horizontal drag; this is the page-turn's. */
  touch-action: pan-y;
  /* The lean toward the pointer. It belongs on the book and the perspective
     belongs on the stage outside it: put both on one element and the rotation
     is applied to the camera rather than to what the camera is looking at, so
     the book skews flat instead of leaning. */
  --rx: 0deg;
  --ry: 0deg;
  --zoom: 1;
  transform: rotateX(var(--rx)) rotateY(var(--ry)) scale(var(--zoom));
  transform-style: preserve-3d;
  will-change: transform;
}
.al-book[data-live] .al-sheet {
  position: absolute;
  inset: 0;
  visibility: hidden;
}
.al-book[data-live] .al-sheet[data-role] { visibility: visible; }
/* Mid-turn two spreads are up, each clipped to the half that survives the
   turn; the leaf covers the join. */
.al-book[data-live] .al-sheet[data-role="left"] { clip-path: inset(0 50% 0 0); }
.al-book[data-live] .al-sheet[data-role="right"] { clip-path: inset(0 0 0 50%); }
.al-book[data-live] .al-gutter { display: block; }

.al-leaf {
  position: relative;
  overflow: hidden;
  background: var(--surface-raised, #16150f);
}
.al-verso { border-radius: 0.5rem 0 0 0.5rem; }
.al-recto { border-radius: 0 0.5rem 0.5rem 0; }

.al-plate { margin: 0; height: 100%; }
.al-plate img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
}
.al-plate figcaption {
  position: absolute;
  inset: auto 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 2.5rem 1rem 0.85rem;
  background: linear-gradient(to top, rgba(8, 8, 6, 0.78), rgba(8, 8, 6, 0));
  color: #f2efe4;
}
.al-title { font-size: 0.8125rem; }
.al-meta {
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.66;
}

/* The gutter: the shadow either page casts into the fold. */
.al-gutter {
  position: absolute;
  inset: 0 calc(50% - 2.2rem);
  pointer-events: none;
  background: linear-gradient(
    to right,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0.34) 46%,
    rgba(0, 0, 0, 0.4) 50%,
    rgba(0, 0, 0, 0.34) 54%,
    rgba(0, 0, 0, 0) 100%
  );
  z-index: 3;
}

/* ---- the turning leaf ---- */

.al-curl {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50%;
  z-index: 4;
  transform-style: preserve-3d;
}
/* Forward: the leaf is the right-hand page, hinged on the gutter. Backward:
   the left-hand page, hinged on the same line from the other side. */
.al-curl[data-dir="next"] { left: 50%; transform-origin: left center; transform: rotateY(calc(-1 * var(--tt, 0deg))); }
.al-curl[data-dir="prev"] { left: 0; transform-origin: right center; transform: rotateY(var(--tt, 0deg)); }

.al-strip {
  position: absolute;
  top: 0;
  bottom: 0;
  transform-style: preserve-3d;
  /* Measured off the book in real pixels, never as a percentage of the parent.
     Inside a nested strip, 100% means the strip it hangs off, so a percentage
     width compounds away down the chain — and even a corrected percentage
     lands on a different sub-pixel per link, which is what shows up as a row
     of hairline gaps: the venetian blind. */
  width: var(--sw);
}
/* Every strip after the first hangs off the outer edge of its parent and adds
   one more small turn — which is the entire curl. */
.al-curl[data-dir="next"] .al-strip { transform-origin: left center; }
.al-curl[data-dir="prev"] .al-strip { transform-origin: right center; }
.al-curl[data-dir="next"] > .al-strip { left: 0; }
.al-curl[data-dir="prev"] > .al-strip { right: 0; }
.al-curl[data-dir="next"] .al-strip .al-strip { left: 100%; transform: rotateY(var(--td, 0deg)); }
.al-curl[data-dir="prev"] .al-strip .al-strip { right: 100%; transform: rotateY(calc(-1 * var(--td, 0deg))); }

.al-face {
  position: absolute;
  top: 0;
  bottom: 0;
  /* Each face reaches a hair past one of its edges, into the neighbour: two
     adjacent 3D-transformed boxes do not share an exact edge once the
     compositor has rounded them, and the sliver of background between them is
     the venetian blind.
     WHICH edge is the whole trick. The overlap only works because the next
     strip paints over it, and past the quarter turn preserve-3d reverses the
     painting order — so an overlap that was safely hidden becomes 1.1px
     of the wrong picture, on strips that by then are only a couple of pixels
     wide. So it flips with the leaf. */
  left: 0;
  right: -1.1px;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  /* Eighteen windows onto one picture. The background is sized to the whole
     page in pixels and slid by this strip's own share of it, so every window
     lands on the same grid however the browser rounds the boxes. */
  background-repeat: no-repeat;
  background-size: var(--pw) auto;
}
.al-front { background-position-x: calc(-1 * var(--i) * var(--sw)); }
/* The back is mirrored by its own 180° turn, so it walks the picture the other
   way: strip 0 shows the far edge, the last strip shows the near one. */
.al-back {
  transform: rotateY(180deg);
  background-position-x: calc((var(--i) + 1) * var(--sw) - var(--pw));
}

/* Shadow and gloss both stop short of the page's top and bottom edges. Run
   either to the very edge and the leaf gets a hard bright or dark rule along
   its head and foot, which reads as a sticker rather than as paper catching
   the light. */
.al-sh,
.al-gl {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  pointer-events: none;
  -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 5.2%, #000 94.8%, transparent 100%);
  mask-image: linear-gradient(180deg, transparent 0, #000 5.2%, #000 94.8%, transparent 100%);
}
.al-sh {
  background: linear-gradient(
    to right,
    rgba(18, 14, 8, var(--a1, 0)),
    rgba(18, 14, 8, var(--a2, 0))
  );
}
.al-curl[data-dir="prev"] .al-sh {
  background: linear-gradient(to left, rgba(18, 14, 8, var(--a1, 0)), rgba(18, 14, 8, var(--a2, 0)));
}
/* The sheen that makes the bend read as a bend. Squared, so it falls away
   quickly off the part of the arc that is facing the light — a linear falloff
   spreads a flat wash over the whole leaf and flattens it back out. */
.al-gl {
  background: #fffaf0;
  opacity: calc(var(--shade, 0) * var(--lit, 1) * var(--lit, 1) * 0.2);
}

/* ---- controls ---- */

.al-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  margin-top: 1.5rem;
}
.al-btn {
  display: inline-grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--fg-secondary);
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
}
.al-btn:hover:not(:disabled) { color: var(--al-accent); border-color: var(--al-accent); }
.al-btn:disabled { opacity: 0.32; cursor: default; }
.al-count {
  margin: 0;
  min-width: 4rem;
  text-align: center;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.16em;
  color: var(--fg-tertiary);
  font-variant-numeric: tabular-nums;
}

.al-hint,
.al-credit {
  margin: 0.75rem auto 0;
  max-width: 42rem;
  padding-inline: 1rem;
  text-align: center;
  font-family: var(--font-stack-mono);
  font-size: 0.625rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-tertiary);
}
.al-credit { text-transform: none; letter-spacing: 0.02em; opacity: 0.72; }

.al-sr {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (max-width: 720px) {
  /* One page at a time on a phone: two 16:9 stills side by side on a 390px
     screen are two postage stamps. The leaf still turns — it is just the whole
     book now, hinged on its left edge. */
  .al-sheet { grid-template-columns: 1fr; aspect-ratio: 16 / 9; }
  .al-book[data-live] { aspect-ratio: 16 / 9; --two-up: 0; }
  .al-verso { display: none; }
  .al-recto { border-radius: 0.5rem; }
  .al-book[data-live] .al-gutter { display: none; }
  .al-curl { width: 100%; }
  .al-curl[data-dir="next"] { left: 0; }
}
`;
