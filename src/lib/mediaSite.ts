/**
 * The media site — the Cloudflare Worker `fhfs-media` (media/), whose static
 * assets are the board's pictures, voice notes and videos. What the deploy
 * script (scripts/media.mts) and its tests share.
 *
 * A deploy replaces every asset at once, so a file left out of `media/files/`
 * is a file gone from the site: the script deploys only when every address
 * the database holds is there.
 */

/** Cloudflare's ceiling for one static asset: 25 MiB. A longer video is re-encoded under it. */
export const MEDIA_FILE_LIMIT = 25 * 1024 * 1024;

/** Every file on the media site that `text` points at, as paths on that site
 *  (`moments/x.jpg` under a leading slash), sorted. */
export function mediaPaths(text: string, origin: string): string[] {
  const escaped = origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found = new Set<string>();
  for (const match of text.matchAll(new RegExp(`${escaped}(/[^\\s"'()<>\\\\]+)`, "g"))) {
    // A sentence's full stop is not part of the address before it.
    found.add(match[1]!.replace(/[.,;:!?]+$/, ""));
  }
  return [...found].sort();
}

/** The `_headers` the assets go out with: a file's address never changes what it holds. */
export const MEDIA_HEADERS = [
  "/*",
  "  Cache-Control: public, max-age=31536000, immutable",
  "  X-Content-Type-Options: nosniff",
  "",
].join("\n");
