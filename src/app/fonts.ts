import localFont from "next/font/local";

/* Editorial Latin trio, unchanged when switching Chinese to Resource Han
 * Rounded (2026-10-16). globals.css places the shared Chinese family behind
 * each face, including mono and accent. Its variable unicode-range subsets
 * are self-hosted through rounded.css; no build downloads a font.
 *
 * Shared because `global-not-found` renders outside the [locale] root layout
 * and has to dress itself. */
const sans = localFont({
  src: "./font-files/Nunito.woff2",
  weight: "200 1000",
  style: "normal",
  variable: "--font-nunito",
  display: "swap",
});

/* Preload is reserved for Nunito, which sets the body copy. The other two
 * carry a handful of words each — an accent line, a line of meta — and
 * preloading all three had the browser fetching four files up front and
 * reporting them unused. They still load, just without the head start.
 *
 * The accent face is Josefin Sans since 2026-10-03 (DESIGN-LOG), the third
 * to stand there: Instrument Serif's condensed italic read cramped in a
 * sentence, and Lora's brushed italic was not liked either — nor was italic
 * itself. Josefin is a thin geometric sans with a low x-height, upright, the
 * lettering of a title card; it changes the voice without a slant. One
 * variable file carries both weights in use (light for a line at title size,
 * regular for a sentence); no italic is loaded, and a test keeps `italic`
 * away from it. */
const accent = localFont({
  src: "./font-files/JosefinSans.woff2",
  weight: "100 700",
  style: "normal",
  variable: "--font-josefin",
  display: "swap",
  preload: false,
});

const mono = localFont({
  src: "./font-files/GeistMono.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

/** Every font variable, ready to drop on <html>. */
export const fontVariables = [sans.variable, accent.variable, mono.variable].join(" ");
