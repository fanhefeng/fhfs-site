/**
 * The Content-Security-Policy every response carries.
 *
 * The strict form — a nonce per response — needs every page rendered on
 * demand (Next's guide says so outright), and this site is prerendered to the
 * last page; trading that away to police a site with one author and no
 * third-party script would be the wrong bargain. So scripts and styles keep
 * `'unsafe-inline'`, which Next's own bootstrap and the splash decision script
 * (src/lib/client/splash.ts) need, and the policy earns its keep everywhere else:
 * nothing loads from another origin — save the board's media, from the one
 * media host named under `img-src` and `media-src` — nothing is framed or frames, no
 * plugin, no `<base>` hijack, no form posting elsewhere. If a stored article
 * ever did carry markup past lib/server/markdown.ts, it could not phone home or pull
 * a script from outside.
 *
 * Pure, and imported by next.config.ts — no `fs`, no `@/` imports.
 */

/** The media site: the Cloudflare Worker `fhfs-media` (media/), which serves
 *  the board's pictures, voice notes, posters and videos. The media fields
 *  accept a file from here and from this site and nowhere else
 *  (`validMediaSrc` in lib/forms.ts), so what they save is what the page may
 *  load. Moving it to a domain of its own is this line, and the stored
 *  addresses rewritten to match. */
export const MEDIA_ORIGIN = "https://fhfs-media.fhfs.workers.dev";

export function contentSecurityPolicy({ dev }: { dev: boolean }): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      // The Draco decoder is WebAssembly; this allows compiling it and
      // nothing else that `unsafe-eval` would.
      "'wasm-unsafe-eval'",
      // React's dev build reconstructs server stacks with eval. Dev only.
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    // data: for next/image's blur placeholders and inline SVG; blob: for the
    // textures three.js unpacks out of a GLB. The media site for a video's
    // poster and a picture in an article — next/image fetches the board's
    // pictures itself, from this origin.
    "img-src": ["'self'", "data:", "blob:", MEDIA_ORIGIN],
    // The one thing served from elsewhere: the board's media, on the media
    // site (AGENTS.md, Board media) — videos and voice notes here, pictures
    // above. Never scripts or styles.
    "media-src": ["'self'", "blob:", MEDIA_ORIGIN],
    "font-src": ["'self'"],
    // blob: because GLTFLoader fetches those unpacked textures; the dev
    // server adds its hot-reload socket.
    "connect-src": ["'self'", "blob:", ...(dev ? ["ws:"] : [])],
    // DRACOLoader builds its workers from a blob.
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    // What X-Frame-Options: DENY says, in the header browsers prefer.
    "frame-ancestors": ["'none'"],
    "frame-src": ["'none'"],
    "manifest-src": ["'self'"],
    ...(dev ? {} : { "upgrade-insecure-requests": [] }),
  };
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(" "))
    .join("; ");
}
