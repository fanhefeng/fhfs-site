import { byteSlice, parseRange } from "../src/lib/byteRange";
import sizes from "./sizes.gen.json";
import { readUpload, UPLOAD_PREFIX, UPLOAD_TRANSFER_SECONDS } from "../src/lib/mediaUploads";

/**
 * fhfs-media — the Cloudflare Worker that serves the board's pictures, voice
 * notes and videos (`MEDIA_ORIGIN`, src/config/csp.ts). The files are its
 * static assets (`files/`, deployed by `pnpm media:deploy`).
 *
 * What this code is for: ranges (`run_worker_first: /moments/*` in
 * wrangler.jsonc — it only takes prefixes, so pictures come through here too).
 * Static assets come back whole whatever `Range` asks, and Safari plays no
 * media from a server that does that — so this answers the range itself
 * (src/lib/byteRange.ts). The asset arrives without a length, so the length is
 * looked up in `sizes.gen.json`, which the deploy writes from the very files
 * it uploads; a file missing from it goes out whole.
 *
 * The bytes themselves are left to the runtime wherever they can be: the
 * free plan's 10 ms of CPU is not enough to carry a video chunk by chunk
 * through JavaScript (see byteRange.ts), so a whole file, or a range that
 * runs to its end, is piped from the asset straight into the response.
 */

type UploadMetadata = { size: number; type: string };
type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  UPLOADS?: {
    put(
      key: string,
      value: ReadableStream<Uint8Array>,
      options: { metadata: UploadMetadata },
    ): Promise<void>;
    getWithMetadata<T>(
      key: string,
      options: { type: "stream"; cacheTtl: number },
    ): Promise<{ value: ReadableStream<Uint8Array> | null; metadata: T | null }>;
    delete(key: string): Promise<void>;
  };
  MEDIA_UPLOAD_SECRET?: string;
  UPLOAD_SITE_ORIGIN?: string;
};

/** A Workers runtime stream that sends an exact Content-Length rather than chunks. */
declare const FixedLengthStream: new (length: number) => TransformStream<Uint8Array, Uint8Array>;

const SIZES: Record<string, number | undefined> = sizes;

const CACHE_CONTROL = "public, max-age=31536000, immutable";

export default {
  async scheduled(_event: unknown, env: Env) {
    if (!env.MEDIA_UPLOAD_SECRET || !env.UPLOAD_SITE_ORIGIN) return;
    const response = await fetch(`${env.UPLOAD_SITE_ORIGIN}/api/media/cleanup`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.MEDIA_UPLOAD_SECRET}` },
    });
    if (!response.ok) throw new Error(`Upload cleanup failed: ${response.status}`);
  },
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/_uploads/")) return upload(request, env, path.slice("/_uploads".length));
    if (request.method !== "GET" && request.method !== "HEAD")
      return new Response(null, { status: 405 });
    let asset: Response;
    let size: number | undefined;
    if (path.startsWith(UPLOAD_PREFIX)) {
      if (!env.UPLOADS) return new Response(null, { status: 404 });
      const entry = await env.UPLOADS.getWithMetadata<UploadMetadata>(path, {
        type: "stream",
        cacheTtl: 30,
      });
      if (!entry.value || !entry.metadata) {
        // Recovery can restore uploaded files as static assets.
        asset = await env.ASSETS.fetch(new Request(request.url));
        size = SIZES[path];
        if (!asset.ok)
          return new Response(null, {
            status: asset.status,
            headers: { "cache-control": "no-store" },
          });
      } else {
        size = entry.metadata.size;
        asset = new Response(entry.value, {
          headers: { "content-type": entry.metadata.type, "x-content-type-options": "nosniff" },
        });
      }
    } else {
      asset = await env.ASSETS.fetch(new Request(request.url));
      size = SIZES[path];
    }
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
    // The response starts now; the body follows once the skip to `start` is done.
    const { readable, writable } = new FixedLengthStream(length);
    void byteSlice(asset.body, { start, end }, size)
      .then((body) => body.pipeTo(writable))
      .catch((error: unknown) => writable.abort(error));
    return new Response(readable, { status, headers });
  },
};

async function upload(request: Request, env: Env, path: string): Promise<Response> {
  if (!env.UPLOADS || !env.MEDIA_UPLOAD_SECRET) return new Response(null, { status: 503 });
  const origin = request.headers.get("origin") ?? "";
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "PUT, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type",
    vary: "Origin",
    "cache-control": "no-store",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method === "DELETE") {
    // The browser receives scoped upload permits, never this server secret.
    if (
      request.headers.get("authorization") !== `Bearer ${env.MEDIA_UPLOAD_SECRET}` ||
      !path.startsWith(UPLOAD_PREFIX)
    )
      return new Response(null, { status: 403 });
    await env.UPLOADS.delete(path);
    return new Response(null, { status: 204 });
  }
  if (request.method !== "PUT") return new Response(null, { status: 405, headers: cors });
  const permit = await readUpload(
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "",
    env.MEDIA_UPLOAD_SECRET,
  );
  if (
    !permit ||
    permit.path !== path ||
    permit.origin !== origin ||
    request.headers.get("content-type") !== permit.type ||
    Number(request.headers.get("content-length")) !== permit.size ||
    !request.body
  )
    return new Response(null, { status: 403, headers: cors });
  try {
    // Bound an in-flight transfer so the final cancellation sweep has a
    // definite safe time. FixedLengthStream keeps bytes out of JavaScript.
    const transfer = new AbortController();
    const timer = setTimeout(() => transfer.abort(), UPLOAD_TRANSFER_SECONDS * 1000);
    try {
      const { readable, writable } = new FixedLengthStream(permit.size);
      await Promise.all([
        request.body.pipeTo(writable, { signal: transfer.signal }),
        env.UPLOADS.put(path, readable, { metadata: { size: permit.size, type: permit.type } }),
      ]);
    } finally {
      clearTimeout(timer);
      transfer.abort();
    }
    return Response.json({ ok: true }, { headers: cors });
  } catch {
    return Response.json(
      { error: "上传未完成，可能已达到免费存储额度。" },
      { status: 503, headers: cors },
    );
  }
}
