import { describe, expect, it } from "vite-plus/test";
import {
  appGithubRepo,
  githubCacheTag,
  githubEventRepo,
  parseGithubRelease,
  parseGithubStats,
  parseGithubTag,
} from "@/lib/githubData";

const repo = "fanhefeng/portreaper";
const release = {
  tag_name: "v2.0.0",
  html_url: `https://github.com/${repo}/releases/tag/v2.0.0`,
  published_at: "2026-10-14T02:30:00Z",
  draft: false,
  prerelease: false,
  assets: [
    {
      name: "Portreaper.dmg",
      browser_download_url: `https://github.com/${repo}/releases/download/v2.0.0/Portreaper.dmg`,
      size: 1024,
      state: "uploaded",
    },
  ],
};

describe("GitHub public data", () => {
  it("extracts version, publication time and uploaded download files", () => {
    expect(parseGithubRelease(release, repo)).toEqual({
      version: "v2.0.0",
      url: release.html_url,
      publishedAt: "2026-10-14T02:30:00.000Z",
      downloads: [
        { name: "Portreaper.dmg", url: release.assets[0]!.browser_download_url, size: 1024 },
      ],
    });
  });

  it("does not publish drafts, prereleases or malformed release responses", () => {
    for (const value of [
      null,
      [],
      "error",
      { ...release, draft: true },
      { ...release, prerelease: true },
      { ...release, tag_name: " " },
      { ...release, tag_name: 123 },
      { ...release, html_url: undefined },
      { ...release, html_url: "broken" },
      { ...release, html_url: "javascript:alert(1)" },
      { ...release, html_url: `https://user:password@github.com/${repo}/x` },
      { ...release, html_url: "https://github.com/somebody/else/releases/tag/v2" },
    ]) {
      expect(parseGithubRelease(value, repo)).toBeNull();
    }
  });

  it("keeps a valid version even without a valid date or assets", () => {
    expect(
      parseGithubRelease({ ...release, published_at: "invalid", assets: undefined }, repo),
    ).toMatchObject({ publishedAt: null, downloads: [] });
    expect(parseGithubRelease({ ...release, published_at: null }, repo)?.publishedAt).toBeNull();
  });

  it("filters pending, malformed and non-GitHub download assets", () => {
    const asset = release.assets[0]!;
    expect(
      parseGithubRelease(
        {
          ...release,
          assets: [
            null,
            {},
            { ...asset, state: "new" },
            { ...asset, name: 1 },
            { ...asset, name: " " },
            { ...asset, size: -1 },
            { ...asset, browser_download_url: "https://evil.example/file" },
            asset,
          ],
        },
        repo,
      )?.downloads,
    ).toHaveLength(1);
  });

  it("links bare tags to their actual trees and never invents publication dates", () => {
    expect(parseGithubTag([{ name: "release/1.0" }], repo)).toEqual({
      version: "release/1.0",
      url: `https://github.com/${repo}/tree/release%2F1.0`,
      publishedAt: null,
      downloads: [],
    });
    for (const value of [null, {}, [], [null], [{ name: "" }], [{ name: 7 }]])
      expect(parseGithubTag(value, repo)).toBeNull();
  });

  it("accepts zero stars/forks and only public integer counts", () => {
    expect(parseGithubStats({ private: false, stargazers_count: 0, forks_count: 3 })).toEqual({
      stars: 0,
      forks: 3,
      language: null,
      pushedAt: null,
    });
    for (const value of [
      null,
      {},
      { private: true, stargazers_count: 1, forks_count: 2 },
      { private: false, stargazers_count: -1, forks_count: 2 },
      { private: false, stargazers_count: 1, forks_count: "2" },
      { private: false, stargazers_count: 1.5, forks_count: 2 },
    ])
      expect(parseGithubStats(value)).toBeNull();
  });

  it("reads the primary language and last push without requiring optional metadata", () => {
    const stats = { private: false, stargazers_count: 42, forks_count: 7 };
    expect(
      parseGithubStats({ ...stats, language: "TypeScript", pushed_at: "2026-11-01T08:00:00Z" }),
    ).toEqual({
      stars: 42,
      forks: 7,
      language: "TypeScript",
      pushedAt: "2026-11-01T08:00:00.000Z",
    });
    expect(parseGithubStats({ ...stats, language: 3, pushed_at: "invalid" })).toEqual({
      stars: 42,
      forks: 7,
      language: null,
      pushedAt: null,
    });
  });
});

describe("project repository selection", () => {
  it("prefers an explicit repo and normalizes GitHub's case-insensitive names", () => {
    expect(
      appGithubRepo({ repo: "FanHeFeng/Portreaper", website: "https://github.com/other/repo" }),
    ).toBe(repo);
  });

  it("recognizes GitHub project websites, clone URLs and release links", () => {
    for (const path of [
      "/FanHeFeng/Portreaper",
      "/fanhefeng/portreaper/",
      "/fanhefeng/portreaper.git",
      "/fanhefeng/portreaper/releases/latest?from=site#downloads",
    ]) {
      expect(appGithubRepo({ repo: null, website: `https://github.com${path}` })).toBe(repo);
    }
  });

  it("ignores websites without a repository and never accepts an arbitrary API host", () => {
    for (const website of [
      undefined,
      "broken",
      "https://github.com",
      "https://github.com/fanhefeng",
      "https://github.com/fanhefeng/",
      "https://github.com/fanhefeng/..",
      "https://github.com/owner/%2Fsecret",
      "https://github.com/owner/.git",
      "https://github.com.evil.example/owner/repo",
      "https://user:password@github.com/owner/repo",
      "https://example.com/owner/repo",
      "http://github.com/owner/repo",
    ]) {
      expect(appGithubRepo({ repo: null, website })).toBeNull();
    }
  });
});

describe("GitHub event selection", () => {
  it("maps relevant events to a case-insensitive cache tag", () => {
    for (const event of [
      "release",
      "push",
      "create",
      "delete",
      "repository",
      "star",
      "fork",
      "public",
    ]) {
      expect(githubEventRepo(event, { repository: { full_name: repo } })).toBe(repo);
    }
    expect(githubCacheTag("FanHeFeng/Portreaper")).toBe(githubCacheTag(repo));
  });

  it("ignores unrelated events and malformed repository names", () => {
    for (const event of [null, "ping", "issues", ""])
      expect(githubEventRepo(event, { repository: { full_name: repo } })).toBeNull();
    for (const value of [
      null,
      [],
      {},
      { repository: null },
      { repository: { full_name: "owner/../evil" } },
      { repository: { full_name: 3 } },
    ])
      expect(githubEventRepo("push", value)).toBeNull();
  });
});
