import { THEME_INIT_SCRIPT } from "./themeInit";

/**
 * The pre-paint theme boot, handed to the browser as raw HTML rather than as a
 * React element.
 *
 * It has to stay inline. next/script defers even beforeInteractive through the
 * self.__next_s queue: measured here, that lands the theme 15ms *after* first
 * paint (a white flash for dark-mode readers), where an inline tag lands 8ms
 * before it.
 *
 * But a literal `<script>` element in the tree makes React 19 log "Encountered
 * a script tag while rendering React component" — accurate, since a script
 * React creates on the client never executes. A locale switch remounts the
 * whole `[locale]` layout subtree, so the tag was recreated on every switch and
 * the dev overlay raised it as an error each time.
 *
 * Wrapping the tag in a host element's innerHTML answers both: the SSR document
 * still carries a real inline script, which the HTML parser runs where it sits
 * (before first paint), while React only ever sees a `<div>` whose markup it is
 * told not to inspect. On a client remount the browser leaves the script inert
 * — which is exactly what should happen, because <html> keeps its data-theme
 * across a soft navigation and ThemeKeeper owns every later change.
 *
 * Alternatives, all measured and all worse: next/script (late by 15ms), moving
 * this into <head> (same warning, and Next asks you not to hand-write <head>),
 * hoisting the document to a top-level app/layout.tsx (loses the per-locale
 * <html lang> in the SSR output), dropping the script for ThemeKeeper alone
 * (first paint flashes for anyone whose choice differs from their OS).
 */
export function ThemeInitScript() {
  return (
    <div
      hidden
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: `<script>${THEME_INIT_SCRIPT}</script>`,
      }}
    />
  );
}
