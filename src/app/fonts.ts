import { Nunito, Instrument_Serif, Geist_Mono } from "next/font/google";

/* Editorial type trio. globals.css assembles the runtime stacks from these
 * variables. Latin is Nunito — rounded terminals to sit beside the Yozai
 * rounded CJK face (self-hosted, see yozai.css); behind Yozai the stacks
 * name the system CJK faces (PingFang, Songti, YaHei, SimSun, the Noto CJK
 * locals on Linux and Android) and nothing that downloads.
 *
 * The Noto Sans SC / Noto Serif SC webfonts used to stand in those stacks
 * as the last resort. They cost 222 @font-face rules — two CSS files, 67 KB
 * compressed, on every page — to declare fonts that never fetched a byte:
 * Yozai covers GB2312, PingFang covers the rest on Apple devices, and the
 * one glyph in a thousand that falls through lands on the system's own CJK
 * face just as well.
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

/** Every font variable, ready to drop on <html>. */
export const fontVariables = [sans.variable, serif.variable, mono.variable].join(" ");
