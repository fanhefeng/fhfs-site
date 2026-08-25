import { describe, expect, it } from "vitest";
import { feedTypes, localeAlternates, localeLanguages } from "@/lib/seo";
import { site } from "@/config/site";

describe("localeLanguages", () => {
  it("maps each locale's BCP 47 tag to its prefixed absolute URL", () => {
    expect(localeLanguages("/blog/my-post")).toEqual({
      "zh-CN": `${site.url}/zh/blog/my-post`,
      en: `${site.url}/en/blog/my-post`,
    });
  });

  it("takes the site root as an empty path", () => {
    expect(localeLanguages("")).toEqual({
      "zh-CN": `${site.url}/zh`,
      en: `${site.url}/en`,
    });
  });

  it("lists only the locales the page really exists in", () => {
    expect(localeLanguages("/blog/only-en", ["en"])).toEqual({
      en: `${site.url}/en/blog/only-en`,
    });
  });
});

describe("feedTypes", () => {
  it("points at the locale's own feed", () => {
    expect(feedTypes("en")).toEqual({
      "application/rss+xml": `${site.url}/en/rss.xml`,
    });
  });
});

describe("localeAlternates", () => {
  it("adds x-default on the default locale, a canonical on the current one, and the feed", () => {
    expect(localeAlternates("/about", "en")).toEqual({
      canonical: `${site.url}/en/about`,
      languages: {
        "zh-CN": `${site.url}/zh/about`,
        en: `${site.url}/en/about`,
        "x-default": `${site.url}/zh/about`,
      },
      types: feedTypes("en"),
    });
  });

  it("keeps x-default on zh even when the page is zh", () => {
    const alternates = localeAlternates("/about", "zh");
    expect(alternates.canonical).toBe(`${site.url}/zh/about`);
    expect(alternates.languages?.["x-default"]).toBe(`${site.url}/zh/about`);
  });

  it("falls back to the first available locale for x-default", () => {
    const alternates = localeAlternates("/blog/only-en", "en", ["en"]);
    expect(alternates.languages).toEqual({
      en: `${site.url}/en/blog/only-en`,
      "x-default": `${site.url}/en/blog/only-en`,
    });
  });
});
