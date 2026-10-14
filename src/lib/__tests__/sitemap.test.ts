import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const readers = vi.hoisted(() => ({
  getSitemapEditions: vi.fn(),
  getAllTags: vi.fn(),
  getNavItems: vi.fn(),
  getIdols: vi.fn(),
  getFilms: vi.fn(),
}));
vi.mock("@/lib/server/content", () => readers);

import sitemap from "@/app/sitemap";
import { site } from "@/config/site";

beforeEach(() => {
  vi.resetAllMocks();
  readers.getSitemapEditions.mockResolvedValue({
    posts: [
      { slug: "both", locale: "en", date: "2026-10-10" },
      { slug: "both", locale: "zh", date: "2026-10-12" },
      { slug: "only-zh", locale: "zh", date: "2026-10-01" },
    ],
    secrets: [{ slug: "only-en", locale: "en", date: "2030-01-01" }],
  });
  readers.getAllTags.mockImplementation((locale: string) =>
    Promise.resolve([{ tag: locale === "zh" ? "手札" : "notes", count: 1 }]),
  );
  readers.getNavItems.mockResolvedValue([{ href: "/" }, { href: "/blog" }]);
  readers.getIdols.mockResolvedValue([{ key: "kobe" }]);
  readers.getFilms.mockResolvedValue([{ key: "odyssey" }]);
});

describe("sitemap from published edition metadata", () => {
  it("lists only real editions and shares their actual language links", async () => {
    const result = await sitemap();
    const articles = result.filter((entry) => /\/(blog|secrets)\/[^/]+$/.test(entry.url));
    expect(articles.map((entry) => entry.url)).toEqual([
      `${site.url}/en/blog/both`,
      `${site.url}/zh/blog/both`,
      `${site.url}/zh/blog/only-zh`,
      `${site.url}/en/secrets/only-en`,
    ]);
    expect(articles[0]!.alternates?.languages).toEqual({
      en: `${site.url}/en/blog/both`,
      "zh-CN": `${site.url}/zh/blog/both`,
    });
    expect(articles[2]!.alternates?.languages).toEqual({
      "zh-CN": `${site.url}/zh/blog/only-zh`,
    });
    expect(articles[3]!.alternates?.languages).toEqual({ en: `${site.url}/en/secrets/only-en` });
    expect(articles[0]!.lastModified).toEqual(new Date("2026-10-10"));
  });

  it("uses the newest post date only for the blog index and keeps tags per locale", async () => {
    const result = await sitemap();
    for (const locale of ["zh", "en"]) {
      expect(
        result.find((entry) => entry.url === `${site.url}/${locale}/blog`)?.lastModified,
      ).toEqual(new Date("2026-10-12"));
      expect(
        result.find((entry) => entry.url === `${site.url}/${locale}`)?.lastModified,
      ).toBeUndefined();
    }
    expect(result).toContainEqual({
      url: `${site.url}/zh/blog/tags/${encodeURIComponent("手札")}`,
    });
    expect(result).toContainEqual({ url: `${site.url}/en/blog/tags/notes` });
    expect(readers.getSitemapEditions).toHaveBeenCalledOnce();
    expect(readers.getAllTags).toHaveBeenCalledTimes(2);
  });

  it("handles empty content without inventing a publication date", async () => {
    readers.getSitemapEditions.mockResolvedValue({ posts: [], secrets: [] });
    const result = await sitemap();
    expect(
      result.find((entry) => entry.url === `${site.url}/zh/blog`)?.lastModified,
    ).toBeUndefined();
    expect(result.some((entry) => /\/secrets\/[^/]+$/.test(entry.url))).toBe(false);
  });
});
