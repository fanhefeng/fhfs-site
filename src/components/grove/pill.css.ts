/**
 * The liquid-metal control's own stylesheet.
 *
 * It used to live inside the grove hero's sheet, back when the only pill on
 * the site was the one standing in the moss. The hero is now two acts and the
 * pill is the site's single primary CTA (docs/DESIGN.md), so the rules travel
 * with the component instead: whoever renders a `<LiquidPill>` gets the plate,
 * the canvas and the button geometry, wherever it lands.
 *
 * Everything scales off `--lp-h`, the button's height, which the caller sets.
 */
export const PILL_CSS = `
.lp-pad {
  position: relative;
  display: grid;
  place-items: center;
  width: max-content;
  height: max-content;
  padding: var(--lp-pad);
  touch-action: manipulation;
  --lp-ease: cubic-bezier(0.22, 0.61, 0.36, 1);
  /* The plate's body. It was written for a control standing in a dark grove,
     where a 42%-black wash reads as glass over moss; on paper the same wash
     reads as a grey button. So the default is a solid near-black slug — the
     one heavy mark on the masthead — and the metal still pours over it under
     the pointer. A caller with a dark backdrop can hand back the wash. */
  --lp-plate: #1b1e18;
}
/* After hours the page itself is nearly black, so the same slug all but
   disappears into it. Lift it until it reads as an object on the paper again
   — the metal that pours over it is unchanged either way. */
[data-theme="dark"] .lp-pad { --lp-plate: #262a22; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .lp-pad { --lp-plate: #262a22; }
}
.lp-plate {
  position: absolute; inset: var(--lp-pad);
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.085), rgba(255,255,255,0.014) 44%, rgba(255,255,255,0) 64%),
    var(--lp-plate);
  box-shadow:
    0 calc(var(--lp-h) * 0.08) calc(var(--lp-h) * 0.18) rgba(60,42,22,0.30),
    0 calc(var(--lp-h) * 0.24) calc(var(--lp-h) * 0.5) rgba(60,42,22,0.20),
    0 calc(var(--lp-h) * 0.48) calc(var(--lp-h) * 0.96) rgba(60,42,22,0.12),
    inset 0 1px 0 rgba(255,255,255,0.13);
  transition: box-shadow 0.38s var(--lp-ease), background 0.38s var(--lp-ease);
}
.lp-pad[data-hot] .lp-plate {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.105), rgba(255,255,255,0.02) 44%, rgba(255,255,255,0) 64%),
    var(--lp-plate);
  box-shadow:
    0 calc(var(--lp-h) * 0.1) calc(var(--lp-h) * 0.22) rgba(60,42,22,0.36),
    0 calc(var(--lp-h) * 0.32) calc(var(--lp-h) * 0.66) rgba(60,42,22,0.26),
    0 calc(var(--lp-h) * 0.66) calc(var(--lp-h) * 1.32) rgba(60,42,22,0.15),
    inset 0 1px 0 rgba(255,255,255,0.17);
}
.lp-pad[data-press] .lp-plate {
  box-shadow:
    0 calc(var(--lp-h) * 0.04) calc(var(--lp-h) * 0.11) rgba(60,42,22,0.38),
    0 calc(var(--lp-h) * 0.13) calc(var(--lp-h) * 0.32) rgba(60,42,22,0.28),
    0 calc(var(--lp-h) * 0.27) calc(var(--lp-h) * 0.62) rgba(60,42,22,0.17),
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
  padding: 0 calc(var(--lp-h) * 0.434) 0 calc(var(--lp-h) * 0.184);
  gap: calc(var(--lp-h) * 0.217);
  font-size: calc(var(--lp-h) * 0.271);
}
.lp-ico { width: calc(var(--lp-h) * 0.29); height: calc(var(--lp-h) * 0.29); display: block; flex: none; }
.lp-lbl { display: block; transform: translateY(calc(var(--lp-h) * 0.004)); }

.lp-btn:focus-visible {
  outline: 2px solid rgba(255,255,255,0.85);
  outline-offset: calc(var(--lp-h) * 0.08);
}
`;
