import { describe, expect, it } from "vitest";
import { isConnectionFailure, withConnectionRetry } from "@/lib/retryFetch";

/** What Node's fetch throws when the socket never connected. */
const networkError = () =>
  new TypeError("fetch failed", {
    cause: Object.assign(new Error("Connect Timeout Error"), {
      code: "UND_ERR_CONNECT_TIMEOUT",
    }),
  });

const noSleep = async () => {};
const url = "https://db.example/sql";

describe("isConnectionFailure", () => {
  it("recognises what fetch throws when it never got a response", () => {
    expect(isConnectionFailure(networkError())).toBe(true);
  });

  it("leaves every other error alone", () => {
    expect(isConnectionFailure(new Error("boom"))).toBe(false);
    expect(isConnectionFailure(new TypeError("no cause"))).toBe(false);
    expect(
      isConnectionFailure(new DOMException("aborted", "AbortError"))
    ).toBe(false);
    expect(isConnectionFailure("fetch failed")).toBe(false);
  });
});

describe("withConnectionRetry", () => {
  it("retries a connection failure and returns the response that follows", async () => {
    const calls: unknown[] = [];
    const response = new Response("ok");
    const retrying = withConnectionRetry(
      async (input) => {
        calls.push(input);
        if (calls.length === 1) throw networkError();
        return response;
      },
      [1, 2],
      noSleep
    );
    await expect(retrying(url)).resolves.toBe(response);
    expect(calls).toEqual([url, url]);
  });

  it("gives up with the last error once the delays run out", async () => {
    let calls = 0;
    const retrying = withConnectionRetry(
      async () => {
        calls++;
        throw networkError();
      },
      [1, 2],
      noSleep
    );
    await expect(retrying(url)).rejects.toThrow("fetch failed");
    expect(calls).toBe(3);
  });

  it("does not retry an error that is not a connection failure", async () => {
    let calls = 0;
    const retrying = withConnectionRetry(
      async () => {
        calls++;
        throw new Error("relation does not exist");
      },
      [1, 2],
      noSleep
    );
    await expect(retrying(url)).rejects.toThrow("relation does not exist");
    expect(calls).toBe(1);
  });

  it("waits each configured delay, in order, before retrying", async () => {
    const waited: number[] = [];
    let calls = 0;
    const retrying = withConnectionRetry(
      async () => {
        calls++;
        if (calls < 3) throw networkError();
        return new Response("");
      },
      [5, 50],
      async (ms) => {
        waited.push(ms);
      }
    );
    await retrying(url);
    expect(waited).toEqual([5, 50]);
  });

  it("passes the request through untouched", async () => {
    const seen: [unknown, RequestInit | undefined][] = [];
    const init = { method: "POST", body: '{"query":"select 1"}' };
    const retrying = withConnectionRetry(async (input, options) => {
      seen.push([input, options]);
      return new Response("");
    }, [], noSleep);
    await retrying(url, init);
    expect(seen).toEqual([[url, init]]);
  });
});
