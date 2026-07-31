/**
 * Paper-grain overlay: 2.5% SVG feTurbulence noise tiled over everything,
 * sitting above the glass layers so the big soft gradients (aurora, glass
 * shadows) never band. Styles live in globals.css; the drift animation is
 * barely-there and disabled under prefers-reduced-motion.
 */
export function GrainLayer() {
  return <div aria-hidden className="grain-layer" />;
}
