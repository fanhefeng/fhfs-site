/**
 * The approach: the second and third acts of the cover.
 *
 * A sticky frame that the scrollbar opens. The grove is rendered at full
 * viewport size the whole way through and never resized — what travels is a
 * clip on the window in front of it, which is the only version of "push in"
 * that does not force the scene to re-solve its camera on every frame of the
 * scrub. The scene rides a small counter-scale on top, so the walk toward it
 * reads as a camera move rather than as a box being stretched.
 *
 * `--ga-open` (0 → 1) is written once per scroll frame by GroveApproach;
 * everything below is derived from it in the cascade.
 */
export const APPROACH_CSS = `
/* While the reader is standing inside the grove, the island's scroll-edge
   scrim — a band of the page's own paper — would lie across the canopy like a
   strip of tape. It is the one piece of site chrome the act switches off, and
   only for as long as the frame is full of moss: GroveApproach stamps the
   attribute when the window is open and the wash has not yet arrived. */
body[data-grove-immersed] .hd-scrim { opacity: 0; }

/* And while the canvas is actually being drawn (GroveScene stamps this for
   exactly that stretch), the two ambient layers and the island's blur stand
   down. Each of them is re-done by the compositor on every frame the canvas
   changes: the grain is an overlay-blended layer three viewports across, the
   blur re-reads and re-blurs its backdrop — together about a third of what a
   frame cost, for a 2.5% grain over moss and a blur over flat sky. The island
   goes to the same opaque paper it wears under prefers-reduced-transparency;
   the aurora fades rather than cuts, because a blob of light at the corner of
   the screen vanishing in one frame is the kind of thing the eye does catch.
   Outside any @layer so these win over the component rules. */
body[data-grove-live] .grain-layer { visibility: hidden; }
body[data-grove-live] .aurora-blob { opacity: 0; }
/* The scrim goes with them. On the home page the immersed flag already
   handles the hold; this covers the lab's stage study, where the canvas is
   the top of the frame from the first frame and the scrim would lie across
   the canopy as a strip of paper. Wherever the flag is up over paper (the
   walk in, the frame entering from below) a paper scrim is invisible anyway. */
body[data-grove-live] .hd-scrim { opacity: 0; }
body[data-grove-live] header .glass-thick {
  background-color: var(--surface-raised);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.ga {
  position: relative;
  /* Three viewports of travel: one to walk in, half a beat to stand still,
     and the rest for the paper to come down over it. */
  height: 320svh;
}

.ga-pin {
  position: sticky;
  top: 0;
  height: 100svh;
  overflow: hidden;
  background: var(--bg);
  isolation: isolate;

  /* One design unit of the 1600 × 880 stage. Vertical measurements taken in it
     are exact — the stage's own height is calculated from it — while the
     stage's *width* is the viewport's content box, which is this much narrower
     than 100vw by the width of the scrollbar. So: horizontal placement in
     percentages of the stage, everything else in units. */
  --ga-u: calc(100vw / 1600);
  --ga-paper: #f2f3ef;
  --ga-paper-ink: #23261f;
  --ga-paper-label: #7c8177;
  --ga-ease: cubic-bezier(0.22, 0.61, 0.36, 1);
}

.ga-window {
  position: absolute;
  inset: 0;
  z-index: 1;
}

/* Ground for the caption. The moss is bright and busy exactly where the type
   lands, so the type gets a floor to stand on rather than a heavier shadow.
   It rides the caption's own opacity, so it is only ever there while there is
   something to read.

   z 2, level with the canvas and painted after it: that puts it over the moss
   and over the card the moss covers, but under the card standing in front —
   which is the whole difference between a scrim and a lid. */
.ga-floor {
  position: absolute;
  inset: auto 0 0;
  height: 46%;
  z-index: 2;
  pointer-events: none;
  opacity: var(--ga-cap, 0);
  background: linear-gradient(180deg,
    rgba(16, 20, 14, 0) 0%,
    rgba(16, 20, 14, 0.28) 58%,
    rgba(16, 20, 14, 0.44) 100%);
}
/* Without JS the window is simply open — the scene stands at full bleed and
   the page reads top to bottom. The flag is stamped before first paint by the
   layout's boot script (themeInit.ts). */
[data-js] .ga-window {
  clip-path: inset(
    calc((1 - var(--ga-open, 0)) * 31%)
    calc((1 - var(--ga-open, 0)) * 29%)
    round calc((1 - var(--ga-open, 0)) * 22px)
  );
}

.ga-scene {
  position: absolute;
  inset: 0;
  /* The same near-flat ground the grove was lit against — all the modelling
     comes from the pool of light the root stands in. */
  background:
    radial-gradient(64% 52% at 27% 84%, rgba(232, 238, 222, 0.085) 0%, rgba(232, 238, 222, 0) 72%),
    radial-gradient(70% 60% at 92% 8%, rgba(24, 28, 20, 0.1) 0%, rgba(24, 28, 20, 0) 68%),
    #4a4d44;
  transform: scale(calc(1 + (1 - var(--ga-open, 0)) * 0.16));
  transform-origin: 50% 46%;
  will-change: transform;
}
.ga-scene::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(72% 44% at 50% 117%, rgba(238, 243, 231, 0.5) 0%, rgba(238, 243, 231, 0.21) 42%, rgba(238, 243, 231, 0.04) 72%, rgba(238, 243, 231, 0) 88%),
    linear-gradient(180deg, rgba(238, 243, 231, 0) 54%, rgba(238, 243, 231, 0.03) 78%, rgba(238, 243, 231, 0.085) 100%);
}

/* The 1600 × 880 frame the moss is pinned to, and the grid the two cards are
   placed on. The scene solves the roots against these same coordinates, which
   is what lets a card be positioned against a particular branch — under this
   one, in front of that one — and stay there at every viewport width.

   No transform, no isolation, no containment: any of them would open a
   stacking context here and trap both cards under the canvas. */
.ga-stage {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: calc(880 * (100vw / 1600));
  /* Not -440. Half the stage would centre the *stage*, and the root is not
     centred on it: the arch is placed at 306 units down and runs 936 tall, so
     the part of it that ever shows spans 306…880 and its middle sits at 593.
     Hanging the stage from that number is what puts the moss in the middle of
     the window instead of along its bottom edge.

     The second term is the flat-frame floor. The cards are laid out on the
     stage (card a's top at 160u), and the flatter the viewport the less of
     the stage's head is on screen, until on a 2:1 frame the card's top edge
     is the frame's. So the hang gives way as soon as it would put card a
     closer than 84px to the top (the island ends at 67px, and the card's
     upper left corner stands right beside it) — the moss and the pair come
     down together, the composition intact. At 16:10 the first term wins and
     nothing changes; a laptop's 16:9-ish viewport is already on the floor. */
  margin-top: max(
    calc(-593 * (100vw / 1600)),
    calc(84px - 50svh - 160 * (100vw / 1600))
  );
  pointer-events: none;
}

.ga-scene canvas.gh-scene {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.7s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.ga-scene[data-ready] canvas.gh-scene { opacity: 1; }

/* The paper wash that ends the act, above everything in the scene — the cards
   included, which is how they leave — and below the copy. */
.ga-dissolve {
  position: absolute;
  inset: 0;
  z-index: 4;
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
}

/* ── the cards ─────────────────────────────────────────────────────────
   Two plates standing in the grove, one on each side of the moss.

   Card a carries no z-index at all, on purpose: z-index auto keeps it out of a
   stacking context of its own, so it paints under the canvas and the root
   drapes over its shoulder. Card b sits at z 3 — over the canvas and over the
   caption's floor, under the paper wash. Card a's knob goes under the moss
   with the rest of the card, and that is right: a control floating in front
   of the trunk, belonging to a sheet behind it, was the one thing in the
   composition that contradicted itself. It sits on the corner of the card the
   trunk never reaches.

   Horizontal placement is a percentage of the stage, vertical is in units —
   see the note on --ga-u. */
.ga-card {
  position: absolute;
  opacity: var(--ga-card, 0);
  /* hidden, not just transparent: a card that has not arrived yet must not
     hold a tab stop or a line in the accessibility tree. */
  visibility: var(--ga-card-vis, hidden);
  pointer-events: none;
  /* Cheap while the section is off screen, and the transform below is only
     ever a compositor job. */
  will-change: transform, opacity;
}
.ga-card > * { pointer-events: var(--ga-card-hit, none); }

.ga-card {
  background: var(--ga-paper);
  border-radius: calc(46 * var(--ga-u));
  box-shadow: 0 calc(30 * var(--ga-u)) calc(70 * var(--ga-u)) rgba(16, 21, 13, 0.3);
  transition: box-shadow 0.8s var(--ga-ease);
  pointer-events: var(--ga-card-hit, none);
}
.ga-card:hover {
  box-shadow: 0 calc(38 * var(--ga-u)) calc(84 * var(--ga-u)) rgba(16, 21, 13, 0.36);
}

/* The pair stands on one diagonal, the standing trunk between them: it climbs
   across card a's lower right corner and card b stands in front of its foot
   with moss showing on three sides. That is the whole depth cue, and it is
   the *pair* that carries it: two sheets of the same paper at the same size,
   one root apart, so the eye has something to measure the distance against.

   Card b keeps the first composition's place (1237 × 482). Card a stood at
   890 × 200 there, which put the trunk's edge on the last characters of its
   title; it has moved up and left (860 × 160) so that what the trunk covers
   is the empty corner below the title and nothing that has to be read. The
   roots are placed on the stage in these same coordinates (GroveScene's
   boxes, geometry.ts's control points) and the stage is what the cards are
   laid out on, so hang the stage anywhere and the trunk crosses the card at
   the same place; what the approach's hang changes is only where the whole
   group sits in the frame — see .ga-stage.

   The pointer parallax turns the root group (GroveScene, ±0.055rad), which
   slides the trunk's crossing by a few tens of pixels either way — the reason
   the title is given that much room rather than just clearing the edge. */
.ga-card--a {
  left: calc(860 / 1600 * 100%);
  width: calc(330 / 1600 * 100%);
  top: calc(160 * var(--ga-u));
  height: calc(305 * var(--ga-u));
}
.ga-card--b {
  z-index: 3;
  left: calc(1237 / 1600 * 100%);
  width: calc(328 / 1600 * 100%);
  top: calc(482 * var(--ga-u));
  height: calc(310 * var(--ga-u));
}

.ga-card-label,
.ga-card-title {
  position: absolute;
  left: calc(38 * var(--ga-u));
  margin: 0;
}
.ga-card-label {
  font-size: calc(15.5 * var(--ga-u));
  font-weight: 300;
  color: var(--ga-paper-label);
}
.ga-card-title {
  font-size: calc(26.2 * var(--ga-u));
  line-height: calc(29 * var(--ga-u));
  font-weight: 400;
  letter-spacing: calc(-0.5 * var(--ga-u));
  color: var(--ga-paper-ink);
}
/* The original's tight stack: the title has to clear the trunk that crosses
   the card below it. */
.ga-card--a .ga-card-label { top: calc(152 * var(--ga-u)); }
.ga-card--a .ga-card-title { top: calc(177 * var(--ga-u)); width: calc(200 * var(--ga-u)); }
.ga-card--b .ga-card-label { top: calc(45 * var(--ga-u)); }
.ga-card--b .ga-card-title { top: calc(70 * var(--ga-u)); width: calc(252 * var(--ga-u)); }

/* Both cards carry a plate, and each reads toward it: the lab card is a
   photograph with a caption under it, the field note a note with a window at
   its foot. Same frame, mirrored — which also keeps each photograph on the
   side of its card that the moss is not covering. */
.ga-plate {
  position: absolute;
  left: calc(14 * var(--ga-u));
  right: calc(14 * var(--ga-u));
  margin: 0;
  border-radius: calc(34 * var(--ga-u));
  overflow: hidden;
  isolation: isolate;
  background: #263025;

  /* The plate resolves in twelve steps as the card comes up, the way the first
     version of this composition received its photographs — except that there
     the steps were on a clock, and here the scrollbar is the clock. round() is
     what makes a continuous scroll value land on stops; where it is not
     supported the whole declaration drops and the plate is simply open, which
     is the correct fallback. */
  --ga-cut: calc(round(down, var(--ga-card, 0) * 12, 1) / 12);
}
.ga-card--a .ga-plate { top: calc(14 * var(--ga-u)); height: calc(122 * var(--ga-u)); }
.ga-card--b .ga-plate { bottom: calc(14 * var(--ga-u)); height: calc(158 * var(--ga-u)); }

.ga-plate-media {
  position: absolute;
  inset: calc(-9 * var(--ga-u));
  z-index: 1;
  display: block;
  clip-path: inset(0 calc((1 - var(--ga-cut, 1)) * 100%) 0 0 round calc(25 * var(--ga-u)));
  /* Its own depth plane: the window travels against the card it is set into,
     so it reads as a view through rather than a picture glued on. The overscan
     above is what gives the rotation somewhere to go. */
  transform:
    perspective(900px)
    translate3d(calc(var(--px, 0) * -11px), calc(var(--py, 0) * -7px), 0)
    rotateY(calc(var(--px, 0) * -1.4deg))
    rotateX(calc(var(--py, 0) * 0.9deg));
}
.ga-plate-media img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  transform: scale(1.08);
  filter: saturate(0.92) contrast(1.03);
  transition: transform 1.25s cubic-bezier(0.16, 1, 0.3, 1), filter 0.8s var(--ga-ease);
}
.ga-card:hover .ga-plate-media img { transform: scale(1.13); filter: saturate(1.04) contrast(1.04); }

/* The scan rides the stepped edge. Its opacity peaks mid-travel and is zero at
   both ends, so a finished plate carries no glow and neither does an empty one. */
.ga-plate::after {
  content: "";
  position: absolute;
  z-index: 2;
  top: 0;
  bottom: 0;
  width: 26%;
  left: calc(var(--ga-cut, 1) * 100% - 13%);
  opacity: calc(var(--ga-cut, 1) * (1 - var(--ga-cut, 1)) * 3);
  filter: blur(calc(2 * var(--ga-u)));
  pointer-events: none;
  background: linear-gradient(90deg,
    transparent,
    rgba(229, 244, 209, 0.2) 42%,
    rgba(252, 255, 246, 0.72) 54%,
    transparent);
}

/* One fitting on both cards, on the outer corner of each photograph: card b's
   plate is at its foot, so lower right; card a's is at its head, so upper
   right — the same 26u in, mirrored with the rest of the card. Card a's is
   the corner the trunk never reaches, which is what lets the knob stay in
   the card rather than float in front of the moss. */
.ga-knob {
  position: absolute;
  display: grid;
  place-items: center;
  width: calc(58 * var(--ga-u));
  height: calc(58 * var(--ga-u));
  border-radius: 50%;
  background: #fbfcf8;
  box-shadow: 0 calc(6 * var(--ga-u)) calc(16 * var(--ga-u)) rgba(16, 21, 13, 0.18);
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), background 0.4s var(--ga-ease);
}
.ga-card--a .ga-knob {
  right: calc(26 * var(--ga-u));
  top: calc(26 * var(--ga-u));
  width: calc(54 * var(--ga-u));
  height: calc(54 * var(--ga-u));
}
.ga-card--b .ga-knob {
  right: calc(26 * var(--ga-u));
  bottom: calc(26 * var(--ga-u));
  width: calc(54 * var(--ga-u));
  height: calc(54 * var(--ga-u));
}
.ga-knob svg {
  width: calc(19 * var(--ga-u));
  height: calc(19 * var(--ga-u));
  display: block;
  color: #3f453a;
}
.ga-knob:hover { transform: scale(1.1) rotate(8deg); background: #fff; }
.ga-knob:focus-visible {
  outline: 2px solid rgba(28, 34, 22, 0.9);
  outline-offset: calc(3 * var(--ga-u));
}

/* ── pointer parallax ──────────────────────────────────────────────────
   --px / --py are written on the pin once per frame (-1…1). Each layer says
   how far it rides (--pd, px at full deflection) and how much it turns (--pr,
   degrees); the difference between the two cards' values is the depth between
   them. The same transform carries the rise the card comes up on, so the two
   never fight over the property. */
.ga-card {
  transform:
    perspective(1400px)
    translate3d(
      calc(var(--px, 0) * var(--pd, 0) * -1px),
      calc(var(--py, 0) * var(--pd, 0) * -0.62px + (1 - var(--ga-card, 0)) * 26 * var(--ga-u)),
      0)
    rotateY(calc(var(--px, 0) * var(--pr, 0) * 1deg))
    rotateX(calc(var(--py, 0) * var(--pr, 0) * -0.7deg));
}
/* Card b is nearer, so it rides further and turns more. */
.ga-card--a { --pd: 10; --pr: 2.2; }
.ga-card--b { --pd: 22; --pr: 2.4; }

/* Flat frames need no rule of their own: the stage's hang (see .ga-stage)
   gives way as the frame flattens, so the pair comes down with the moss and
   keeps its place against the trunk. */

@media (prefers-reduced-motion: reduce) {
  .ga-card,
  .ga-plate-media { transform: none !important; }
  .ga-plate-media { clip-path: none !important; }
  .ga-plate::after { display: none; }
  .ga-plate-media img { transform: none !important; transition: none !important; }
}

/* ── the caption ───────────────────────────────────────────────────────
   The one piece of copy in the act, and it only shows while the reader is
   standing inside the grove: it fades up as the window finishes opening and
   leaves before the paper arrives. */
.ga-cap {
  position: absolute;
  z-index: 4;
  left: 0;
  right: 0;
  bottom: clamp(2rem, 7svh, 4.5rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.55rem;
  padding: 0 1.5rem;
  text-align: center;
  color: #fff;
  opacity: var(--ga-cap, 0);
  visibility: var(--ga-cap-vis, hidden);
  pointer-events: var(--ga-cap-hit, none);
  text-shadow: 0 2px 18px rgba(10, 14, 8, 0.55);
}
.ga-cap-kicker {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.62);
}
.ga-cap-title {
  font-size: clamp(1.35rem, 2.6vw, 2rem);
  line-height: 1.2;
  letter-spacing: -0.015em;
  font-weight: 400;
  margin: 0;
  text-wrap: balance;
}
.ga-cap-link {
  margin-top: 0.35rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.82);
  text-decoration: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.28);
  padding-bottom: 2px;
  transition: color 0.25s ease-out, border-color 0.25s ease-out;
}
.ga-cap-link:hover { color: #fff; border-color: rgba(255, 255, 255, 0.7); }
.ga-cap-link:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.85);
  outline-offset: 4px;
  border-radius: 3px;
}

@media (max-width: 900px) {
  .ga { height: 300svh; }
  /* The narrow composition is traced against a 760-unit stage, so the unit has
     to follow it or every measurement above lands at less than half size. */
  .ga-pin { --ga-u: calc(100vw / 760); }
  /* A phone has no room for a postage stamp: the window starts as a wide
     band rather than as a small rectangle, and the roots are placed against
     the 760-unit stage the narrow composition was traced for. */
  [data-js] .ga-window {
    clip-path: inset(
      calc((1 - var(--ga-open, 0)) * 24%)
      calc((1 - var(--ga-open, 0)) * 7%)
      round calc((1 - var(--ga-open, 0)) * 18px)
    );
  }
  /* Same reasoning as the wide stage, against the narrow composition: the
     near arch is placed at 555 units down a 760-unit stage and stands 551
     tall, so its middle is at 830 — hang the stage from there and the moss
     lands in the middle of the phone's screen instead of along its floor. */
  .ga-stage {
    top: calc(50% - 830 * (100vw / 760));
    margin-top: 0;
    height: calc(1625 * (100vw / 760));
  }
  .ga-scene { transform: scale(calc(1 + (1 - var(--ga-open, 0)) * 0.1)); }

  /* One card on a phone, and it is the field note.

     The wide composition works because the arch crosses the frame as a
     diagonal band with clear air either side of it — a card can stand beside a
     branch and be clipped by its edge. Portrait has no beside: the near root
     fills the middle third from edge to edge, so a card placed behind it is not
     draped over, it is buried, and two cards leave nowhere for the moss to be
     seen between them. So the one that survives is the one the caption does not
     already say (the caption is the lab card, in words), and it stands in
     front, over the crest. */
  .ga-card--a { display: none; }

  .ga-card { border-radius: calc(40 * var(--ga-u)); }
  .ga-card--b {
    left: calc(60 / 760 * 100%);
    width: calc(640 / 760 * 100%);
    top: calc(510 * var(--ga-u));
    height: calc(440 * var(--ga-u));
  }

  .ga-card-label,
  .ga-card-title { left: calc(44 * var(--ga-u)); }
  .ga-card-label { font-size: calc(24 * var(--ga-u)); }
  .ga-card-title {
    font-size: calc(40 * var(--ga-u));
    line-height: calc(46 * var(--ga-u));
    width: calc(330 * var(--ga-u));
  }
  .ga-card--b .ga-plate { height: calc(240 * var(--ga-u)); }
  .ga-card--b .ga-card-label { top: calc(44 * var(--ga-u)); }
  .ga-card--b .ga-card-title { top: calc(78 * var(--ga-u)); width: calc(520 * var(--ga-u)); }

  /* 44px at the narrowest phone this is laid out for — a knob that reads as a
     detail on a desktop still has to be a touch target here. */
  .ga-card--b .ga-knob {
    width: calc(86 * var(--ga-u));
    height: calc(86 * var(--ga-u));
    right: calc(30 * var(--ga-u));
    bottom: calc(30 * var(--ga-u));
  }
  .ga-knob svg { width: calc(28 * var(--ga-u)); height: calc(28 * var(--ga-u)); }
}
`;
