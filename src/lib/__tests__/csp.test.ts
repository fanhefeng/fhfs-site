import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "@/lib/csp";

const parse = (policy: string): Record<string, string[]> =>
  Object.fromEntries(
    policy.split("; ").map((directive) => {
      const [name, ...values] = directive.split(" ");
      return [name, values] as const;
    }),
  );

describe("contentSecurityPolicy", () => {
  const prod = parse(contentSecurityPolicy({ dev: false }));
  const dev = parse(contentSecurityPolicy({ dev: true }));

  // The one exception is named here as well as in csp.ts, so adding a second
  // host — or letting this one into another directive — fails the test.
  const BLOB_HOST = "https://oaq2x6wu11ne1ol7.public.blob.vercel-storage.com";

  it("lets nothing load from another origin, save the board's videos", () => {
    for (const [name, values] of Object.entries(prod)) {
      expect(
        values.filter((value) => /^https?:|^\*|^wss?:/.test(value)),
        name,
      ).toEqual(name === "media-src" ? [BLOB_HOST] : []);
    }
  });

  it("falls back to self, and shuts the doors that have no business open", () => {
    expect(prod["default-src"]).toEqual(["'self'"]);
    expect(prod["object-src"]).toEqual(["'none'"]);
    expect(prod["frame-ancestors"]).toEqual(["'none'"]);
    expect(prod["frame-src"]).toEqual(["'none'"]);
    expect(prod["base-uri"]).toEqual(["'self'"]);
    expect(prod["form-action"]).toEqual(["'self'"]);
  });

  it("keeps eval and the hot-reload socket out of production", () => {
    expect(prod["script-src"]).not.toContain("'unsafe-eval'");
    expect(prod["connect-src"]).not.toContain("ws:");
    expect(prod).toHaveProperty("upgrade-insecure-requests");
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["connect-src"]).toContain("ws:");
    // `next dev` is plain http on a LAN address too, which this would break.
    expect(dev).not.toHaveProperty("upgrade-insecure-requests");
  });

  it("allows what the 3D scenes need: wasm, blob workers, blob textures", () => {
    expect(prod["script-src"]).toContain("'wasm-unsafe-eval'");
    expect(prod["worker-src"]).toContain("blob:");
    expect(prod["img-src"]).toContain("blob:");
    expect(prod["connect-src"]).toContain("blob:");
  });

  it("is one header's worth: no line breaks, no empty directive names", () => {
    const policy = contentSecurityPolicy({ dev: false });
    expect(policy).not.toMatch(/[\r\n]/);
    expect(policy.split("; ").every((directive) => /^[a-z-]+( |$)/.test(directive))).toBe(true);
  });
});
