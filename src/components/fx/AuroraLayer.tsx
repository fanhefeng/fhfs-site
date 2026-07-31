/**
 * Fixed ambient-light layer: one warm and one cool glow drifting behind the
 * whole page — the refraction backdrop every glass surface needs, and the
 * quiet descendant of the old neon. Pure CSS (gradients + 60–120s
 * transform-only breath, styles in globals.css), so this stays a Server
 * Component with zero client JS. Brighter after hours via --aurora-opacity;
 * static under prefers-reduced-motion and prefers-reduced-data.
 */
export function AuroraLayer() {
  return (
    <div aria-hidden className="aurora-layer">
      <div className="aurora-blob aurora-blob--warm" />
      <div className="aurora-blob aurora-blob--cool" />
    </div>
  );
}
