/**
 * HTTP byte ranges, for the media Worker (media/worker.ts). Cloudflare serves
 * a Worker's static assets whole — a `Range` header gets a 200 and every byte
 * — and Safari will not play a video or a voice note from a server that does
 * that: it asks for `bytes=0-1` first and gives up on the answer. Chrome plays
 * it, but cannot seek past what has arrived. So the Worker answers the ranged
 * requests itself, with these functions over the full asset.
 *
 * Plain functions over standard streams, so they run in the Worker and in the
 * tests alike.
 *
 * What it costs matters more than usual: the free plan gives a request 10 ms
 * of CPU, and a stream whose every chunk passes through JavaScript spent 240–
 * 400 ms carrying one 23 MB video (measured with `wrangler tail`, 2026-10-01).
 * Cloudflare forgives the occasional overrun and terminates a Worker that
 * makes a habit of it. So `byteSlice` touches as little as it can: it skips
 * to the start a megabyte at a time, and when the range runs to the end of the
 * file — which is what a player asks for — it hands back the asset's own
 * stream for the runtime to pipe without JavaScript in the loop.
 */

/** How much one read takes while skipping or copying: few reads, little JavaScript. */
const BLOCK = 1 << 20;

export type ByteRange = { start: number; end: number };

/**
 * The one range a `Range` header asks of a file of `size` bytes, inclusive
 * at both ends; null to send the whole file (no header, or one this does not
 * read — several ranges, another unit — which RFC 9110 lets a server
 * ignore); "unsatisfiable" for a range that starts past the end (416).
 */
export function parseRange(
  header: string | null,
  size: number,
): ByteRange | "unsatisfiable" | null {
  const match = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null;
  if (!match || (match[1] === "" && match[2] === "")) return null;
  const [, from, to] = match;
  if (from === "") {
    // `bytes=-500`: the last 500 bytes.
    const length = Number(to);
    if (length === 0) return "unsatisfiable";
    return { start: Math.max(0, size - length), end: size - 1 };
  }
  const start = Number(from);
  if (start >= size) return "unsatisfiable";
  const end = to === "" ? size - 1 : Math.min(Number(to), size - 1);
  if (end < start) return null;
  return { start, end };
}

/**
 * The bytes `start`…`end` (inclusive) of a byte stream of `size` bytes. With a
 * BYOB reader each read asks for exactly what is still to skip or to send, so
 * none overshoots and a read is a megabyte rather than a few kilobytes. A
 * range that ends at the last byte comes back as `source` itself, already
 * advanced to `start` — the caller pipes it on untouched. A stream that has no
 * BYOB reader falls back to `sliceStream`.
 */
export async function byteSlice(
  source: ReadableStream<Uint8Array>,
  { start, end }: ByteRange,
  size: number,
): Promise<ReadableStream<Uint8Array>> {
  let reader: ReadableStreamBYOBReader;
  try {
    reader = source.getReader({ mode: "byob" });
  } catch {
    return sliceStream(source, { start, end });
  }
  // One buffer for the whole skip: a read hands it back (transferred), and it
  // is read into again — a fresh megabyte each time is a megabyte zeroed.
  let scratch = new ArrayBuffer(Math.min(BLOCK, start));
  let offset = 0;
  while (offset < start) {
    const view = new Uint8Array(scratch, 0, Math.min(scratch.byteLength, start - offset));
    const { done, value } = await reader.read(view);
    if (done || !value) break;
    offset += value.byteLength;
    scratch = value.buffer as ArrayBuffer;
  }
  if (end >= size - 1) {
    reader.releaseLock();
    return source;
  }
  let left = end - start + 1;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read(new Uint8Array(Math.min(BLOCK, left)));
      if (done || !value) {
        controller.close();
        return;
      }
      left -= value.byteLength;
      controller.enqueue(value);
      if (left <= 0) {
        controller.close();
        await reader.cancel();
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

/**
 * The bytes `start`…`end` (inclusive) of any stream, chunk by chunk as it
 * comes, read no further than the end: the source is cancelled once the range
 * is out. The fallback for a stream without a BYOB reader — correct, but every
 * chunk passes through here.
 */
export function sliceStream(
  source: ReadableStream<Uint8Array>,
  { start, end }: ByteRange,
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        const from = offset;
        offset += value.byteLength;
        if (offset <= start) continue;
        const piece = value.subarray(
          Math.max(0, start - from),
          Math.min(value.byteLength, end + 1 - from),
        );
        controller.enqueue(piece);
        if (offset > end) {
          controller.close();
          await reader.cancel();
        }
        return;
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}
