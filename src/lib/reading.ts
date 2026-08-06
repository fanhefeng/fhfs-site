/** CJK ideographs and kana — counted per character, unlike Latin words. */
const CJK = /[぀-ヿ㐀-鿿豈-﫿]/g;

/** The display-layer question — "is there any CJK in this string at all?" —
 *  which decides italics and title animations rather than reading speed. */
export const HAS_CJK = new RegExp(CJK.source);

/**
 * Reading time in whole minutes, mixed-script aware: ~350 CJK characters or
 * ~220 Latin words per minute. Code fences, JSX/HTML tags and bare URLs are
 * dropped first — nobody reads a stack trace at prose speed.
 *
 * The single source of truth: the home list, the blog index and the article
 * header all show the number this produces, so one post never advertises two
 * different times. It is computed from the author's markdown when a post is
 * saved and stored alongside it — no frontmatter to maintain.
 *
 * Lives in its own module so the seed script and the admin save path can use
 * it without pulling in the whole content layer.
 */
export function readingMinutes(source: string): number {
  const text = source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ");
  const cjk = text.match(CJK)?.length ?? 0;
  const latin =
    text.replace(CJK, " ").match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g)?.length ?? 0;
  return Math.max(1, Math.round(cjk / 350 + latin / 220));
}
