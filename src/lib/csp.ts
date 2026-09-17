/**
 * The Content-Security-Policy every response carries.
 *
 * The strict form — a nonce per response — needs every page rendered on
 * demand (Next's guide says so outright), and this site is prerendered to the
 * last page; trading that away to police a site with one author and no
 * third-party script would be the wrong bargain. So scripts and styles keep
 * `'unsafe-inline'`, which Next's own bootstrap and the splash decision script
 * (src/lib/splash.ts) need, and the policy earns its keep everywhere else:
 * nothing loads from another origin, nothing is framed or frames, no plugin,
 * no `<base>` hijack, no form posting elsewhere. If a stored article ever did
 * carry markup past lib/markdown.ts, it could not phone home or pull a script
 * from outside.
 *
 * Pure, and imported by next.config.ts — no `fs`, no `@/` imports.
 */
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
    // textures three.js unpacks out of a GLB.
    "img-src": ["'self'", "data:", "blob:"],
    "media-src": ["'self'"],
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
