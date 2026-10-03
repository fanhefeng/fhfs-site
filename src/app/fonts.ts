import { Nunito, Josefin_Sans, Geist_Mono } from "next/font/google";

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
const accent = Josefin_Sans({
  subsets: ["latin"],
  variable: "--font-josefin",
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
export const fontVariables = [sans.variable, accent.variable, mono.variable].join(" ");
