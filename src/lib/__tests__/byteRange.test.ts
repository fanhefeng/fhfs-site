import { describe, expect, it } from "vite-plus/test";
import { byteSlice, parseRange, sliceStream } from "@/lib/byteRange";

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

/** Every byte left in a stream. Read with a reader, as the Worker's `pipeTo` does: a
 *  `Response` would refuse a stream `byteSlice` has already moved along. */
async function bytes(stream: ReadableStream<Uint8Array>): Promise<number[]> {
  const out: number[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out;
    for (const byte of value) out.push(byte);
  }
}

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

/** A byte stream — what the runtime hands over as an asset's body — of `0, 1, 2, …` in chunks, that counts how far it was read. */
function byteCounting(size: number, chunk: number) {
  const seen = { read: 0, cancelled: false };
  let next = 0;
  const stream = new ReadableStream({
    type: "bytes",
    pull(controller) {
      if (next >= size) {
        controller.close();
        controller.byobRequest?.respond(0);
        return;
      }
      const length = Math.min(chunk, size - next);
      controller.enqueue(Uint8Array.from({ length }, (_, i) => (next + i) % 256));
      next += length;
      seen.read = next;
    },
    cancel() {
      seen.cancelled = true;
    },
  }) as ReadableStream<Uint8Array>;
  return { stream, seen };
}

const run = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => (from + i) % 256);

describe("byteSlice", () => {
  it("hands back the stream itself for a range that runs to the end, moved to its start", async () => {
    const { stream } = byteCounting(1000, 64);
    const out = await byteSlice(stream, { start: 60, end: 999 }, 1000);
    expect(out).toBe(stream);
    expect(await bytes(out)).toEqual(run(60, 999));
  });

  it("skips megabytes without reading past the start", async () => {
    const size = 5 * 1024 * 1024;
    const start = 3 * 1024 * 1024 + 17;
    const { stream } = byteCounting(size, 64 * 1024);
    const out = await byteSlice(stream, { start, end: size - 1 }, size);
    const got = await bytes(out);
    expect(got.length).toBe(size - start);
    expect(got.slice(0, 5)).toEqual(run(start, start + 4));
    expect(got.at(-1)).toBe((size - 1) % 256);
  });

  it("gives a bounded range exactly, and stops reading at its end", async () => {
    const { stream, seen } = byteCounting(100_000, 64);
    expect(await bytes(await byteSlice(stream, { start: 60, end: 200 }, 100_000))).toEqual(
      run(60, 200),
    );
    expect(seen.read).toBeLessThan(1000);
    expect(seen.cancelled).toBe(true);
  });

  it("serves the first two bytes, which is how Safari opens a video", async () => {
    const { stream } = byteCounting(100_000, 4096);
    expect(await bytes(await byteSlice(stream, { start: 0, end: 1 }, 100_000))).toEqual([0, 1]);
  });

  it("falls back to reading chunk by chunk from a stream with no BYOB reader", async () => {
    const { stream } = counting(1000, 64);
    expect(await bytes(await byteSlice(stream, { start: 60, end: 200 }, 1000))).toEqual(
      run(60, 200),
    );
  });
});
