import { parseRange, sliceStream } from "../src/lib/byteRange";
import sizes from "./sizes.gen.json";

/**
 * fhfs-media — the Cloudflare Worker that serves the board's pictures, voice
 * notes and videos (`MEDIA_ORIGIN`, src/config/csp.ts). The files are its
 * static assets (`files/`, deployed by `pnpm media:deploy`); a picture is
 * answered by Cloudflare straight from those, without this code.
 *
 * What this code is for: the voice notes and videos (`run_worker_first` in
 * wrangler.jsonc). Static assets come back whole whatever `Range` asks, and
 * Safari plays no media from a server that does that — so this answers the
 * range itself (src/lib/byteRange.ts). The asset arrives without a length,
 * so the length is looked up in `sizes.gen.json`, which the deploy writes
 * from the very files it uploads; a file missing from it goes out whole.
 */

type Env = { ASSETS: { fetch(request: Request): Promise<Response> } };

/** A Workers runtime stream that sends an exact Content-Length rather than chunks. */
declare const FixedLengthStream: new (length: number) => TransformStream<Uint8Array, Uint8Array>;

const SIZES: Record<string, number | undefined> = sizes;

const CACHE_CONTROL = "public, max-age=31536000, immutable";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const asset = await env.ASSETS.fetch(new Request(request.url));
    const size = SIZES[new URL(request.url).pathname];
    const headers = new Headers(asset.headers);
    const head = request.method === "HEAD";
    if (!asset.ok || !asset.body || size === undefined) {
      if (head) await asset.body?.cancel();
      return new Response(head ? null : asset.body, { status: asset.status, headers });
    }
    headers.set("accept-ranges", "bytes");
    headers.set("cache-control", CACHE_CONTROL);

    const range = parseRange(request.headers.get("range"), size);
    if (range === "unsatisfiable") {
      await asset.body.cancel();
      headers.set("content-range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    const { start, end } = range ?? { start: 0, end: size - 1 };
    const length = end - start + 1;
    headers.set("content-length", String(length));
    if (range) headers.set("content-range", `bytes ${start}-${end}/${size}`);
    const status = range ? 206 : 200;
    if (head) {
      await asset.body.cancel();
      return new Response(null, { status, headers });
    }
    const { readable, writable } = new FixedLengthStream(length);
    void sliceStream(asset.body, { start, end }).pipeTo(writable);
    return new Response(readable, { status, headers });
  },
};
