import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import worker from "../../../media/worker";
import { signUpload, UPLOAD_PREFIX } from "@/lib/mediaUploads";

const secret = "a-dedicated-test-secret-with-at-least-32-characters";
const origin = "https://site.example";
const path = `${UPLOAD_PREFIX}c185fd3d-452d-4a67-9af7-bd501ef036b1.mp4`;
function environment() {
  const files = new Map<string, { bytes: ArrayBuffer; metadata: { size: number; type: string } }>();
  return {
    files,
    ASSETS: { fetch: vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))) },
    MEDIA_UPLOAD_SECRET: secret,
    UPLOAD_SITE_ORIGIN: origin,
    UPLOADS: {
      put: async (
        key: string,
        stream: ReadableStream<Uint8Array>,
        options: { metadata: { size: number; type: string } },
      ) => {
        files.set(key, {
          bytes: await new Response(stream).arrayBuffer(),
          metadata: options.metadata,
        });
      },
      getWithMetadata: <T>(key: string) => {
        const entry = files.get(key);
        return Promise.resolve({
          value: entry ? new Response(entry.bytes).body : null,
          metadata: (entry?.metadata ?? null) as T | null,
        });
      },
      delete: (key: string) => {
        files.delete(key);
        return Promise.resolve();
      },
    },
  };
}
afterEach(() => vi.unstubAllGlobals());

describe("uploaded media on the Worker", () => {
  it("accepts a scoped PUT, serves metadata and byte ranges, and deletes only with server authority", async () => {
    vi.stubGlobal(
      "FixedLengthStream",
      class extends TransformStream<Uint8Array, Uint8Array> {
        constructor(_length: number) {
          super();
        }
      },
    );
    const env = environment();
    const token = await signUpload(
      { path, size: 4, type: "video/mp4", origin, expires: Math.floor(Date.now() / 1000) + 600 },
      secret,
    );
    const url = `https://media.example/_uploads${path}`;
    const headers = {
      origin,
      authorization: `Bearer ${token}`,
      "content-type": "video/mp4",
      "content-length": "4",
    };
    expect(
      (
        await worker.fetch(
          new Request(url, { method: "PUT", headers, body: new Uint8Array([1, 2, 3, 4]) }),
          env,
        )
      ).status,
    ).toBe(200);
    const head = await worker.fetch(
      new Request(`https://media.example${path}`, { method: "HEAD" }),
      env,
    );
    expect(head.headers.get("content-length")).toBe("4");
    expect(head.headers.get("accept-ranges")).toBe("bytes");
    expect((await head.arrayBuffer()).byteLength).toBe(0);
    const range = await worker.fetch(
      new Request(`https://media.example${path}`, { headers: { range: "bytes=1-2" } }),
      env,
    );
    expect(range.status).toBe(206);
    expect(range.headers.get("content-range")).toBe("bytes 1-2/4");
    expect([...new Uint8Array(await range.arrayBuffer())]).toEqual([2, 3]);
    expect((await worker.fetch(new Request(url, { method: "DELETE", headers }), env)).status).toBe(
      403,
    );
    expect(env.files.has(path)).toBe(true);
    expect(
      (
        await worker.fetch(
          new Request(url, { method: "DELETE", headers: { authorization: `Bearer ${secret}` } }),
          env,
        )
      ).status,
    ).toBe(204);
    expect((await worker.fetch(new Request(`https://media.example${path}`), env)).status).toBe(404);
  });
  it("refuses origin, path, size and type changes, and unsigned writes", async () => {
    const env = environment();
    const token = await signUpload(
      { path, size: 4, type: "video/mp4", origin, expires: Math.floor(Date.now() / 1000) + 600 },
      secret,
    );
    const headers = {
      origin,
      authorization: `Bearer ${token}`,
      "content-type": "video/mp4",
      "content-length": "4",
    };
    for (const change of [
      { origin: "https://evil.example" },
      { "content-length": "5" },
      { "content-type": "text/html" },
      { authorization: "Bearer forged" },
    ]) {
      expect(
        (
          await worker.fetch(
            new Request(`https://media.example/_uploads${path}`, {
              method: "PUT",
              headers: { ...headers, ...change },
              body: new Uint8Array([1, 2, 3, 4]),
            }),
            env,
          )
        ).status,
      ).toBe(403);
    }
    expect(env.files.size).toBe(0);
  });
});
