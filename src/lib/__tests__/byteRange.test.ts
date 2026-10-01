import { describe, expect, it } from "vite-plus/test";
import { parseRange, sliceStream } from "@/lib/byteRange";

describe("parseRange", () => {
  it("reads the ranges a browser sends for a video", () => {
    expect(parseRange("bytes=0-1", 1000)).toEqual({ start: 0, end: 1 });
    expect(parseRange("bytes=500-", 1000)).toEqual({ start: 500, end: 999 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
  });

  it("clamps an end past the file to its last byte", () => {
    expect(parseRange("bytes=900-5000", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=-5000", 1000)).toEqual({ start: 0, end: 999 });
  });

  it("refuses a start past the end, and an empty suffix", () => {
    expect(parseRange("bytes=1000-", 1000)).toBe("unsatisfiable");
    expect(parseRange("bytes=-0", 1000)).toBe("unsatisfiable");
  });

  it("sends the whole file for anything it does not read", () => {
    expect(parseRange(null, 1000)).toBe(null);
    expect(parseRange("bytes=0-1,5-6", 1000)).toBe(null);
    expect(parseRange("items=0-1", 1000)).toBe(null);
    expect(parseRange("bytes=-", 1000)).toBe(null);
    expect(parseRange("bytes=9-3", 1000)).toBe(null);
  });
});

/** A stream of `0, 1, 2, …` bytes in chunks of `chunk`, that counts how far it was read. */
function counting(size: number, chunk: number) {
  const seen = { read: 0, cancelled: false };
  let next = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (next >= size) return controller.close();
      const length = Math.min(chunk, size - next);
      controller.enqueue(Uint8Array.from({ length }, (_, i) => (next + i) % 256));
      next += length;
      seen.read = next;
    },
    cancel() {
      seen.cancelled = true;
    },
  });
  return { stream, seen };
}

const bytes = async (stream: ReadableStream<Uint8Array>) => [
  ...new Uint8Array(await new Response(stream).arrayBuffer()),
];

describe("sliceStream", () => {
  it("gives exactly the bytes asked for, across chunk edges", async () => {
    const { stream } = counting(1000, 64);
    const out = await bytes(sliceStream(stream, { start: 60, end: 200 }));
    expect(out).toEqual(Array.from({ length: 141 }, (_, i) => (60 + i) % 256));
  });

  it("works inside a single chunk, and to the very end", async () => {
    expect(await bytes(sliceStream(counting(1000, 64).stream, { start: 3, end: 5 }))).toEqual([
      3, 4, 5,
    ]);
    const tail = await bytes(sliceStream(counting(1000, 64).stream, { start: 990, end: 999 }));
    expect(tail).toEqual(Array.from({ length: 10 }, (_, i) => (990 + i) % 256));
  });

  it("stops reading the source once the range is out", async () => {
    const { stream, seen } = counting(1_000_000, 64);
    await bytes(sliceStream(stream, { start: 0, end: 1 }));
    expect(seen.read).toBeLessThan(1000);
    expect(seen.cancelled).toBe(true);
  });
});
