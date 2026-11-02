export const MAGAZINE_CSS = `
.mag-study { width: 100%; max-width: 880px; margin-inline: auto; }
.mag-stage {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 640px;
  padding: 64px 32px;
  isolation: isolate;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: radial-gradient(ellipse at 50% 38%, color-mix(in srgb, var(--accent) 6%, transparent), transparent 65%), var(--surface);
}
.mag-stage::after {
  content: "";
  position: absolute;
  z-index: -1;
  bottom: 52px;
  left: 27%;
  width: 46%;
  height: 25px;
  border-radius: 50%;
  background: var(--sticker-shadow-color);
  filter: blur(18px);
  opacity: .5;
}
.mag-stage-note {
  position: absolute;
  top: 22px;
  left: 24px;
  font: 10px var(--font-stack-mono);
  letter-spacing: .14em;
  color: var(--fg-tertiary);
  text-transform: uppercase;
}
.mag-html { display: grid; place-items: center; width: 100%; }
.mag-stage[data-view="3d"] .mag-html { visibility: hidden; }
.mag-cover {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(340px, calc(100vw - 8rem));
  margin: 0;
  padding: 24px;
  box-sizing: border-box;
  color: var(--fg);
  background: var(--bg);
  border: 1px solid color-mix(in srgb, var(--fg) 16%, var(--bg));
  border-radius: 2px 8px 8px 2px;
  font-family: var(--font-stack-sans);
  box-shadow: var(--elev-lift);
}
.mag-cover::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 5px;
  width: 1px;
  background: var(--line);
}
.mag-masthead { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.mag-masthead > span:first-child { font: 600 38px/1 var(--font-stack-accent); letter-spacing: -.06em; }
.mag-edition { max-width: 90px; text-align: right; white-space: pre-line; font: 9px/1.6 var(--font-stack-mono); letter-spacing: .08em; }
.mag-art { position: relative; height: 168px; margin-top: 22px; overflow: hidden; border-block: 1px solid var(--line); }
.mag-orbit { position: absolute; width: 224px; height: 96px; border: 1px solid var(--accent); border-radius: 50%; opacity: .7; }
.mag-orbit-one { top: 30px; left: 16px; transform: rotate(-32deg); }
.mag-orbit-two { top: 30px; left: 16px; transform: rotate(32deg); }
.mag-sun { position: absolute; top: 35px; left: 92px; width: 82px; height: 82px; border-radius: 50%; background: var(--accent); }
.mag-art-index { position: absolute; bottom: 2px; right: 0; color: var(--fg); font: 300 76px/1 var(--font-stack-accent); letter-spacing: -.08em; }
.mag-art-caption { position: absolute; bottom: 9px; left: 0; max-width: 115px; color: var(--fg-tertiary); font: 8px/1.5 var(--font-stack-mono); letter-spacing: .09em; }
.mag-copy { padding-block: 20px; }
.mag-kicker { margin: 0 0 10px; font: 10px/1.5 var(--font-stack-mono); letter-spacing: .1em; color: var(--accent); text-transform: uppercase; }
.mag-cover h2 { margin: 0; white-space: pre-line; font-size: 38px; font-weight: 650; line-height: 1.12; letter-spacing: -.035em; }
.mag-cover h2:lang(zh) { letter-spacing: .01em; line-height: 1.25; }
.mag-deck { margin: 14px 0 0; color: var(--fg-secondary); font-size: 12px; line-height: 1.7; }
.mag-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; border-top: 1px solid var(--line); padding-top: 8px; }
.mag-read, .mag-save { display: inline-flex; align-items: center; gap: 7px; min-height: 44px; padding: 0; color: var(--fg); font: 11px/1.4 var(--font-stack-mono); text-decoration: none; }
.mag-read { text-decoration: underline; text-decoration-color: var(--line); text-underline-offset: 4px; }
.mag-save { background: none; border: 0; cursor: pointer; }
.mag-read:hover, .mag-save:hover, .mag-save[aria-pressed="true"] { color: var(--accent); }
.mag-read:focus-visible, .mag-save:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.mag-canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; opacity: 0; }
.mag-canvas .mag-cover { position: absolute; top: 0; left: 0; transform-origin: 0 0; box-shadow: none; }
.mag-stage[data-view="3d"] .mag-canvas { opacity: 1; }
.mag-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; padding-block: 20px 10px; }
.mag-status { margin: 0; color: var(--fg-secondary); font: 10px/1.6 var(--font-stack-mono); letter-spacing: .04em; }
.mag-status::before { content: ""; display: inline-block; width: 5px; height: 5px; margin-right: 8px; border-radius: 50%; background: var(--accent); }
.mag-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.mag-turn { display: flex; border: 1px solid var(--line); border-radius: 999px; }
.mag-turn button { min-width: 44px; min-height: 44px; padding-inline: 10px; color: var(--fg); background: transparent; border: 0; border-radius: 999px; font-size: 12px; cursor: pointer; }
.mag-turn button:disabled { opacity: .4; cursor: default; }
.mag-turn button:hover:enabled { color: var(--accent); }
.mag-hint { margin: 0; color: var(--fg-tertiary); font-size: 12px; line-height: 1.7; }
@media (max-width: 480px) {
  .mag-stage { min-height: 570px; padding: 60px 14px; }
  .mag-stage-note { left: 16px; font-size: 9px; }
  .mag-cover { padding: 20px; }
  .mag-cover h2 { font-size: 30px; }
  .mag-art { height: 138px; }
  .mag-orbit { left: -12px; top: 22px; width: 190px; height: 80px; }
  .mag-sun { left: 50px; top: 28px; width: 68px; height: 68px; }
  .mag-masthead > span:first-child { font-size: 32px; }
  .mag-edition { font-size: 8px; }
}
@media print {
  .mag-canvas, .mag-controls { display: none; }
  .mag-stage[data-view="3d"] .mag-html { visibility: visible; }
}
`;
