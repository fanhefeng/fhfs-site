"use client";

import { asset } from "@/lib/asset";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { EASE, gsap } from "@/lib/gsap";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import { Reveal } from "@/components/fx/Reveal";
import type { FilmRatio, FilmStill, StillSpan } from "./entries";

export type StillItem = FilmStill & { title: string; meta: string; alt: string };

/** The viewer's labels, translated by the page — the chunk carries no catalogue. */
export type ViewerText = {
  open: string;
  close: string;
  prev: string;
  next: string;
  /** `{index}` and `{count}` are filled in here. */
  counter: string;
  hint: string;
};

type Props = {
  /** `public/films/<folder>/` */
  folder: string;
  ratio: FilmRatio;
  stills: StillItem[];
  text: ViewerText;
};

/** How much of the six-column wall a print takes; two columns under md, one on a phone. */
const SPAN: Record<StillSpan, string> = {
  one: "md:col-span-2",
  tall: "md:col-span-2",
  wide: "sm:col-span-2 md:col-span-4",
  full: "sm:col-span-2 md:col-span-6",
};

/** Every print is cut to its film's frame; the upright and the panoramic crops only happen on the wide grid. */
const RATIO: Record<FilmRatio, Record<StillSpan, string>> = {
  video: {
    one: "aspect-video",
    tall: "aspect-video md:aspect-[5/6]",
    wide: "aspect-video",
    full: "aspect-video md:aspect-[21/9]",
  },
  photo: {
    one: "aspect-[3/2]",
    tall: "aspect-[3/2] md:aspect-[5/6]",
    wide: "aspect-[3/2]",
    full: "aspect-[3/2] md:aspect-[21/9]",
  },
};

const SIZES: Record<StillSpan, string> = {
  one: "(min-width: 1040px) 330px, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw",
  tall: "(min-width: 1040px) 330px, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw",
  wide: "(min-width: 1040px) 680px, (min-width: 768px) 66vw, 100vw",
  full: "(min-width: 1040px) 1040px, 100vw",
};

const VIEWER_BUTTON =
  "pointer-events-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 px-4 font-mono text-meta uppercase tracking-meta text-white/85 backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/**
 * A film's wall and its screening room.
 *
 * The wall hangs the stills on a six-column grid the way the neon study
 * hangs its prints — a wide one with an upright crop beside it, rows of
 * three, a panoramic one across the bottom — on paper: no mat, no rim, the
 * rounded card every other picture on the site sits in. Under each, what the
 * frame is and where in the film it comes from.
 *
 * Every print is a link to its own file, so with no JavaScript a click still
 * opens the picture. With it, the click opens the screening room instead: a
 * native `<dialog>` over a dark backdrop, the still as large as the viewport
 * allows, its caption and its place in the run under it. Arrow keys, the two
 * buttons or a swipe move along the wall; Escape, the close button or a click
 * on the backdrop leave. Page scroll is locked through the shared contract
 * while it is open, and focus goes back to the print that opened it.
 */
export function FilmStills({ folder, ratio, stills, text }: Props) {
  const [current, setCurrent] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  /** The print that opened the room — focus returns to it. */
  const openerRef = useRef<HTMLElement | null>(null);
  /** Which way the last step went, so the next still slides in from that side. */
  const dirRef = useRef(0);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  /** Set when a swipe stepped: a mouse drag ends in a click on the backdrop,
   *  which would otherwise close the room right after turning the page. */
  const swipedRef = useRef(false);
  const altId = useId();

  const src = (still: FilmStill) => asset(`/films/${folder}/${still.file}.jpg`);

  const open = (index: number, opener: HTMLElement) => {
    openerRef.current = opener;
    dirRef.current = 0;
    setCurrent(index);
  };

  const step = useCallback(
    (delta: number) => {
      dirRef.current = delta;
      setCurrent((index) =>
        index === null ? index : (index + delta + stills.length) % stills.length,
      );
    },
    [stills.length],
  );

  /** The quiet exit: fade, then the native close — which is what unwinds the
   *  state. The still steps back to the 0.96 it arrived from as it goes, so
   *  the way out is the way in, run backwards and faster. */
  const close = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open) return;
    if (frameRef.current) {
      gsap.to(frameRef.current, {
        scale: 0.96,
        duration: 0.25,
        ease: EASE.exit,
        overwrite: "auto",
      });
    }
    gsap.to(dialog, {
      autoAlpha: 0,
      duration: 0.25,
      ease: EASE.exit,
      overwrite: "auto",
      onComplete: () => {
        dialog.close();
        gsap.set(dialog, { clearProps: "opacity,visibility" });
      },
    });
  }, []);

  // Opening shows the modal and locks the page; a step slides the new still
  // in from the side it came from.
  useEffect(() => {
    const dialog = dialogRef.current;
    const frame = frameRef.current;
    if (current === null || !dialog || !frame) return;
    if (!dialog.open) {
      dialog.showModal();
      lockScroll();
      gsap.fromTo(dialog, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: EASE.default });
      gsap.fromTo(
        frame,
        { scale: 0.96, autoAlpha: 0 },
        { scale: 1, autoAlpha: 1, duration: 0.5, ease: EASE.default, clearProps: "transform" },
      );
      return;
    }
    const dir = dirRef.current;
    if (dir === 0) return;
    gsap.fromTo(
      frame,
      { x: dir * 24, autoAlpha: 0 },
      {
        x: 0,
        autoAlpha: 1,
        duration: 0.35,
        ease: EASE.default,
        overwrite: "auto",
        clearProps: "transform",
      },
    );
  }, [current]);

  // Whatever happens, an unmount must never leave the page unscrollable.
  useEffect(
    () => () => {
      if (dialogRef.current?.open) unlockScroll();
    },
    [],
  );

  const onClosed = () => {
    setCurrent(null);
    unlockScroll();
    openerRef.current?.focus({ preventScroll: true });
    openerRef.current = null;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    }
  };

  /** A click on the backdrop — anywhere that is not the still or a control —
   *  leaves. The layout layer lets pointer events through, so those clicks
   *  land on the dialog itself. */
  const onBackdropClick = (e: MouseEvent<HTMLElement>) => {
    if (swipedRef.current) {
      swipedRef.current = false;
      return;
    }
    if (e.target === e.currentTarget) close();
  };

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    swipedRef.current = false;
    // A press that starts on a control belongs to that control. The swipe is
    // 40px and the buttons are wider than that, so a press that wandered
    // across one would have fired its click and a swipe both, stepping twice.
    // Cleared rather than left: a start kept from a touch the browser took
    // over would pair with this press's release and step on its own.
    if ((e.target as HTMLElement).closest("button")) {
      swipeRef.current = null;
      return;
    }
    swipeRef.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swipedRef.current = true;
      step(dx < 0 ? 1 : -1);
    }
  };
  const onPointerCancel = () => {
    swipeRef.current = null;
  };

  const still = current === null ? null : stills[current];
  const counter =
    current === null
      ? ""
      : text.counter
          .replace("{index}", String(current + 1))
          .replace("{count}", String(stills.length));

  return (
    <>
      <Reveal
        as="ul"
        stagger={0.06}
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-6 md:gap-6"
      >
        {stills.map((item, i) => (
          <li key={item.id} className={`min-w-0 ${SPAN[item.span]}`}>
            <figure className="m-0">
              {/* The link's name stays short; what the picture shows is its
                  description, which an aria-label alone would have hidden. */}
              <span id={`${altId}-${i}`} hidden>
                {item.alt}
              </span>
              <a
                href={src(item)}
                aria-label={`${text.open} · ${item.title}`}
                aria-describedby={`${altId}-${i}`}
                // A file, not a route: keep RouteTransition's capture-phase
                // interception off it, or the veil would try to push the
                // picture's URL before this handler ever runs.
                data-no-transition=""
                onClick={(e) => {
                  e.preventDefault();
                  open(i, e.currentTarget);
                }}
                className="group block overflow-hidden rounded-card bg-surface"
              >
                <Image
                  src={src(item)}
                  width={item.width}
                  height={item.height}
                  alt={item.alt}
                  sizes={SIZES[item.span]}
                  className={`w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02] ${RATIO[ratio][item.span]}`}
                  style={item.focus ? { objectPosition: item.focus } : undefined}
                />
              </a>
              <figcaption className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="text-caption text-fg">{item.title}</span>
                <span className="font-mono text-[0.6875rem] uppercase tracking-meta text-fg-tertiary">
                  {item.meta}
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </Reveal>

      {/* The screening room. Rendered empty until a print is chosen, so the
          page carries no second copy of the wall. */}
      <dialog
        ref={dialogRef}
        aria-label={still?.title}
        onCancel={(e) => {
          // Escape: play the exit rather than vanishing.
          e.preventDefault();
          close();
        }}
        onClose={onClosed}
        onKeyDown={onKeyDown}
        onClick={onBackdropClick}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        // Lights off: the backdrop is near-black and frosts what is left of
        // the page, so the still is the only thing lit.
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none touch-pan-y border-0 bg-transparent p-0 text-white backdrop:bg-black/95 backdrop:backdrop-blur-sm"
      >
        {still && (
          <div className="pointer-events-none relative flex h-full flex-col items-center justify-center px-4 pb-16 pt-16 md:px-24">
            <div
              ref={frameRef}
              className="pointer-events-auto flex min-h-0 max-w-full flex-col items-center"
            >
              <Image
                key={still.id}
                src={src(still)}
                width={still.width}
                height={still.height}
                alt={still.alt}
                sizes="100vw"
                loading="eager"
                draggable={false}
                className="max-h-[calc(100dvh-11rem)] w-auto max-w-full select-none rounded-card object-contain"
              />
              <p className="mt-4 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-0.5 px-4 text-center">
                <span className="text-caption text-white/90">{still.title}</span>
                <span className="font-mono text-[0.6875rem] uppercase tracking-meta text-white/55">
                  {still.meta}
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={close}
              className={`${VIEWER_BUTTON} absolute right-4 top-4`}
            >
              {text.close}
            </button>
            <p
              aria-live="polite"
              className="absolute left-4 top-4 inline-flex min-h-11 items-center font-mono text-meta tabular-nums tracking-meta text-white/55"
            >
              {counter}
            </p>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label={text.prev}
              className={`${VIEWER_BUTTON} absolute bottom-4 left-4 md:bottom-auto md:left-6 md:top-1/2 md:-translate-y-1/2`}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label={text.next}
              className={`${VIEWER_BUTTON} absolute bottom-4 right-4 md:bottom-auto md:right-6 md:top-1/2 md:-translate-y-1/2`}
            >
              <span aria-hidden="true">→</span>
            </button>
            <p className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 font-mono text-meta uppercase tracking-meta text-white/40 md:block">
              {text.hint}
            </p>
          </div>
        )}
      </dialog>
    </>
  );
}
