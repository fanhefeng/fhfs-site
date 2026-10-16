import { describe, expect, it, vi } from "vite-plus/test";
import { BackupMediaError, downloadBackupMedia } from "@/lib/node/backupMedia";
import { MEDIA_FILE_LIMIT } from "@/lib/mediaSite";

const url = "https://media.example/moments/private-file.jpg";
const connectionFailure = () =>
  new TypeError("fetch failed", { cause: new Error("socket closed") });

describe("private backup media download", () => {
  it("recovers when one media connection fails instead of losing the whole backup", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(connectionFailure())
      .mockResolvedValueOnce(new Response("complete media"));
    const sleep = vi.fn(async () => {});
    await expect(downloadBackupMedia(url, request, sleep)).resolves.toEqual(
      Buffer.from("complete media"),
    );
    expect(request).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(request.mock.calls[0]![1]!.signal).not.toBe(request.mock.calls[1]![1]!.signal);
  });

  it("discards a broken response body and retries from the beginning", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Buffer.from("partial"));
      },
      pull(controller) {
        controller.error(connectionFailure());
      },
    });
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(body))
      .mockResolvedValueOnce(new Response("complete"));
    await expect(downloadBackupMedia(url, request, async () => {})).resolves.toEqual(
      Buffer.from("complete"),
    );
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("detects a short body even if the stream closes without an error", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("short", { headers: { "content-length": "12" } }))
      .mockResolvedValueOnce(new Response("complete"));
    await expect(downloadBackupMedia(url, request, async () => {})).resolves.toEqual(
      Buffer.from("complete"),
    );
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("bounds connection, timeout and short-body retries and publishes only fixed diagnostics", async () => {
    for (const failure of [
      connectionFailure(),
      new DOMException(url, "TimeoutError"),
      new DOMException(url, "AbortError"),
      "short",
    ]) {
      const request = vi.fn<typeof fetch>().mockImplementation(async () => {
        if (typeof failure === "string")
          return new Response(failure, { headers: { "content-length": "100" } });
        throw failure;
      });
      const sleep = vi.fn(async () => {});
      const result = downloadBackupMedia(url, request, sleep);
      await expect(result).rejects.toBeInstanceOf(BackupMediaError);
      await expect(result).rejects.toThrow(
        /after 3 attempts \((connection failure|timeout|incomplete response)\)/,
      );
      expect(request).toHaveBeenCalledTimes(3);
      expect(sleep.mock.calls).toEqual([[1000], [3000]]);
    }
  });

  it("keeps missing, empty and oversized media as backup failures without retrying", async () => {
    for (const response of [
      new Response("missing", { status: 404 }),
      new Response(null, { status: 204 }),
      new Response(""),
      new Response("too large", { headers: { "content-length": String(MEDIA_FILE_LIMIT + 1) } }),
      new Response(new Uint8Array(MEDIA_FILE_LIMIT + 1)),
    ]) {
      const request = vi.fn<typeof fetch>().mockResolvedValue(response);
      await expect(downloadBackupMedia(url, request)).rejects.toBeInstanceOf(BackupMediaError);
      expect(request).toHaveBeenCalledTimes(1);
    }
  });

  it("does not compare the decompressed body with its encoded wire length", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("decompressed", {
        headers: { "content-encoding": "gzip", "content-length": "3" },
      }),
    );
    await expect(downloadBackupMedia(url, request)).resolves.toEqual(Buffer.from("decompressed"));
  });

  it("withholds URLs and raw error text without retrying unexpected errors", async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error(url));
    await expect(downloadBackupMedia(url, request)).rejects.toThrow(
      "Media download failed; private response details withheld",
    );
    expect(request).toHaveBeenCalledTimes(1);
  });
});
