import {
  Inter,
  Instrument_Serif,
  Geist_Mono,
  Noto_Sans_SC,
  Noto_Serif_SC,
} from "next/font/google";

/* Editorial type trio + CJK fallbacks. globals.css assembles the runtime
 * stacks from these variables (system PingFang/Songti take priority for CJK,
 * so the Noto webfonts stay non-preloaded fallbacks).
 *
 * Shared because `global-not-found` renders outside the [locale] root layout
 * and has to dress itself. */
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const serif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const sansSC = Noto_Sans_SC({
  weight: ["400", "500", "600"],
  variable: "--font-noto-sans-sc",
  display: "swap",
  preload: false,
});

const serifSC = Noto_Serif_SC({
  weight: ["400", "600"],
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
