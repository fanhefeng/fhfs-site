import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Verify the original bytes before JSON parsing; comparing fixed-size
 * digests keeps both malformed signatures and Unicode bodies unambiguous. */
export function validGithubSignature(
  body: Uint8Array,
  signature: string | null,
  secret: string,
): boolean {
  if (!secret || !signature || !/^sha256=[0-9a-f]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}

/** GitHub caps webhook payloads at 25 MiB. Check the actual stream as well as
 * Content-Length, so a chunked request cannot bypass the limit. */
export async function readGithubBody(request: Request): Promise<Uint8Array | null> {
  const limit = 25 * 1024 * 1024;
  if (Number(request.headers.get("content-length")) > limit) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks, length);
  } finally {
    reader.releaseLock();
  }
}
