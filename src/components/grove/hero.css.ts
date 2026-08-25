/**
 * The grove's stylesheet.
 *
 * One design unit — 1u is 1px on a 1600 × 880 reference frame — and every
 * measurement in the composition is written in it. That is what lets the moss
 * be pinned to the copy: the scene solves its camera so one world unit is one
 * CSS pixel, so both are working in the same coordinates. Change the unit and
 * the whole picture scales; nothing reflows.
 */
export const GROVE_CSS = `
/* The hero brings its own chrome — the dock — so the site's header stands
   down while the hero is on screen and comes back once the reader has
   scrolled past it (GroveHero flips the body attribute from an
   IntersectionObserver). Scoped through :has() rather than a layout of its
   own, because the locale layout is the root layout — there is no level above
   it to opt out at. The footer stays: the hero is the cover of a page that
   goes on below it, not a page of its own. */
body:has(.gh-hero) > header {
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.35s ease-out, visibility 0.35s;
}
body[data-grove-header="visible"] > header {
  opacity: 1;
  visibility: visible;
}
body:has(.gh-hero) { overflow-x: hidden; }

.gh-hero {
  --gh-u: calc(100vw / 1600);
  --gh-ink: #ffffff;
  --gh-soft: rgba(255, 255, 255, 0.62);
  --gh-faint: rgba(255, 255, 255, 0.44);
  --gh-rule: rgba(255, 255, 255, 0.055);
  --gh-card: #f2f3ef;
  --gh-card-ink: #23261f;
  --gh-card-label: #7c8177;
  --gh-ease: cubic-bezier(0.22, 0.61, 0.36, 1);
  --gh-ease-out: cubic-bezier(0.16, 1, 0.3, 1);

  position: relative;
  width: 100%;
  height: 100svh;
  min-height: calc(880 * var(--gh-u));
  overflow: hidden;
  isolation: isolate;
  font-weight: 300;
  color: var(--gh-ink);
  /* Near-flat corner to corner — all the modelling comes from the pool of
     light the root stands in. */
  background:
    radial-gradient(64% 52% at 27% 84%, rgba(232, 238, 222, 0.085) 0%, rgba(232, 238, 222, 0) 72%),
    radial-gradient(70% 60% at 92% 8%, rgba(24, 28, 20, 0.1) 0%, rgba(24, 28, 20, 0) 68%),
    #4a4d44;
}
@media (min-width: 1900px) { .gh-hero { --gh-u: calc(1900px / 1600); } }

/* The floor of light: the ground climbs from the nav down to the bottom edge,
   brightest around the middle of it. */
.gh-hero::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(72% 44% at 50% 117%, rgba(238, 243, 231, 0.5) 0%, rgba(238, 243, 231, 0.21) 42%, rgba(238, 243, 231, 0.04) 72%, rgba(238, 243, 231, 0) 88%),
    linear-gradient(180deg, rgba(238, 243, 231, 0) 54%, rgba(238, 243, 231, 0.03) 78%, rgba(238, 243, 231, 0.085) 100%);
  pointer-events: none;
  z-index: 0;
}

/* Centred with margins rather than a transform on purpose: a transform would
   open a stacking context and trap every child below the canvas. */
.gh-stage {
  position: absolute;
  left: 50%;
  top: 50%;
  margin-left: calc(-800 * var(--gh-u));
  margin-top: calc(-440 * var(--gh-u));
  width: calc(1600 * var(--gh-u));
  height: calc(880 * var(--gh-u));
}

.gh-guides { position: absolute; inset: calc(-40 * var(--gh-u)) 0; z-index: 1; pointer-events: none; }
.gh-guides i {
  position: absolute; top: 0; bottom: 0; width: 1px;
  background: linear-gradient(180deg, rgba(255,255,255,0) 0%, var(--gh-rule) 12%, var(--gh-rule) 78%, rgba(255,255,255,0) 100%);
}

.gh-ghost {
  position: absolute; z-index: 1;
  left: calc(6 * var(--gh-u)); bottom: calc(-64 * var(--gh-u));
  font-size: calc(310 * var(--gh-u));
  line-height: 0.78; font-weight: 400;
  letter-spacing: calc(30 * var(--gh-u));
  color: rgba(255, 255, 255, 0.055);
  white-space: nowrap; user-select: none; pointer-events: none;
}

/* z 3 — above card one, below everything else */
.gh-scene {
  position: absolute; inset: 0; z-index: 3;
  width: 100%; height: 100%;
  pointer-events: none;
  opacity: 0; transition: opacity 0.7s var(--gh-ease);
}
.gh-hero[data-ready] .gh-scene { opacity: 1; transition: opacity 0.45s var(--gh-ease); }

/* ── the dock ─────────────────────────────────────────────────────────── */
.gh-dock-wrap {
  position: absolute; z-index: 5;
  top: calc(38 * var(--gh-u)); left: 0; right: 0;
  display: flex; justify-content: center;
  pointer-events: none;
}
.gh-dock {
  position: relative;
  pointer-events: auto;
  display: flex; align-items: flex-start; gap: calc(3 * var(--gh-u));
  height: calc(46 * var(--gh-u));
  padding: calc(5 * var(--gh-u));
  border-radius: calc(14 * var(--gh-u));
  border: 1px solid rgba(255, 255, 255, 0.11);
  /* No backdrop-filter. It sits over a canvas that repaints every frame, so
     the backdrop would have to be re-sampled and re-blurred every frame too —
     measured at about 20fps off the whole page, and the radius made no
     difference because the cost is the extra pass, not the blur. A translucent
     panel with a lit top edge reads the same at this size. */
  background:
    linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0) 42%),
    rgba(34, 40, 31, 0.74);
  box-shadow: 0 calc(8 * var(--gh-u)) calc(22 * var(--gh-u)) rgba(10, 14, 8, 0.3),
              inset 0 1px rgba(255, 255, 255, 0.06);
  isolation: isolate;
}
/* Anchored at the top so growth runs downward, out of the headline's way — a
   dock that grew from its centre would push into the nav's own row. */
.gh-dock-item {
  position: relative; z-index: 6;
  display: inline-flex; align-items: center; justify-content: center;
  flex: none;
  height: calc(36 * var(--gh-u));
  gap: calc(8 * var(--gh-u));
  padding: 0 calc(13 * var(--gh-u));
  transform-origin: 50% 0;
  border: 1px solid transparent;
  border-radius: calc(10 * var(--gh-u));
  background: rgba(255, 255, 255, 0.04);
  color: var(--gh-faint);
  text-decoration: none; cursor: pointer;
  font-size: calc(11 * var(--gh-u)); font-weight: 500;
  letter-spacing: calc(1.5 * var(--gh-u)); text-transform: uppercase;
  white-space: nowrap;
  will-change: width, height, transform;
  transition: color 0.18s var(--gh-ease), border-color 0.2s var(--gh-ease), background 0.2s var(--gh-ease);
}
/* A magnified pill hangs below the capsule, so it needs to be its own opaque
   tile — a translucent white wash at that size reads as a milky rectangle
   stuck to the bar rather than as a key lifting off it. */
.gh-dock-item[data-near="true"] {
  z-index: 7;
  color: var(--gh-ink);
  border-color: rgba(255, 255, 255, 0.19);
  background: rgba(31, 37, 28, 0.94);
  box-shadow: 0 calc(7 * var(--gh-u)) calc(16 * var(--gh-u)) rgba(10, 14, 8, 0.3);
}
.gh-glyph { width: calc(14 * var(--gh-u)); height: calc(14 * var(--gh-u)); flex: none; opacity: 0.66; transition: opacity 0.18s var(--gh-ease); }
.gh-glyph svg { display: block; width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 1.25; stroke-linecap: round; stroke-linejoin: round; }
.gh-dock-item[data-near="true"] .gh-glyph { opacity: 1; }

/* the mark is the dock's anchor: the one opaque thing in a bar made of glass */
.gh-dock-mark { width: calc(36 * var(--gh-u)); padding: 0; background: #eef1e7; border-color: #eef1e7; color: #23261f; overflow: hidden; }
.gh-dock-mark svg { width: 58%; height: 58%; display: block; fill: currentColor; }
.gh-dock-mark[data-near="true"] { background: #fff; border-color: #fff; color: #1b1e18; }

/* the current section wears the cards' paper, so nav and cards read as one material */
.gh-dock-item.is-active { background: var(--gh-card); border-color: var(--gh-card); color: var(--gh-card-ink); box-shadow: 0 calc(6 * var(--gh-u)) calc(16 * var(--gh-u)) rgba(12, 17, 9, 0.24); }
.gh-dock-item.is-active .gh-glyph { opacity: 0.8; }

/* ── specular rim ──────────────────────────────────────────────────────
   A conic gradient masked down to the border, whose start angle points at the
   pointer and whose opacity falls off with distance. It is the reason the
   glass reads as a lit edge rather than as a flat translucent box. */
.gh-hero [data-spec] { --spec-angle: 2.4rad; --spec-bright: 0; }
.gh-hero [data-spec]::after {
  content: ""; position: absolute; inset: -1px; z-index: 5;
  padding: 1px; border-radius: inherit; pointer-events: none;
  opacity: var(--spec-bright);
  background: conic-gradient(from var(--spec-angle) at 50% 50%,
    rgba(240,246,232,0) 0deg, rgba(240,246,232,.08) 14deg, rgba(240,246,232,.95) 28deg,
    rgba(240,246,232,.16) 46deg, rgba(240,246,232,0) 68deg, rgba(240,246,232,0) 180deg,
    rgba(240,246,232,.08) 194deg, rgba(240,246,232,.95) 208deg, rgba(240,246,232,.16) 226deg,
    rgba(240,246,232,0) 248deg, rgba(240,246,232,0) 360deg);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}

/* ── hero copy (z 4) ──────────────────────────────────────────────────── */
.gh-headline {
  position: absolute; z-index: 4;
  left: calc(46 * var(--gh-u)); top: calc(202 * var(--gh-u));
  font-size: calc(63 * var(--gh-u)); line-height: calc(65 * var(--gh-u));
  font-weight: 300; letter-spacing: calc(-0.4 * var(--gh-u));
  color: var(--gh-ink);
}
/* No overflow clip: cropping a 63u face to wipe it in cuts the descenders at
   the moment they land. */
.gh-headline span { display: block; padding-bottom: 0.04em; }
.gh-headline span i { display: inline-block; font-style: normal; }

.gh-lede {
  position: absolute; z-index: 4;
  left: calc(520 * var(--gh-u)); top: calc(196 * var(--gh-u));
  width: calc(220 * var(--gh-u));
  font-size: calc(16.5 * var(--gh-u)); line-height: calc(24 * var(--gh-u));
  font-weight: 300; color: var(--gh-soft);
}

/* ── the two liquid-metal controls ────────────────────────────────────── */
.gh-pill {
  position: absolute; z-index: 4;
  left: calc(644 * var(--gh-u)); top: calc(360 * var(--gh-u));
  width: calc(410 * var(--gh-u)); height: calc(270 * var(--gh-u));
  margin: calc(-135 * var(--gh-u)) 0 0 calc(-205 * var(--gh-u));
  display: grid; place-items: center;
}
.gh-play {
  position: absolute; z-index: 4; pointer-events: none;
  left: calc(187 * var(--gh-u)); top: calc(431 * var(--gh-u));
  width: calc(170 * var(--gh-u)); height: calc(170 * var(--gh-u));
}
.gh-play > * { pointer-events: auto; }
.gh-play-glass { position: absolute; inset: calc(-113 * var(--gh-u)); display: block; }
/* Centred by the translate property rather than by the grid it used to sit
   in. The bloom
   pad is four times the button across, and a grid centres an item that
   overflows its track by aligning it to the START — which put the disc a third
   of a screen down and to the right of its own ring. It uses translate and
   not transform, so the parallax on the layers above keeps sole ownership of
   that property. */
.gh-play-glass .lp-pad { position: absolute; left: 50%; top: 50%; translate: -50% -50%; }
/* fills .gh-play, so it is concentric with the button by construction */
.gh-play-ring { position: absolute; inset: 0; pointer-events: none; border: 1px solid rgba(255,255,255,0.17); border-radius: 50%; }
.gh-play-ring::after {
  content: ""; position: absolute; inset: calc(-1 * var(--gh-u));
  border: 1px solid rgba(255,255,255,0.32); border-radius: 50%;
  opacity: 0; transform: scale(0.86);
  transition: opacity 0.7s var(--gh-ease), transform 0.9s var(--gh-ease-out);
}
.gh-play:hover .gh-play-ring::after { opacity: 1; transform: scale(1.06); }

/* the liquid-metal control itself */
.lp-pad {
  position: relative;
  display: grid;
  place-items: center;
  width: max-content;
  height: max-content;
  padding: var(--lp-pad);
  touch-action: manipulation;
}
.lp-plate {
  position: absolute; inset: var(--lp-pad);
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.085), rgba(255,255,255,0.014) 44%, rgba(255,255,255,0) 64%),
    rgba(10, 12, 10, 0.42);
  box-shadow:
    0 calc(var(--lp-h) * 0.08) calc(var(--lp-h) * 0.18) rgba(0,0,0,0.38),
    0 calc(var(--lp-h) * 0.24) calc(var(--lp-h) * 0.5) rgba(0,0,0,0.28),
    0 calc(var(--lp-h) * 0.48) calc(var(--lp-h) * 0.96) rgba(0,0,0,0.16),
    inset 0 1px 0 rgba(255,255,255,0.13);
  transition: box-shadow 0.38s var(--gh-ease, cubic-bezier(0.22,0.61,0.36,1)),
              background 0.38s var(--gh-ease, cubic-bezier(0.22,0.61,0.36,1));
}
.lp-pad[data-hot] .lp-plate {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.105), rgba(255,255,255,0.02) 44%, rgba(255,255,255,0) 64%),
    rgba(8, 10, 8, 0.5);
  box-shadow:
    0 calc(var(--lp-h) * 0.1) calc(var(--lp-h) * 0.22) rgba(0,0,0,0.44),
    0 calc(var(--lp-h) * 0.32) calc(var(--lp-h) * 0.66) rgba(0,0,0,0.34),
    0 calc(var(--lp-h) * 0.66) calc(var(--lp-h) * 1.32) rgba(0,0,0,0.2),
    inset 0 1px 0 rgba(255,255,255,0.17);
}
.lp-pad[data-press] .lp-plate {
  box-shadow:
    0 calc(var(--lp-h) * 0.04) calc(var(--lp-h) * 0.11) rgba(0,0,0,0.46),
    0 calc(var(--lp-h) * 0.13) calc(var(--lp-h) * 0.32) rgba(0,0,0,0.36),
    0 calc(var(--lp-h) * 0.27) calc(var(--lp-h) * 0.62) rgba(0,0,0,0.22),
    inset 0 1px 0 rgba(255,255,255,0.1);
  transition-duration: 0.1s;
}
.lp-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; }
.lp-btn {
  position: relative;
  height: var(--lp-h);
  border: 0; background: none;
  border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-family: inherit; font-weight: 500; line-height: 1;
  text-decoration: none; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  outline: none;
}
.gh-pill .lp-btn {
  padding: 0 calc(var(--lp-h) * 0.434) 0 calc(var(--lp-h) * 0.184);
  gap: calc(var(--lp-h) * 0.217);
  font-size: calc(var(--lp-h) * 0.271);
}
.gh-pill-ico { width: calc(var(--lp-h) * 0.29); height: calc(var(--lp-h) * 0.29); display: block; flex: none; }
.gh-pill-lbl { display: block; transform: translateY(calc(var(--lp-h) * 0.004)); }
.gh-play-pill .lp-btn { width: var(--lp-h); padding: 0; }
.gh-play-ico { width: calc(var(--lp-h) * 0.42); height: calc(var(--lp-h) * 0.42); display: block; }

/* ── stats ────────────────────────────────────────────────────────────── */
.gh-stat { position: absolute; z-index: 4; display: flex; align-items: flex-start; gap: calc(9 * var(--gh-u)); margin: 0; }
.gh-stat--a { left: calc(1250 * var(--gh-u)); top: calc(216 * var(--gh-u)); }
.gh-stat--b { left: calc(1346 * var(--gh-u)); top: calc(326 * var(--gh-u)); }
.gh-mark { width: calc(32 * var(--gh-u)); height: calc(32 * var(--gh-u)); flex: none; margin-top: calc(2 * var(--gh-u)); color: rgba(255,255,255,0.34); }
.gh-mark svg { width: 100%; height: 100%; display: block; filter: drop-shadow(0 calc(2 * var(--gh-u)) calc(10 * var(--gh-u)) rgba(10,14,8,0.6)); }
.gh-stat dt { font-size: calc(13.5 * var(--gh-u)); font-weight: 300; color: var(--gh-soft); line-height: calc(19 * var(--gh-u)); }
.gh-stat dd { font-size: calc(13.5 * var(--gh-u)); font-weight: 600; color: var(--gh-ink); line-height: calc(21 * var(--gh-u)); margin: 0; }
.gh-stat dt, .gh-stat dd { text-shadow: 0 calc(2 * var(--gh-u)) calc(16 * var(--gh-u)) rgba(10,14,8,0.6); }

/* ── cards ────────────────────────────────────────────────────────────── */
.gh-card {
  position: absolute;
  --mr: calc(46 * var(--gh-u));
  background: var(--gh-card); border-radius: calc(46 * var(--gh-u));
  box-shadow: 0 calc(30 * var(--gh-u)) calc(70 * var(--gh-u)) rgba(16,21,13,0.3);
  transition: box-shadow 0.8s var(--gh-ease);
}
/* No z-index on card one, on purpose. z-index:auto keeps it out of its own
   stacking context, so the body paints under the canvas — the moss drapes over
   its shoulder — while the floating knob, at z 4, still sits in front. */
.gh-card--a { left: calc(890 * var(--gh-u)); top: calc(200 * var(--gh-u)); width: calc(330 * var(--gh-u)); height: calc(305 * var(--gh-u)); transform-origin: 50% 50%; }
.gh-card--b { z-index: 4; will-change: transform; left: calc(1237 * var(--gh-u)); top: calc(482 * var(--gh-u)); width: calc(328 * var(--gh-u)); height: calc(310 * var(--gh-u)); }
.gh-card-label { position: absolute; left: calc(38 * var(--gh-u)); font-size: calc(15.5 * var(--gh-u)); font-weight: 300; color: var(--gh-card-label); margin: 0; }
.gh-card-title { position: absolute; left: calc(38 * var(--gh-u)); font-size: calc(26.2 * var(--gh-u)); line-height: calc(29 * var(--gh-u)); font-weight: 400; letter-spacing: calc(-0.5 * var(--gh-u)); color: var(--gh-card-ink); margin: 0; }
.gh-card--a .gh-card-label { top: calc(152 * var(--gh-u)); }
.gh-card--a .gh-card-title { top: calc(177 * var(--gh-u)); width: calc(200 * var(--gh-u)); }
.gh-card--b .gh-card-label { top: calc(45 * var(--gh-u)); }
.gh-card--b .gh-card-title { top: calc(70 * var(--gh-u)); width: calc(252 * var(--gh-u)); }

/* Both cards carry a plate. The field note reads downward — label, title, then
   the photograph — so its window sits at the foot; the other reads the other
   way up. Same frame, mirrored. */
.gh-portal { position: absolute; left: calc(14 * var(--gh-u)); right: calc(14 * var(--gh-u)); border-radius: calc(34 * var(--gh-u)); overflow: hidden; isolation: isolate; background: #263025; margin: 0; }
.gh-card--b .gh-portal { bottom: calc(14 * var(--gh-u)); height: calc(158 * var(--gh-u)); }
.gh-card--a .gh-portal { top: calc(14 * var(--gh-u)); height: calc(122 * var(--gh-u)); }
/* The plate is its own depth plane. It travels against the card and the moss,
   so the landscape feels like a small window rather than a photograph glued to
   the surface. */
.gh-media {
  position: absolute; inset: calc(-9 * var(--gh-u)); z-index: 1; display: block;
  will-change: transform, clip-path;
  transform:
    perspective(900px)
    translate3d(calc(var(--px, 0) * -11px), calc(var(--py, 0) * -7px), 0)
    rotateY(calc(var(--px, 0) * -1.4deg))
    rotateX(calc(var(--py, 0) * 0.9deg));
  transform-origin: 50% 50%;
}
.gh-media img { width: 100%; height: 100%; object-fit: cover; display: block; transform: scale(1.08); filter: saturate(0.92) contrast(1.03); transition: transform 1.25s var(--gh-ease-out), filter 0.8s var(--gh-ease); }
.gh-card:hover .gh-media img { transform: scale(1.13); filter: saturate(1.04) contrast(1.04); }
.gh-card:hover { box-shadow: 0 calc(38 * var(--gh-u)) calc(84 * var(--gh-u)) rgba(16,21,13,0.36); }
.gh-pixel { position: absolute; inset: 0; z-index: 3; width: 100%; height: 100%; pointer-events: none; opacity: 0; mix-blend-mode: screen; }
/* The white scan rides the clip edge, so its centre travels the media box, not
   the figure's — .gh-media is overscanned by 9u on every side to give the
   parallax rotation somewhere to go. */
.gh-portal::after {
  content: ""; position: absolute; z-index: 2;
  filter: blur(calc(2 * var(--gh-u))); opacity: 0; pointer-events: none;
  top: 0; bottom: 0; width: 26%; left: calc(-13% - 9 * var(--gh-u));
  background: linear-gradient(90deg, transparent, rgba(229,244,209,0.2) 42%, rgba(252,255,246,0.72) 54%, transparent);
}

.gh-knob-float { position: absolute; z-index: 4; pointer-events: none; left: calc(1142 * var(--gh-u)); top: calc(427 * var(--gh-u)); width: calc(58 * var(--gh-u)); height: calc(58 * var(--gh-u)); transform-origin: calc(-87 * var(--gh-u)) calc(-74.5 * var(--gh-u)); }
.gh-knob-float > * { pointer-events: auto; }
.gh-knob {
  position: absolute; z-index: 4; right: calc(20 * var(--gh-u)); bottom: calc(20 * var(--gh-u));
  width: calc(58 * var(--gh-u)); height: calc(58 * var(--gh-u));
  border: 0; border-radius: 50%; cursor: pointer;
  background: #fbfcf8; display: grid; place-items: center;
  box-shadow: 0 calc(6 * var(--gh-u)) calc(16 * var(--gh-u)) rgba(16,21,13,0.18);
  transition: transform 0.5s var(--gh-ease-out), background 0.4s var(--gh-ease);
}
.gh-knob--float { left: 0; top: 0; right: auto; bottom: auto; }
.gh-card--b .gh-knob { width: calc(54 * var(--gh-u)); height: calc(54 * var(--gh-u)); right: calc(26 * var(--gh-u)); bottom: calc(26 * var(--gh-u)); }
.gh-knob svg { width: calc(19 * var(--gh-u)); height: calc(19 * var(--gh-u)); display: block; color: #3f453a; }
.gh-knob:hover { transform: scale(1.1) rotate(8deg); background: #fff; }

/* ── scroll cue ───────────────────────────────────────────────────────── */
.gh-scroll {
  position: absolute; z-index: 4;
  left: calc(846 * var(--gh-u)); top: calc(690 * var(--gh-u));
  display: flex; align-items: center; gap: calc(12 * var(--gh-u));
  writing-mode: vertical-rl;
  font-size: calc(11 * var(--gh-u)); font-weight: 400;
  letter-spacing: calc(4.4 * var(--gh-u));
  color: rgba(255,255,255,0.5);
  text-transform: uppercase; text-decoration: none;
}
.gh-track { position: relative; width: 1px; height: calc(56 * var(--gh-u)); background: rgba(255,255,255,0.18); overflow: hidden; }
.gh-track::after { content: ""; position: absolute; inset: 0 0 auto; height: 40%; background: rgba(255,255,255,0.75); animation: gh-trickle 2.6s var(--gh-ease) infinite; }
@keyframes gh-trickle {
  0% { transform: translateY(-105%); opacity: 0; }
  22% { opacity: 1; }
  78% { opacity: 1; }
  100% { transform: translateY(255%); opacity: 0; }
}

/* ── entrance ─────────────────────────────────────────────────────────
   Transform is reserved for the pointer parallax, so the reveal is done with
   clip-path. Once the intro has run the clip is dropped entirely — a live
   clip-path opens a stacking context, which would trap the floating knob under
   the moss. */
[data-js] .gh-hero .mask { clip-path: inset(100% 0 0 0 round var(--mr, 0px)); }
[data-js] .gh-hero[data-ready] .mask { clip-path: inset(0 0 0 0 round var(--mr, 0px)); transition: clip-path 1.05s var(--gh-ease-out) var(--d, 0ms); }
[data-js] .gh-hero .mask-circle { clip-path: circle(0% at 50% 50%); }
[data-js] .gh-hero[data-ready] .mask-circle { clip-path: circle(76% at 50% 50%); transition: clip-path 1.1s var(--gh-ease-out) var(--d, 0ms); }
[data-js] .gh-hero .fade { opacity: 0; }
[data-js] .gh-hero[data-ready] .fade { opacity: 1; transition: opacity 1.3s var(--gh-ease) var(--d, 0ms); }
.gh-hero[data-done] .mask, .gh-hero[data-done] .mask-circle { clip-path: none; transition: none; }

/* the dock drops in tile by tile; the capsule itself only fades, because a
   clip on it would cut the pills off as they magnify past its edge */
[data-js] .gh-dock { opacity: 0; }
[data-js] .gh-hero[data-ready] .gh-dock { opacity: 1; transition: opacity 0.8s var(--gh-ease) 80ms; }
[data-js] .gh-dock-item { clip-path: inset(0 0 105% 0); }
[data-js] .gh-hero[data-ready] .gh-dock-item {
  clip-path: inset(0 0 -30% 0);
  transition: clip-path 0.9s var(--gh-ease-out) var(--d, 0ms),
              color 0.18s var(--gh-ease), border-color 0.2s var(--gh-ease), background 0.2s var(--gh-ease);
}
.gh-hero[data-done] .gh-dock-item { clip-path: none; }

/* A short rise under a fade rather than a full-height wipe: with nothing
   cropping it, a 105% travel would start line one on top of line two. */
[data-js] .gh-headline span i { opacity: 0; transform: translateY(calc(16 * var(--gh-u))); }
[data-js] .gh-hero[data-ready] .gh-headline span i {
  opacity: 1; transform: none;
  transition: opacity 1.05s var(--gh-ease) var(--d, 0ms), transform 1.25s var(--gh-ease-out) var(--d, 0ms);
}

/* Each plate resolves like a low-bandwidth transmission: a stepped clip
   exposes the photograph while sampled pixel-dots gather along the advancing
   edge (the dots themselves are painted by canvas). */
[data-js] .gh-media { clip-path: inset(0 100% 0 0 round calc(25 * var(--gh-u))); }
[data-js] .gh-hero[data-ready] .gh-card--a .gh-media { animation: gh-cut 1.45s steps(12, end) 0.92s both; }
[data-js] .gh-hero[data-ready] .gh-card--b .gh-media { animation: gh-cut 1.45s steps(12, end) 1.08s both; }
[data-js] .gh-hero[data-ready] .gh-card--a .gh-portal::after { animation: gh-scan 1.45s steps(12, end) 0.92s both; }
[data-js] .gh-hero[data-ready] .gh-card--b .gh-portal::after { animation: gh-scan 1.45s steps(12, end) 1.08s both; }
.gh-hero[data-done] .gh-media { clip-path: none; animation: none; }
@keyframes gh-cut {
  from { clip-path: inset(0 100% 0 0 round calc(25 * var(--gh-u))); }
  to { clip-path: inset(0 0 0 0 round calc(25 * var(--gh-u))); }
}
/* The glow travels by animating its own offset, not by a translate percentage:
   a translate is a percentage of the glow's width, so the distance it covers
   would depend on the plate's proportions. In calc() the travel is exactly the
   media box at every breakpoint. */
@keyframes gh-scan {
  0% { left: calc(-13% - 9 * var(--gh-u)); opacity: 0; }
  10% { opacity: 0.75; }
  88% { opacity: 0.55; }
  100% { left: calc(87% + 9 * var(--gh-u)); opacity: 0; }
}

/* ── pointer parallax ─────────────────────────────────────────────────
   --px / --py are written on the hero once per frame (-1…1). Each layer
   declares how far it rides (--pd, px at full deflection) and how much it
   turns (--pr, degrees), which is what gives the plane its depth. */
.gh-hero .par {
  transform:
    perspective(1400px)
    translate3d(calc(var(--px, 0) * var(--pd, 0) * -1px), calc(var(--py, 0) * var(--pd, 0) * -0.62px), 0)
    rotateY(calc(var(--px, 0) * var(--pr, 0) * 1deg))
    rotateX(calc(var(--py, 0) * var(--pr, 0) * -0.7deg));
}

.gh-hero a:focus-visible, .gh-hero button:focus-visible {
  outline: 2px solid rgba(255,255,255,0.85);
  outline-offset: calc(4 * var(--gh-u));
  border-radius: calc(6 * var(--gh-u));
}
.gh-knob:focus-visible { outline-color: rgba(28,34,22,0.9); }

@media (prefers-reduced-motion: reduce) {
  [data-js] .gh-hero .mask,
  [data-js] .gh-hero .mask-circle,
  [data-js] .gh-hero .fade,
  [data-js] .gh-hero .gh-scene,
  [data-js] .gh-hero .gh-dock,
  [data-js] .gh-hero .gh-dock-item,
  [data-js] .gh-hero .gh-headline span i {
    opacity: 1 !important; clip-path: none !important; transform: none !important; transition: none !important;
  }
  .gh-hero .par { transform: none !important; }
  [data-js] .gh-hero .gh-media { clip-path: none !important; animation: none !important; transform: none !important; }
  .gh-pixel, .gh-portal::after { display: none !important; }
  .gh-media img { transform: none !important; transition: none !important; }
  .gh-track::after { animation: none; }
}

/* ── narrow screens: one column, the moss a band between copy and cards ── */
@media (max-width: 900px) {
  .gh-hero { --gh-u: calc(100vw / 760); height: auto; min-height: 100svh; }
  .gh-stage { position: relative; left: auto; top: auto; margin: 0; width: 100%; height: calc(1625 * var(--gh-u)); }
  .gh-hero::after {
    background:
      radial-gradient(90% 30% at 50% 74%, rgba(238,243,231,0.4) 0%, rgba(238,243,231,0.14) 46%, rgba(238,243,231,0) 82%),
      linear-gradient(180deg, rgba(238,243,231,0) 62%, rgba(238,243,231,0.05) 100%);
  }
  .gh-guides i:nth-child(3) { display: none; }
  .gh-guides i:nth-child(1) { left: calc(253 * var(--gh-u)) !important; }
  .gh-guides i:nth-child(2) { left: calc(506 * var(--gh-u)) !important; }

  /* Floored with max(), not left on the design unit alone: this breakpoint
     runs from 900px down to 320px, so a pure-unit dock is a 24px bar with 12px
     targets on a phone. The floor only bites at the small end. */
  .gh-dock-wrap { top: calc(30 * var(--gh-u)); }
  .gh-dock { height: max(56px, calc(58 * var(--gh-u))); padding: max(6px, calc(6 * var(--gh-u))); gap: max(4px, calc(4 * var(--gh-u))); border-radius: max(17px, calc(18 * var(--gh-u))); }
  .gh-dock-item { height: max(44px, calc(46 * var(--gh-u))); width: max(44px, calc(46 * var(--gh-u))); padding: 0; border-radius: max(12px, calc(13 * var(--gh-u))); }
  .gh-dock-item span:not(.gh-glyph) { display: none; }
  .gh-glyph { width: max(19px, calc(20 * var(--gh-u))); height: max(19px, calc(20 * var(--gh-u))); }
  .gh-dock-mark svg { width: 52%; height: 52%; }

  .gh-headline { left: calc(34 * var(--gh-u)); top: calc(128 * var(--gh-u)); font-size: calc(62 * var(--gh-u)); line-height: calc(66 * var(--gh-u)); }
  .gh-lede { left: calc(34 * var(--gh-u)); top: calc(288 * var(--gh-u)); width: calc(400 * var(--gh-u)); font-size: calc(19 * var(--gh-u)); line-height: calc(27 * var(--gh-u)); }
  .gh-pill { left: calc(34 * var(--gh-u)); top: calc(430 * var(--gh-u)); width: calc(506 * var(--gh-u)); height: calc(334 * var(--gh-u)); margin: calc(-167 * var(--gh-u)) 0 0 calc(-79 * var(--gh-u)); }
  .gh-play { display: none; }

  .gh-stat { gap: calc(11 * var(--gh-u)); }
  .gh-mark { width: calc(36 * var(--gh-u)); height: calc(36 * var(--gh-u)); }
  .gh-stat dt { font-size: calc(16 * var(--gh-u)); line-height: calc(22 * var(--gh-u)); }
  .gh-stat dd { font-size: calc(16.5 * var(--gh-u)); line-height: calc(24 * var(--gh-u)); }
  .gh-stat--a { left: calc(34 * var(--gh-u)); top: calc(540 * var(--gh-u)); }
  .gh-stat--b { left: calc(396 * var(--gh-u)); top: calc(540 * var(--gh-u)); }

  .gh-card { border-radius: calc(40 * var(--gh-u)); --mr: calc(40 * var(--gh-u)); }
  .gh-card--a { left: calc(34 * var(--gh-u)); top: calc(1050 * var(--gh-u)); width: calc(692 * var(--gh-u)); height: calc(250 * var(--gh-u)); }
  .gh-card--a .gh-card-label { top: calc(96 * var(--gh-u)); }
  .gh-card--a .gh-card-title { top: calc(124 * var(--gh-u)); width: calc(400 * var(--gh-u)); font-size: calc(32 * var(--gh-u)); line-height: calc(36 * var(--gh-u)); }
  .gh-card--b { left: calc(34 * var(--gh-u)); top: calc(1324 * var(--gh-u)); width: calc(692 * var(--gh-u)); height: calc(268 * var(--gh-u)); }
  .gh-card--b .gh-card-title { font-size: calc(32 * var(--gh-u)); width: calc(340 * var(--gh-u)); }
  .gh-card--b .gh-portal { left: auto; right: calc(16 * var(--gh-u)); bottom: calc(16 * var(--gh-u)); width: calc(300 * var(--gh-u)); height: calc(150 * var(--gh-u)); }
  .gh-card--a .gh-portal { left: auto; right: calc(16 * var(--gh-u)); top: calc(16 * var(--gh-u)); width: calc(224 * var(--gh-u)); height: calc(218 * var(--gh-u)); }
  .gh-knob-float { left: calc(644 * var(--gh-u)); top: calc(1218 * var(--gh-u)); transform-origin: calc(-264 * var(--gh-u)) calc(-43 * var(--gh-u)); }
  .gh-card--b .gh-knob { right: calc(30 * var(--gh-u)); bottom: calc(30 * var(--gh-u)); }

  .gh-scroll { left: calc(702 * var(--gh-u)); top: calc(470 * var(--gh-u)); }
  .gh-ghost { font-size: calc(184 * var(--gh-u)); letter-spacing: calc(14 * var(--gh-u)); bottom: calc(660 * var(--gh-u)); left: calc(-10 * var(--gh-u)); }
}
`;
