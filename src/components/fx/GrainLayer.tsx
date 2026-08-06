/**
 * Paper-grain overlay: 2.5% SVG feTurbulence noise tiled over everything,
 * sitting above the glass layers so the big soft gradients (aurora, glass
 * shadows) never band. Styles live in globals.css; the drift animation is
 * barely-there and stopped under prefers-reduced-motion — it never ends on its
 * own, so it is one of the three CSS animations that keep that guard.
 */
export function GrainLayer() {
  return <div aria-hidden className="grain-layer" />;
}
