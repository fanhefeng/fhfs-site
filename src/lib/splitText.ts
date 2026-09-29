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

// Written as escapes, not as the characters: U+F900, the first compatibility
// ideograph, is NFC-normalised to U+8C48 by any tool that touches the file —
// which once quietly widened the last range over Hangul, the private use area
// and every surrogate half. `u`, so an astral glyph (an emoji, a character in
// Extension B and on) is tested as one code point, not two halves.
const CJK =
  /[\u2E80-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFF60\uFFE0-\uFFE6\u{20000}-\u{323AF}]/u;

/** Punctuation that must not open a line in CJK typography. */
const NO_LINE_START = /[，。、；：？！）】》」』〉’”%·…—～]/;

export function splitText(text: string): { lines: SplitLine[]; total: number } {
  const lines: SplitLine[] = [];
  let index = 0;

  for (const rawLine of text.split("\n")) {
    const words: SplitWord[] = [];
    // Array.from keeps a surrogate pair together (a combining mark, though,
    // is a glyph of its own).
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

      // Closing punctuation rides along with whatever came before it, so it
      // never opens a line. Asked before the CJK class: half the set — ’ ” …
      // — · % — is not CJK, and used to fall through and start a word of its
      // own. A full-width mark ends the Latin run it closes; a Latin one
      // (it’s, 50%) is part of it.
      if (NO_LINE_START.test(glyph)) {
        if (current.length) {
          current.push({ char: glyph, index: index++ });
          if (CJK.test(glyph)) flush();
          continue;
        }
        const prev = words[words.length - 1];
        if (prev && !prev.isSpace) {
          prev.chars.push({ char: glyph, index: index++ });
          continue;
        }
      }

      if (CJK.test(glyph)) {
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
