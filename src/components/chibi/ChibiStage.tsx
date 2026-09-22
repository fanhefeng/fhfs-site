"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import { gsap, useGSAP, EASE, isFinePointer } from "@/lib/gsap";

type Eye = "open" | "happy" | "shut" | "round" | "spiral" | "heart" | "squeeze";
type Mouth = "smile" | "grin" | "o" | "snore" | "cat" | "wave";
type Face = { l: Eye; r: Eye; mouth?: Mouth };

const FACES = {
  rest: { l: "open", r: "open" },
  happy: { l: "happy", r: "happy", mouth: "smile" },
  wink: { l: "open", r: "happy", mouth: "grin" },
  surprised: { l: "round", r: "round", mouth: "o" },
  love: { l: "heart", r: "heart", mouth: "smile" },
  laugh: { l: "squeeze", r: "squeeze", mouth: "smile" },
  shy: { l: "open", r: "open", mouth: "wave" },
  pat: { l: "happy", r: "happy", mouth: "cat" },
  dizzy: { l: "spiral", r: "spiral", mouth: "wave" },
  asleep: { l: "shut", r: "shut", mouth: "snore" },
} satisfies Record<string, Face>;
type FaceName = keyof typeof FACES;

/** What a poke plays, in turn — every one gets seen before any repeats. */
const POKES = ["happy", "wink", "surprised", "love", "laugh", "shy"] as const;
type Poke = (typeof POKES)[number];

/** How far each layer travels at full look, in source pixels. The layers
 *  nearer the viewer travel further; that difference is the head turning. */
const REACH = {
  eyes: [50, 34],
  glasses: [16, 10],
  face: [12, 8],
  hair: [7, 5],
  body: [-5, 0],
} as const;

/** Five pokes this close together and he sees stars. */
const DIZZY_CLICKS = 5;
const DIZZY_WINDOW = 1600;
/** Nobody moved for this long: he nods off. */
const SLEEP_AFTER = 25_000;
/** Particles are drawn at the source's scale; on a 200px tile they need this
 *  much more to read. */
const FX = 1.8;

/** Pivots, in the drawing's coordinates. */
const NECK = "360 1150";
const FEET = "627 1254";
const TUFT_ROOT = "445 176";

/**
 * The chibi's behaviour. The drawing arrives as children (`ChibiArt`, a
 * server component — its paths stay out of this bundle); this finds the
 * layers by `data-c` and drives them.
 *
 * At rest he breathes, blinks, and follows the pointer anywhere on the page —
 * eyes most, glasses less, hair least, so the head seems to turn. A poke plays
 * the next face in POKES; five in quick succession make him dizzy; stroking
 * his hair back and forth is a pat; left alone he falls asleep, and wakes with
 * a start. The loops only run while he is on screen.
 */
export function ChibiStage({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useGSAP(
    () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const one = (c: string) => btn.querySelector<SVGGElement>(`[data-c="${c}"]`)!;
      const every = (c: string) => Array.from(btn.querySelectorAll<SVGElement>(`[data-c="${c}"]`));

      const squash = one("squash");
      const breath = one("breath");
      const head = one("head");
      const headLook = one("head-look");
      const eyes = one("eyes");
      const lids = every("lid");
      const cheeks = one("cheeks");
      const hatch = every("hatch");
      const mouth = one("mouth");
      const hair = one("hair");
      const hairAct = one("hair-act");
      const tuft = one("tuft");
      const tuftSway = one("tuft-sway");
      const glasses = one("glasses");
      const glassesAct = one("glasses-act");
      const glint = one("glint");
      const body = one("body");
      const [lidL, lidR] = lids as [SVGElement, SVGElement];
      const eyeParts = (lid: SVGElement) =>
        Array.from(lid.querySelectorAll<SVGElement>("[data-eye]"));
      const parts = { l: eyeParts(lidL), r: eyeParts(lidR) };
      const mouths = Array.from(mouth.querySelectorAll<SVGElement>("[data-mouth]"));

      gsap.set(squash, { svgOrigin: FEET });
      gsap.set(breath, { svgOrigin: FEET });
      gsap.set([head, headLook], { svgOrigin: NECK });
      gsap.set([tuft, tuftSway], { svgOrigin: TUFT_ROOT });
      gsap.set(lids, { transformOrigin: "50% 50%" });

      /* ---- faces ---------------------------------------------------- */

      let face: FaceName = "rest";
      const setFace = (name: FaceName) => {
        const next: Face = FACES[name];
        const shown: SVGElement[] = [];
        for (const side of ["l", "r"] as const) {
          for (const node of parts[side]) {
            const on = node.dataset.eye === next[side];
            gsap.set(node, { opacity: on ? 1 : 0 });
            if (on && next[side] !== "open") shown.push(node);
          }
        }
        for (const node of mouths) {
          const on = node.dataset.mouth === next.mouth;
          gsap.set(node, { opacity: on ? 1 : 0 });
          if (on) shown.push(node);
        }
        gsap.set(lids, { scaleY: 1 });
        if (name !== face && shown.length > 0) {
          gsap.fromTo(
            shown,
            { scale: 0.5, transformOrigin: "50% 50%" },
            { scale: 1, duration: 0.4, ease: EASE.pop, overwrite: "auto" },
          );
        }
        face = name;
      };

      /* ---- looking -------------------------------------------------- */

      const to = (el: Element, prop: string, duration: number, ease: string = EASE.soft) =>
        gsap.quickTo(el, prop, { duration, ease });
      const look = {
        eyesX: to(eyes, "x", 0.3),
        eyesY: to(eyes, "y", 0.3),
        glassesX: to(glasses, "x", 0.45),
        glassesY: to(glasses, "y", 0.45),
        faceX: to(cheeks, "x", 0.45),
        faceY: to(cheeks, "y", 0.45),
        mouthX: to(mouth, "x", 0.45),
        mouthY: to(mouth, "y", 0.45),
        hairX: to(hair, "x", 0.6),
        hairY: to(hair, "y", 0.6),
        bodyX: to(body, "x", 0.7),
        turn: to(headLook, "rotation", 0.8),
        // The tuft lags the head and overshoots — a spring on a stalk.
        tuft: to(tuft, "rotation", 1.3, EASE.release),
      };
      let aimX = 0;
      const aim = (nx: number, ny: number) => {
        aimX = nx;
        look.eyesX(nx * REACH.eyes[0]);
        look.eyesY(ny * REACH.eyes[1]);
        look.glassesX(nx * REACH.glasses[0]);
        look.glassesY(ny * REACH.glasses[1]);
        look.faceX(nx * REACH.face[0]);
        look.faceY(ny * REACH.face[1]);
        look.mouthX(nx * REACH.face[0]);
        look.mouthY(ny * REACH.face[1]);
        look.hairX(nx * REACH.hair[0]);
        look.hairY(ny * REACH.hair[1]);
        look.bodyX(nx * REACH.body[0]);
        look.turn(nx * 3);
        look.tuft(-nx * 16);
      };

      /** Where the eyes sit inside the button, as a fraction of its box. */
      const EYE_LINE = { x: 0.4, y: 0.68 };
      let rect: DOMRect | null = null;
      const forget = () => (rect = null);
      /** A reaction that looks somewhere on purpose holds the gaze. */
      let gazeHeld = false;
      let lastPointer = 0;

      const lookAt = (clientX: number, clientY: number) => {
        rect ??= btn.getBoundingClientRect();
        const dx = clientX - (rect.left + rect.width * EYE_LINE.x);
        const dy = clientY - (rect.top + rect.height * EYE_LINE.y);
        const d = Math.hypot(dx, dy);
        if (d < 1) return aim(0, 0);
        // Full deflection a couple of widths away, eased so the near field
        // still reads; beyond that he just keeps looking that way.
        const reach = Math.max(rect.width * 2.2, 360);
        const k = 1 - (1 - Math.min(d / reach, 1)) ** 2;
        aim((dx / d) * k, (dy / d) * k);
      };

      /* ---- particles ------------------------------------------------ */

      const pool = (c: string) => {
        const list = every(c);
        let i = 0;
        return () => list[i++ % list.length]!;
      };
      const next = {
        note: pool("fx-note"),
        heart: pool("fx-heart"),
        sparkle: pool("fx-sparkle"),
        z: pool("fx-z"),
      };
      const stars = every("fx-star");
      const bang = one("fx-bang");
      const sweat = one("fx-sweat");
      const rnd = gsap.utils.random;

      /** Pop in at (x, y), drift by (dx, dy), fade out. */
      const float = (
        node: SVGElement,
        x: number,
        y: number,
        dx: number,
        dy: number,
        size = 1,
        life = 1.2,
      ) => {
        const spin = rnd(-25, 25);
        gsap
          .timeline()
          .fromTo(
            node,
            { x, y, scale: 0.2, rotation: -spin, opacity: 0 },
            { scale: size * FX, opacity: 1, duration: 0.25, ease: EASE.pop },
          )
          .to(node, { x: x + dx, y: y + dy, rotation: spin, duration: life, ease: EASE.soft }, 0)
          .to(
            node,
            { opacity: 0, scale: size * FX * 0.6, duration: 0.35, ease: EASE.fadeOut },
            life - 0.3,
          );
      };
      const notes = (n: number) => {
        for (let i = 0; i < n; i++) {
          gsap.delayedCall(i * 0.14, () =>
            float(
              next.note(),
              rnd(820, 920),
              rnd(430, 520),
              rnd(60, 200),
              rnd(-260, -180),
              rnd(0.9, 1.3),
            ),
          );
        }
      };
      const hearts = (n: number, x = 560, y = 260, spread = 260) => {
        for (let i = 0; i < n; i++) {
          gsap.delayedCall(i * 0.1, () =>
            float(
              next.heart(),
              x + rnd(-spread, spread) / 2,
              y + rnd(-30, 30),
              rnd(-80, 80),
              rnd(-220, -140),
              rnd(0.8, 1.4),
            ),
          );
        }
      };
      const sparkle = (x: number, y: number) => {
        const node = next.sparkle();
        gsap.fromTo(
          node,
          { x, y, scale: 0, rotation: 0, opacity: 1 },
          {
            keyframes: [
              { scale: 1.3 * FX, rotation: 90, duration: 0.3, ease: EASE.pop },
              { scale: 0, rotation: 180, opacity: 0, duration: 0.35, ease: EASE.exit },
            ],
          },
        );
      };
      const exclaim = () =>
        gsap.fromTo(
          bang,
          { x: 930, y: 270, scale: 0, rotation: -20, opacity: 1 },
          {
            keyframes: [
              { scale: 1.2 * FX, rotation: 8, duration: 0.3, ease: EASE.pop },
              { scale: FX, rotation: 0, duration: 0.2, ease: EASE.default },
              { opacity: 0, scale: 0.7, duration: 0.3, delay: 0.6, ease: EASE.fadeOut },
            ],
          },
        );
      const glintSweep = () =>
        gsap.fromTo(
          glint,
          { x: 60, opacity: 0.55 },
          {
            x: 1000,
            duration: 0.7,
            ease: EASE.travel,
            onComplete: () => void gsap.set(glint, { opacity: 0 }),
          },
        );

      /* ---- the body's own moves -------------------------------------- */

      const bounce = (depth = 1) =>
        gsap
          .timeline()
          .to(squash, {
            scaleY: 1 - 0.07 * depth,
            scaleX: 1 + 0.05 * depth,
            duration: 0.09,
            ease: EASE.exit,
          })
          .to(squash, { scaleY: 1, scaleX: 1, duration: 0.8, ease: EASE.spring });

      const idle = gsap
        .timeline({ repeat: -1, yoyo: true, paused: true })
        .to(breath, { scaleY: 1.012, scaleX: 0.997, duration: 2.4, ease: EASE.breathe }, 0)
        .fromTo(tuftSway, { rotation: -4 }, { rotation: 5, duration: 2.4, ease: EASE.breathe }, 0);

      /* ---- reactions ------------------------------------------------ */

      type State = "rest" | "react" | "pat" | "dizzy" | "asleep";
      // Mirrored onto the button as data-mood, for anyone poking at him in
      // devtools.
      let state: State = "rest";
      const setState = (next: State) => {
        state = next;
        btn.dataset.mood = next;
      };
      let act: gsap.core.Timeline | null = null;
      let hold: gsap.core.Tween | null = null;
      const loops: (gsap.core.Tween | gsap.core.Timeline)[] = [];

      const stopLoops = () => {
        while (loops.length) loops.pop()!.kill();
      };

      /** Back to a neutral face with every reaction-owned transform undone. */
      const rest = () => {
        act?.kill();
        hold?.kill();
        stopLoops();
        act = null;
        setState("rest");
        gazeHeld = false;
        setFace("rest");
        gsap.to(head, { rotation: 0, x: 0, y: 0, duration: 0.6, ease: EASE.default });
        gsap.to(glassesAct, { rotation: 0, x: 0, y: 0, duration: 0.6, ease: EASE.spring });
        gsap.to(hairAct, { scale: 1, duration: 0.5, ease: EASE.default });
        gsap.to(cheeks, { opacity: 1, duration: 0.5, ease: EASE.fadeOut });
        gsap.to(hatch, { opacity: 0, duration: 0.3, ease: EASE.fadeOut });
        gsap.set(parts.l.concat(parts.r), { rotation: 0 });
        idle.timeScale(1);
      };
      const restIn = (seconds: number) => {
        hold?.kill();
        hold = gsap.delayedCall(seconds, rest);
      };

      /** Everything a reaction starts from: the old one gone, a fresh timeline. */
      const begin = (name: FaceName, next: State = "react") => {
        act?.kill();
        hold?.kill();
        stopLoops();
        gsap.set(parts.l.concat(parts.r), { rotation: 0 });
        gsap.to(hatch, { opacity: 0, duration: 0.2, ease: EASE.fadeOut });
        gazeHeld = false;
        setState(next);
        setFace(name);
        act = gsap.timeline();
        return act;
      };

      const poke = (name: Poke) => {
        const tl = begin(name);
        bounce();
        switch (name) {
          case "happy":
            notes(3);
            tl.to(head, { rotation: 4, duration: 0.5, ease: EASE.default }, 0);
            break;
          case "wink":
            sparkle(840, 760);
            glintSweep();
            tl.to(head, { rotation: -3, duration: 0.5, ease: EASE.default }, 0);
            break;
          case "surprised":
            exclaim();
            tl.fromTo(
              glassesAct,
              { y: 0 },
              {
                keyframes: [
                  { y: -44, duration: 0.14, ease: EASE.default },
                  { y: 0, duration: 0.8, ease: EASE.spring },
                ],
              },
              0,
            ).fromTo(
              hairAct,
              { scale: 1, transformOrigin: "50% 60%" },
              {
                keyframes: [
                  { scale: 1.05, duration: 0.12, ease: EASE.default },
                  { scale: 1, duration: 0.9, ease: EASE.spring },
                ],
              },
              0,
            );
            break;
          case "love": {
            hearts(4);
            const beat = gsap.fromTo(
              parts.l.concat(parts.r).filter((n) => n.dataset.eye === "heart"),
              { scale: 1 },
              {
                scale: 1.22,
                duration: 0.22,
                repeat: 5,
                yoyo: true,
                ease: EASE.breathe,
                transformOrigin: "50% 50%",
              },
            );
            loops.push(beat);
            gsap.to(hatch, { opacity: 1, duration: 0.2, ease: EASE.fadeIn });
            break;
          }
          case "laugh":
            tl.to(head, {
              keyframes: [
                { y: -16, rotation: 2, duration: 0.1 },
                { y: 0, rotation: -2, duration: 0.1 },
                { y: -12, rotation: 2, duration: 0.1 },
                { y: 0, rotation: -1, duration: 0.1 },
                { y: -8, rotation: 1, duration: 0.1 },
                { y: 0, rotation: 0, duration: 0.14 },
              ],
              ease: EASE.soft,
            });
            notes(1);
            break;
          case "shy":
            gazeHeld = true;
            aim(-0.75, 0.55);
            gsap.to(hatch, { opacity: 1, duration: 0.25, ease: EASE.fadeIn });
            tl.to(head, { rotation: -5, duration: 0.6, ease: EASE.default }, 0).fromTo(
              sweat,
              { x: 1000, y: 520, opacity: 0, scale: 0.4 },
              {
                keyframes: [
                  { opacity: 1, scale: FX, duration: 0.25, ease: EASE.pop },
                  { y: 640, duration: 0.9, ease: EASE.exit },
                  { opacity: 0, duration: 0.25, ease: EASE.fadeOut },
                ],
              },
              0.1,
            );
            break;
        }
        restIn(name === "shy" ? 1.9 : 1.6);
      };

      const dizzy = () => {
        const tl = begin("dizzy", "dizzy");
        bounce(1.4);
        gazeHeld = true;
        aim(0, 0);
        const spirals = parts.l.concat(parts.r).filter((n) => n.dataset.eye === "spiral");
        loops.push(
          gsap.to(spirals, {
            rotation: 360,
            transformOrigin: "50% 50%",
            duration: 0.7,
            repeat: -1,
            ease: EASE.linear,
          }),
        );
        // Stars round the crown: one angle, three stars a third apart, the
        // far side of the orbit smaller and fainter.
        const orbit = { a: 0 };
        loops.push(
          gsap.to(orbit, {
            a: Math.PI * 4,
            duration: 2.4,
            ease: EASE.linear,
            onUpdate: () => {
              stars.forEach((star, i) => {
                const a = orbit.a + (i * Math.PI * 2) / 3;
                const depth = (Math.sin(a) + 1) / 2;
                gsap.set(star, {
                  x: 560 + Math.cos(a) * 330,
                  y: 250 + Math.sin(a) * 70,
                  scale: (0.6 + depth * 0.6) * FX,
                  opacity: 0.35 + depth * 0.65,
                  rotation: (a * 180) / Math.PI,
                });
              });
            },
            onComplete: () => void gsap.set(stars, { opacity: 0 }),
          }),
        );
        tl.to(glassesAct, { rotation: -9, y: 18, duration: 0.3, ease: EASE.default }, 0)
          .fromTo(
            head,
            { rotation: -6 },
            { rotation: 6, duration: 0.3, repeat: 7, yoyo: true, ease: EASE.breathe },
            0,
          )
          // Snapping out of it: a quick shake, glasses pushed straight.
          .to(head, {
            keyframes: [
              { x: -14, rotation: -2, duration: 0.06 },
              { x: 14, rotation: 2, duration: 0.06 },
              { x: -10, duration: 0.06 },
              { x: 8, duration: 0.06 },
              { x: 0, rotation: 0, duration: 0.1 },
            ],
            ease: EASE.soft,
          })
          .add(() => {
            stopLoops();
            gsap.set(stars, { opacity: 0 });
            rest();
          });
      };

      /* ---- sleep ---------------------------------------------------- */

      let lastActive = performance.now();
      const fallAsleep = () => {
        const tl = begin("asleep", "asleep");
        gazeHeld = true;
        aim(0, 0.35);
        idle.timeScale(0.6);
        tl.to(head, { rotation: 5, y: 14, duration: 1.4, ease: EASE.travel }, 0);
        const snore = gsap.timeline({ repeat: -1, delay: 0.6 });
        snore.add(() => float(next.z(), 860, 470, rnd(120, 180), -240, rnd(0.8, 1.2), 1.9));
        snore.to({}, { duration: 1.1 });
        loops.push(snore);
      };
      const wake = () => {
        const tl = begin("surprised");
        exclaim();
        bounce(1.3);
        tl.to(head, { rotation: 0, y: 0, duration: 0.3, ease: EASE.pop }, 0);
        idle.timeScale(1);
        restIn(1.1);
      };
      const stir = () => {
        lastActive = performance.now();
        if (state === "asleep") wake();
      };

      /* ---- patting -------------------------------------------------- */

      // A pat is the pointer going back and forth over the hair: two changes
      // of direction, each after a real stroke, within a short while.
      let patDir = 0;
      let patRun = 0;
      let patTurns = 0;
      let patLast = 0;
      let heartAt = 0;
      let patEnd: gsap.core.Tween | null = null;
      const onHairMove = (e: PointerEvent) => {
        if (!isFinePointer() || state === "dizzy") return;
        if (!(e.target as Element).closest("[data-pat]")) return;
        const now = performance.now();
        if (now - patLast > 500) {
          patTurns = 0;
          patRun = 0;
        }
        patLast = now;
        const dir = Math.sign(e.movementX);
        if (dir !== 0 && dir !== patDir) {
          if (patRun > 24) patTurns++;
          patDir = dir;
          patRun = 0;
        }
        patRun += Math.abs(e.movementX);
        if (patTurns < 2) return;
        if (state !== "pat") {
          const tl = begin("pat", "pat");
          gsap.to(hatch, { opacity: 1, duration: 0.3, ease: EASE.fadeIn });
          tl.to(head, { rotation: aimX > 0 ? 4 : -4, y: 6, duration: 0.5, ease: EASE.default });
        }
        if (now - heartAt > 320) {
          heartAt = now;
          hearts(1, 560, 240, 360);
        }
        patEnd?.kill();
        patEnd = gsap.delayedCall(0.7, () => {
          patTurns = 0;
          if (state === "pat") rest();
        });
      };

      /* ---- input ---------------------------------------------------- */

      let pokeIndex = 0;
      let clicks: number[] = [];
      const onClick = () => {
        const now = performance.now();
        lastActive = now;
        if (state === "asleep") return wake();
        if (state === "dizzy") return;
        clicks = clicks.filter((t) => now - t < DIZZY_WINDOW);
        clicks.push(now);
        if (clicks.length >= DIZZY_CLICKS) {
          clicks = [];
          return dizzy();
        }
        poke(POKES[pokeIndex++ % POKES.length]!);
      };

      let visible = false;
      const onPointer = (e: PointerEvent) => {
        stir();
        lastPointer = performance.now();
        if (visible && !gazeHeld) lookAt(e.clientX, e.clientY);
      };
      let glintAt = 0;
      const onEnter = () => {
        const now = performance.now();
        if (now - glintAt > 4000 && state === "rest") {
          glintAt = now;
          glintSweep();
        }
      };

      /* ---- the clock: blinks, glances, sleep --------------------------- */

      const blink = () => {
        if (!visible || state !== "rest") return;
        const tl = gsap
          .timeline()
          .to(lids, { scaleY: 0.08, duration: 0.07, ease: EASE.exit })
          .to(lids, { scaleY: 1, duration: 0.12, ease: EASE.default });
        if (Math.random() < 0.2) {
          tl.to(lids, { scaleY: 0.08, duration: 0.07, ease: EASE.exit }).to(lids, {
            scaleY: 1,
            duration: 0.12,
            ease: EASE.default,
          });
        }
      };
      let blinkCall: gsap.core.Tween | null = null;
      const scheduleBlink = () => {
        blinkCall = gsap.delayedCall(rnd(2.2, 5.5), () => {
          blink();
          scheduleBlink();
        });
      };
      // With no pointer to follow (a phone, or a still mouse), he glances
      // about on his own.
      let glanceCall: gsap.core.Tween | null = null;
      const scheduleGlance = () => {
        glanceCall = gsap.delayedCall(rnd(2.5, 5), () => {
          const idleFor = performance.now() - lastPointer;
          if (visible && state === "rest" && !gazeHeld && idleFor > 3000) {
            aim(rnd(-0.7, 0.7), rnd(-0.5, 0.5));
          }
          if (visible && state === "rest" && performance.now() - lastActive > SLEEP_AFTER) {
            fallAsleep();
          }
          scheduleGlance();
        });
      };

      const io = new IntersectionObserver(([entry]) => {
        const was = visible;
        visible = entry?.isIntersecting ?? false;
        if (visible && !was) {
          idle.play();
          if (!blinkCall) scheduleBlink();
          if (!glanceCall) scheduleGlance();
          forget();
        } else if (!visible && was) {
          idle.pause();
          blinkCall?.kill();
          glanceCall?.kill();
          blinkCall = glanceCall = null;
        }
      });
      io.observe(btn);

      btn.addEventListener("click", onClick);
      btn.addEventListener("pointerenter", onEnter);
      btn.addEventListener("pointermove", onHairMove);
      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("pointerdown", onPointer, { passive: true });
      window.addEventListener("scroll", forget, { passive: true });
      window.addEventListener("resize", forget, { passive: true });
      window.addEventListener("keydown", stir);
      window.addEventListener("wheel", stir, { passive: true });

      return () => {
        io.disconnect();
        btn.removeEventListener("click", onClick);
        btn.removeEventListener("pointerenter", onEnter);
        btn.removeEventListener("pointermove", onHairMove);
        window.removeEventListener("pointermove", onPointer);
        window.removeEventListener("pointerdown", onPointer);
        window.removeEventListener("scroll", forget);
        window.removeEventListener("resize", forget);
        window.removeEventListener("keydown", stir);
        window.removeEventListener("wheel", stir);
        blinkCall?.kill();
        glanceCall?.kill();
        hold?.kill();
        patEnd?.kill();
        stopLoops();
      };
    },
    { scope: buttonRef },
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        className="block aspect-square w-full cursor-pointer touch-manipulation rounded-[24%] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        {children}
      </button>
      <span
        aria-hidden="true"
        className="font-mono text-meta uppercase tracking-meta text-fg-tertiary"
      >
        {hint}
      </span>
    </div>
  );
}
