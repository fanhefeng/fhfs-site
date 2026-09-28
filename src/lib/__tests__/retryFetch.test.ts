import { describe, expect, it } from "vite-plus/test";
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
    expect(isConnectionFailure(new DOMException("aborted", "AbortError"))).toBe(false);
    expect(isConnectionFailure("fetch failed")).toBe(false);
  });
});

describe("withConnectionRetry", () => {
  it("retries a connection failure and returns the response that follows", async () => {
    const calls: unknown[] = [];
    const retrying = withConnectionRetry(
      async (input) => {
        calls.push(input);
        if (calls.length === 1) throw networkError();
        return new Response('{"rows":[]}', { status: 200, headers: { "x-neon": "1" } });
      },
      [1, 2],
      noSleep,
    );
    const response = await retrying(url);
    await expect(response.text()).resolves.toBe('{"rows":[]}');
    expect(response.status).toBe(200);
    expect(response.headers.get("x-neon")).toBe("1");
    expect(calls).toEqual([url, url]);
  });

  it("retries a reply whose body breaks off halfway", async () => {
    let calls = 0;
    const retrying = withConnectionRetry(
      async () => {
        calls++;
        if (calls > 1) return new Response("whole");
        // Headers arrived, then the proxy closed the socket mid-body.
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("hal"));
              controller.error(
                new TypeError("terminated", { cause: new Error("other side closed") }),
              );
            },
          }),
        );
      },
      [1, 2],
      noSleep,
    );
    await expect((await retrying(url)).text()).resolves.toBe("whole");
    expect(calls).toBe(2);
  });

  it("hands back an HTTP error status as it came, without retrying", async () => {
    let calls = 0;
    const retrying = withConnectionRetry(
      async () => {
        calls++;
        return new Response('{"message":"syntax error"}', { status: 400 });
      },
      [1, 2],
      noSleep,
    );
    const response = await retrying(url);
    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe('{"message":"syntax error"}');
    expect(calls).toBe(1);
  });

  it("keeps a bodiless status bodiless", async () => {
    const retrying = withConnectionRetry(
      async () => new Response(null, { status: 204 }),
      [],
      noSleep,
    );
    const response = await retrying(url);
    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
  });

  it("gives up with the last error once the delays run out", async () => {
    let calls = 0;
    const retrying = withConnectionRetry(
      async () => {
        calls++;
        throw networkError();
      },
      [1, 2],
      noSleep,
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
      noSleep,
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
      },
    );
    await retrying(url);
    expect(waited).toEqual([5, 50]);
  });

  it("passes the request through untouched", async () => {
    const seen: [unknown, RequestInit | undefined][] = [];
    const init = { method: "POST", body: '{"query":"select 1"}' };
    const retrying = withConnectionRetry(
      async (input, options) => {
        seen.push([input, options]);
        return new Response("");
      },
      [],
      noSleep,
    );
    await retrying(url, init);
    expect(seen).toEqual([[url, init]]);
  });
});
