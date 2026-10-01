/**
 * HTTP byte ranges, for the media Worker (media/worker.ts). Cloudflare serves
 * a Worker's static assets whole — a `Range` header gets a 200 and every byte
 * — and Safari will not play a video or a voice note from a server that does
 * that: it asks for `bytes=0-1` first and gives up on the answer. Chrome plays
 * it, but cannot seek past what has arrived. So the Worker answers the ranged
 * requests itself, with these two functions over the full asset.
 *
 * Plain functions over standard streams, so they run in the Worker and in the
 * tests alike.
 */

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
 * The bytes `start`…`end` (inclusive) of a stream, read no further than the
 * end: the source is cancelled once the range is out, so a request for the
 * first two bytes of a video does not drag the rest of it through.
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
