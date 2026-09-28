/**
 * A `fetch` that tries again when the network, not the server, said no.
 *
 * Neon over HTTP is one fetch per statement, and from some networks — a
 * proxy that tunnels every request, most often — the odd fetch never
 * connects: the handshake hangs until undici's connect timeout and the
 * driver reports `fetch failed`. Without this, one such fetch was a 500 on
 * whichever page was rendering, and a failed build if it happened during
 * the prerender. The scripts wear the same wrapper with more patient delays
 * (`scripts/connect.mts`).
 *
 * The same proxy also cuts a reply off halfway: the headers arrive, the
 * body stops at 64 or 80 KB with `terminated` / "other side closed". That
 * one surfaces later, when the driver reads the body — outside any retry —
 * and it hit the largest read on the site, the admin's 581-row moments
 * table, several times an hour. So the body is read to the end here, inside
 * the loop, and a reply that breaks off counts as a failed request.
 *
 * Only a network-level failure is retried: `fetch` and the body reader
 * reject with a `TypeError` for exactly those, and never for an HTTP status
 * or a Postgres error, which the driver reads out of a response that did
 * arrive. Trying again is safe because every statement this site sends is a
 * select, a keyed upsert or a keyed delete — repeating one changes nothing,
 * even when the first attempt did reach the database (see src/db/index.ts).
 */

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** The pause before each retry, in ms: two retries, the second patient. */
const RETRY_DELAYS: readonly number[] = [300, 1200];

/**
 * What `fetch` throws when it could not get a response at all. Node builds
 * it with `cause` set to the socket error underneath, which is what tells
 * it apart from any other TypeError; an aborted request throws a
 * DOMException instead and is left alone.
 */
export const isConnectionFailure = (error: unknown): boolean =>
  error instanceof TypeError && "cause" in error;

/** The statuses a `Response` refuses to be built with a body for. */
const NULL_BODY_STATUS = new Set([101, 204, 205, 304]);

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Wraps `fetchImpl` so a connection failure is retried after each delay in
 * `delays`, and the last error is thrown once they run out. `sleep` is a
 * parameter so tests do not have to wait.
 */
export function withConnectionRetry(
  fetchImpl: FetchLike,
  delays: readonly number[] = RETRY_DELAYS,
  sleep: (ms: number) => Promise<void> = wait,
): FetchLike {
  return async (input, init) => {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetchImpl(input, init);
        const body = await response.arrayBuffer();
        return new Response(NULL_BODY_STATUS.has(response.status) ? null : body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      } catch (error) {
        if (attempt >= delays.length || !isConnectionFailure(error)) {
          throw error;
        }
        await sleep(delays[attempt]!);
      }
    }
  };
}
