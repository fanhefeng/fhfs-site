import type Lenis from "lenis";

declare global {
  interface Window {
    /**
     * The one Lenis instance (components/fx/SmoothScroll), shared so the
     * overlays can pause scrolling (lib/client/scrollLock) and the scripts that jump
     * can go through it. Null or absent under reduced motion, where the
     * browser keeps its own scrolling.
     */
    __lenis?: Lenis | null;
  }
}
