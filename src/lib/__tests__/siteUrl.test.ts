import { describe, expect, it } from "vitest";
import { FALLBACK_SITE_URL, siteUrl } from "@/lib/siteUrl";

describe("siteUrl", () => {
  it("falls back off Vercel, and in the browser where neither variable exists", () => {
    expect(siteUrl({})).toBe(FALLBACK_SITE_URL);
    expect(siteUrl({ SITE_URL: "", VERCEL_PROJECT_PRODUCTION_URL: " " })).toBe(FALLBACK_SITE_URL);
  });

  it("takes the production domain Vercel reports, which comes without a scheme", () => {
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "fhf.example" })).toBe("https://fhf.example");
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "https://fhf.example/" })).toBe(
      "https://fhf.example",
    );
  });

  it("lets SITE_URL override it", () => {
    expect(
      siteUrl({ SITE_URL: "https://a.example", VERCEL_PROJECT_PRODUCTION_URL: "b.example" }),
    ).toBe("https://a.example");
  });

  it("never ends in a slash — every caller appends a path", () => {
    expect(siteUrl({ SITE_URL: "https://a.example//" })).toBe("https://a.example");
    expect(FALLBACK_SITE_URL.endsWith("/")).toBe(false);
  });
});
