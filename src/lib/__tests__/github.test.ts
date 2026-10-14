import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { getGithubProjects, getLatestReleases } from "@/lib/server/github";

vi.mock("server-only", () => ({}));
const repo = "fanhefeng/portreaper";
const release = {
  tag_name: "v1",
  html_url: `https://github.com/${repo}/releases/tag/v1`,
  published_at: "2026-10-14T02:30:00Z",
  draft: false,
  prerelease: false,
  assets: [],
};
const fetcher = vi.fn<typeof fetch>();
const urlOf = (input: string | URL | Request): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher);
  vi.stubEnv("GITHUB_TOKEN", "");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GitHub cached reads", () => {
  it("deduplicates repos and supplies the same cache tag for releases and stats", async () => {
    fetcher.mockImplementation(async (input) =>
      urlOf(input).endsWith("/latest")
        ? Response.json(release)
        : Response.json({ private: false, stargazers_count: 8, forks_count: 2 }),
    );
    const projects = await getGithubProjects([repo, repo, null, "bad/path/extra"]);
    expect(projects.size).toBe(1);
    expect(projects.get(repo)).toMatchObject({
      release: { version: "v1" },
      stats: { stars: 8, forks: 2 },
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [, options] of fetcher.mock.calls) {
      expect(options).toMatchObject({
        cache: "force-cache",
        next: { revalidate: 3600, tags: [`github:${repo}`] },
      });
      expect(options?.headers).not.toHaveProperty("Authorization");
    }
  });

  it("only sends the optional token to GitHub, on the server", async () => {
    vi.stubEnv("GITHUB_TOKEN", "fake-token-for-test");
    fetcher.mockResolvedValue(Response.json(release));
    const releases = await getLatestReleases([repo, null, repo]);
    expect(releases.get(repo)?.version).toBe("v1");
    expect(fetcher.mock.calls[0]?.[1]?.headers).toHaveProperty(
      "Authorization",
      "Bearer fake-token-for-test",
    );
    expect(JSON.stringify([...releases])).not.toContain("fake-token");
  });

  it("falls back to a bare tag only when there really is no latest release", async () => {
    fetcher
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json([{ name: "v3" }]));
    expect((await getLatestReleases([repo])).get(repo)).toMatchObject({
      version: "v3",
      publishedAt: null,
      url: `https://github.com/${repo}/tree/v3`,
    });
  });

  it("omits repos without releases or tags", async () => {
    fetcher
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json([]));
    expect(await getLatestReleases([repo])).toEqual(new Map());
    expect(await getLatestReleases([null, "owner/..", ""])).toEqual(new Map());
  });

  it("does not replace a release with a tag on a rate limit or timeout", async () => {
    fetcher.mockResolvedValue(new Response(null, { status: 403 }));
    expect(await getLatestReleases([repo])).toEqual(new Map());
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockReset().mockRejectedValue(new Error("timeout"));
    expect(await getLatestReleases([repo])).toEqual(new Map());
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps stats independent of a release failure and vice versa", async () => {
    fetcher.mockImplementation(async (input) =>
      urlOf(input).endsWith("/latest")
        ? new Response(null, { status: 500 })
        : Response.json({ private: false, stargazers_count: 1, forks_count: 0 }),
    );
    expect((await getGithubProjects([repo])).get(repo)).toEqual({
      release: null,
      stats: { stars: 1, forks: 0 },
    });
    fetcher.mockImplementation(async (input) =>
      urlOf(input).endsWith("/latest") ? Response.json(release) : new Response("not json"),
    );
    expect((await getGithubProjects([repo])).get(repo)).toMatchObject({
      release: { version: "v1" },
      stats: null,
    });
  });
});
