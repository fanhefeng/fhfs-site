/**
 * A `fetch` that tries again when the network, not the server, said no.
 *
 * Neon over HTTP is one fetch per statement, and from some networks — a
 * proxy that tunnels every request, most often — the odd fetch never
 * connects: the handshake hangs until undici's connect timeout and the
 * driver reports `fetch failed`. Without this, one such fetch was a 500 on
 * whichever page was rendering, and a failed build if it happened during
 * the prerender. `scripts/db-import.mts` guards the same thing statement by
 * statement.
 *
 * Only a network-level failure is retried: `fetch` rejects with a
 * `TypeError` for exactly those, and never for an HTTP status or a Postgres
 * error, which the driver reads out of a response that did arrive. Trying
 * again is safe because a request that failed this way never got a reply,
 * and because every statement this site sends is a select, a keyed upsert
 * or a keyed delete — repeating one changes nothing (see src/db/index.ts).
 */

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

/** The pause before each retry, in ms: two retries, the second patient. */
export const RETRY_DELAYS: readonly number[] = [300, 1200];

/**
 * What `fetch` throws when it could not get a response at all. Node builds
 * it with `cause` set to the socket error underneath, which is what tells
 * it apart from any other TypeError; an aborted request throws a
 * DOMException instead and is left alone.
 */
export const isConnectionFailure = (error: unknown): boolean =>
  error instanceof TypeError && "cause" in error;

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Wraps `fetchImpl` so a connection failure is retried after each delay in
 * `delays`, and the last error is thrown once they run out. `sleep` is a
 * parameter so tests do not have to wait.
 */
export function withConnectionRetry(
  fetchImpl: FetchLike,
  delays: readonly number[] = RETRY_DELAYS,
  sleep: (ms: number) => Promise<void> = wait
): FetchLike {
  return async (input, init) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fetchImpl(input, init);
      } catch (error) {
        if (attempt >= delays.length || !isConnectionFailure(error)) {
          throw error;
        }
        await sleep(delays[attempt]);
      }
    }
  };
}
