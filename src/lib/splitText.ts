/**
 * Deterministic text splitter — runs identically on server and client, so the
 * markup it produces hydrates without a mismatch.
 *
 *   line  → word[]   (split on "\n")
 *   word  → char[]   (a word never breaks in the middle)
 *   space → its own word, so wrapped text keeps natural spacing
 *
 * CJK glyphs become single-character words, which is what lets a long Chinese
 * run wrap at all; latin runs stay glued together.
 */

export type SplitChar = { char: string; index: number };
export type SplitWord = { chars: SplitChar[]; isSpace: boolean };
export type SplitLine = SplitWord[];

const CJK = /[⺀-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-｠￠-￦]/;

/** Punctuation that must not open a line in CJK typography. */
const NO_LINE_START = /[，。、；：？！）】》」』〉’”%·…—～]/;

export function splitText(text: string): { lines: SplitLine[]; total: number } {
  const lines: SplitLine[] = [];
  let index = 0;

  for (const rawLine of text.split("\n")) {
    const words: SplitWord[] = [];
    // Array.from keeps surrogate pairs and combining marks intact.
    const glyphs = Array.from(rawLine);

    let current: SplitChar[] = [];
    const flush = () => {
      if (current.length) {
        words.push({ chars: current, isSpace: false });
        current = [];
      }
    };

    for (const glyph of glyphs) {
      if (glyph === " " || glyph === "\t") {
        flush();
        words.push({ chars: [{ char: glyph, index: index++ }], isSpace: true });
        continue;
      }

      if (CJK.test(glyph)) {
        // Closing punctuation rides along with the word before it.
        if (NO_LINE_START.test(glyph) && words.length) {
          const prev = words[words.length - 1];
          if (!prev.isSpace && !current.length) {
            prev.chars.push({ char: glyph, index: index++ });
            continue;
          }
        }
        flush();
        words.push({ chars: [{ char: glyph, index: index++ }], isSpace: false });
        continue;
      }

      current.push({ char: glyph, index: index++ });
    }
    flush();

    lines.push(words);
  }

  return { lines, total: index };
}
