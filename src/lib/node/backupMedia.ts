import { MEDIA_FILE_LIMIT } from "../mediaSite";
import { isConnectionFailure, type FetchLike } from "../retryFetch";

/** Only fixed messages from this error may reach public backup logs. */
export class BackupMediaError extends Error {}

class IncompleteMediaResponse extends Error {}

const RETRY_DELAYS = [1000, 3000];
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Retry the whole GET, including its body; never write a partial backup file. */
export async function downloadBackupMedia(
  url: string,
  fetchImpl: FetchLike = fetch,
  sleep: (ms: number) => Promise<void> = wait,
): Promise<Buffer> {
  for (let attempt = 0; ; attempt++) {
    try {
      // A new timeout belongs to each attempt, including reading its body.
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw new BackupMediaError(`Media download failed (HTTP ${response.status})`);
      }
      const length = Number(response.headers.get("content-length"));
      if (length > MEDIA_FILE_LIMIT) {
        await response.body?.cancel().catch(() => {});
        throw new BackupMediaError("Media file exceeds the asset limit");
      }
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      if (!response.body) throw new BackupMediaError("Empty media response");
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > MEDIA_FILE_LIMIT)
          throw new BackupMediaError("Media file exceeds the asset limit");
        chunks.push(chunk);
      }
      if (bytes === 0) throw new BackupMediaError("Empty media file");
      // Encoded responses are decompressed by fetch, so their wire length differs.
      if (length > 0 && !response.headers.has("content-encoding") && bytes !== length)
        throw new IncompleteMediaResponse();
      return Buffer.concat(chunks);
    } catch (error) {
      if (error instanceof BackupMediaError) throw error;
      // The body reader reports AbortError when our own timeout fires.
      const reason = isConnectionFailure(error)
        ? "connection failure"
        : error instanceof DOMException && ["TimeoutError", "AbortError"].includes(error.name)
          ? "timeout"
          : error instanceof IncompleteMediaResponse
            ? "incomplete response"
            : undefined;
      if (!reason)
        throw new BackupMediaError("Media download failed; private response details withheld");
      if (attempt >= RETRY_DELAYS.length)
        throw new BackupMediaError(
          `Media download failed after ${attempt + 1} attempts (${reason})`,
        );
      await sleep(RETRY_DELAYS[attempt]!);
    }
  }
}
