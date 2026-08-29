import {
  Nunito,
  Instrument_Serif,
  Geist_Mono,
  Noto_Sans_SC,
  Noto_Serif_SC,
} from "next/font/google";

/* Editorial type trio + CJK fallbacks. globals.css assembles the runtime
 * stacks from these variables. Latin is Nunito — rounded terminals to sit
 * beside the Yozai rounded CJK face (self-hosted, see yozai.css); Songti
 * and the Noto webfonts remain the serif / last-resort fallbacks.
 *
 * Shared because `global-not-found` renders outside the [locale] root layout
 * and has to dress itself. */
const sans = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

/* Preload is reserved for Nunito, which sets the body copy. The other two
 * carry a handful of words each — an italic accent, a line of meta — and
 * preloading all three had the browser fetching four files up front and
 * reporting them unused. They still load, just without the head start. */
const serif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
  preload: false,
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

/* One variable file each instead of one static file per weight: the CJK
 * fallbacks were three and two requests, now one and one, and any weight the
 * type scale asks for is covered rather than snapped to the nearest cut. */
const sansSC = Noto_Sans_SC({
  weight: "variable",
  variable: "--font-noto-sans-sc",
  display: "swap",
  preload: false,
});

const serifSC = Noto_Serif_SC({
  weight: "variable",
  variable: "--font-noto-serif-sc",
  display: "swap",
  preload: false,
});

/** Every font variable, ready to drop on <html>. */
export const fontVariables = [
  sans.variable,
  serif.variable,
  mono.variable,
  sansSC.variable,
  serifSC.variable,
].join(" ");
