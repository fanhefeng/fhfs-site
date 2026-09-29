/**
 * The Content-Security-Policy every response carries.
 *
 * The strict form — a nonce per response — needs every page rendered on
 * demand (Next's guide says so outright), and this site is prerendered to the
 * last page; trading that away to police a site with one author and no
 * third-party script would be the wrong bargain. So scripts and styles keep
 * `'unsafe-inline'`, which Next's own bootstrap and the splash decision script
 * (src/lib/client/splash.ts) need, and the policy earns its keep everywhere else:
 * nothing loads from another origin — save the board's videos, from the one
 * Blob host named under `media-src` — nothing is framed or frames, no
 * plugin, no `<base>` hijack, no form posting elsewhere. If a stored article
 * ever did carry markup past lib/server/markdown.ts, it could not phone home or pull
 * a script from outside.
 *
 * Pure, and imported by next.config.ts — no `fs`, no `@/` imports.
 */

/** The Vercel Blob store `fhfs-media`, where the admin's uploads land — the
 *  board's videos first, now any picture, voice note or poster uploaded from
 *  an editor. The media fields accept a file from here and from this site and
 *  nowhere else (`validMediaSrc` in lib/forms.ts), so what they save is what
 *  the page may load. */
export const MEDIA_ORIGIN = "https://oaq2x6wu11ne1ol7.public.blob.vercel-storage.com";

/** Where `@vercel/blob/client` sends an upload's bytes, from the admin only. */
export const BLOB_API_ORIGIN = "https://vercel.com";

/**
 * `admin` is the editor's variant, sent under /admin by a later header rule
 * that replaces this one there (next.config.ts): the same policy, plus the one
 * place its uploads go. The pages everyone reads never talk to the store's API.
 */
export function contentSecurityPolicy({
  dev,
  admin = false,
}: {
  dev: boolean;
  admin?: boolean;
}): string {
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
    // textures three.js unpacks out of a GLB, and for the admin's preview of
    // a file before it uploads. The store for a video's poster and a picture
    // in an article — next/image fetches the board's pictures itself, from
    // this origin.
    "img-src": ["'self'", "data:", "blob:", MEDIA_ORIGIN],
    // The one thing served from elsewhere: what the admin uploads, in the
    // Vercel Blob store `fhfs-media` (AGENTS.md, Board media) — videos and
    // voice notes here, pictures above. Never scripts or styles.
    "media-src": ["'self'", "blob:", MEDIA_ORIGIN],
    "font-src": ["'self'"],
    // blob: because GLTFLoader fetches those unpacked textures; the dev
    // server adds its hot-reload socket.
    "connect-src": [
      "'self'",
      "blob:",
      ...(admin ? [BLOB_API_ORIGIN] : []),
      ...(dev ? ["ws:"] : []),
    ],
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
