/**
 * A dynamic route segment as the page actually receives it.
 *
 * Next hands `params` back **percent-encoded**: `/zh/blog/tags/手札` arrives
 * as `"%E6%89%8B%E6%9C%AD"`, not as `手札`. Every tag on this site that was
 * not pure ASCII therefore looked for itself under its escape sequence,
 * matched no post, and 404'd — at build time, so the prerendered entry was a
 * 404 too. `macOS` was the one that worked, because ASCII encodes to itself.
 *
 * Slugs cannot hit this (`validKey` in `lib/forms` keeps them to
 * `[a-z0-9-]`), and the locale segment is `zh` or `en`. The tag is the one
 * segment on the site a person writes freely, so it is the one that needs
 * this.
 *
 * Decoding is idempotent for anything without a `%` in it, and a segment that
 * is not valid percent-encoding comes back unchanged rather than throwing —
 * a tag called `100%` has to render, not take the page down.
 */
export function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
