import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vite-plus/test";
import { readGithubBody, validGithubSignature } from "@/lib/server/githubWebhook";

vi.mock("server-only", () => ({}));
const encode = (value: string) => new TextEncoder().encode(value);

describe("GitHub signature verification", () => {
  it("matches GitHub's official HMAC-SHA256 test vector", () => {
    expect(
      validGithubSignature(
        encode("Hello, World!"),
        "sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17",
        "It's a Secret to Everybody",
      ),
    ).toBe(true);
  });

  it("verifies the original Unicode bytes and rejects any tampering", () => {
    const body = encode('{"name":"软件"}');
    const signature = `sha256=${createHmac("sha256", "test-secret").update(body).digest("hex")}`;
    expect(validGithubSignature(body, signature, "test-secret")).toBe(true);
    expect(validGithubSignature(encode('{"name": "软件"}'), signature, "test-secret")).toBe(false);
    expect(validGithubSignature(body, signature, "another-secret")).toBe(false);
    expect(validGithubSignature(body, signature, "")).toBe(false);
    for (const value of [null, "", "sha1=abc", "sha256=xx", `sha256=${"g".repeat(64)}`])
      expect(validGithubSignature(body, value, "test-secret")).toBe(false);
  });
});

describe("GitHub request body", () => {
  it("reads the original bytes across chunks", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encode("soft"));
        controller.enqueue(encode("ware"));
        controller.close();
      },
    });
    const request = new Request("https://example.com", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit);
    expect(new TextDecoder().decode((await readGithubBody(request))!)).toBe("software");
    expect(await readGithubBody(new Request("https://example.com"))).toEqual(new Uint8Array());
  });

  it("rejects oversized bodies with or without Content-Length", async () => {
    const request = new Request("https://example.com", {
      method: "POST",
      body: "x",
      headers: { "Content-Length": String(26 * 1024 * 1024) },
    });
    expect(await readGithubBody(request)).toBeNull();
    const cancelled = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(26 * 1024 * 1024));
      },
      cancel: cancelled,
    });
    expect(
      await readGithubBody(
        new Request("https://example.com", { method: "POST", body, duplex: "half" } as RequestInit),
      ),
    ).toBeNull();
    expect(cancelled).toHaveBeenCalledOnce();
  });
});
