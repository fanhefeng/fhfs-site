import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { loadSearchIndex } from "@/lib/client/searchIndex";

afterEach(() => vi.unstubAllGlobals());

describe("public search freshness", () => {
  it("shares only an unfinished read, then fetches updated content on reopen", async () => {
    let finish!: (response: Response) => void;
    const fetch = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    vi.stubGlobal("fetch", fetch);
    const first = loadSearchIndex("zh");
    expect(loadSearchIndex("zh")).toBe(first);
    expect(fetch).toHaveBeenCalledTimes(1);
    finish(Response.json([{ title: "before edit" }]));
    expect(await first).toEqual([{ title: "before edit" }]);
    fetch.mockResolvedValueOnce(Response.json([{ title: "after edit" }]));
    expect(await loadSearchIndex("zh")).toEqual([{ title: "after edit" }]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenLastCalledWith("/zh/search.json", {
      credentials: "omit",
      cache: "no-cache",
      headers: { Accept: "application/json" },
    });
  });

  it("separates languages and removes failed requests so retry can recover", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(Response.json([{ title: "English" }]))
      .mockResolvedValueOnce(Response.json([{ title: "中文" }]));
    vi.stubGlobal("fetch", fetch);
    const zh = loadSearchIndex("zh");
    const en = loadSearchIndex("en");
    await expect(zh).rejects.toThrow("503");
    expect(await en).toEqual([{ title: "English" }]);
    expect(await loadSearchIndex("zh")).toEqual([{ title: "中文" }]);
  });

  it("allows retry after invalid JSON and an invalid index shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("not JSON"))
        .mockResolvedValueOnce(Response.json({ error: "not an array" }))
        .mockResolvedValueOnce(Response.json([])),
    );
    await expect(loadSearchIndex("en")).rejects.toThrow();
    await expect(loadSearchIndex("en")).rejects.toThrow("Invalid search index");
    expect(await loadSearchIndex("en")).toEqual([]);
  });
});
