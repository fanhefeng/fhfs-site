import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createSiteTools, registerSiteTools, type WebMcpRegistry } from "../client/webmcp";
import type { SearchEntry } from "../search";

const entries: SearchEntry[] = [
  { kind: "page", title: "首页", text: "", href: "/" },
  { kind: "page", title: "文章", text: "", href: "/blog" },
  {
    kind: "post",
    title: "React 笔记",
    text: "组件与状态",
    href: "/blog/react",
    meta: "2026-11-02",
  },
  { kind: "app", title: "React 工具", text: "开发工具", href: "/software" },
  { kind: "moment", title: "", text: "今天使用 React", href: "/moments#m-1" },
  { kind: "page", title: "React admin", text: "", href: "/admin" },
  { kind: "page", title: "React API", text: "", href: "/api/media/cleanup" },
  { kind: "page", title: "React external", text: "", href: "https://other.invalid" },
];

function setup(locale: "zh" | "en" = "zh") {
  const loadIndex = vi.fn(async () => entries);
  const navigate = vi.fn(async () => {});
  const tools = createSiteTools({ locale, loadIndex, navigate });
  const call = (name: string, input: unknown, signal?: AbortSignal) =>
    tools.find((tool) => tool.name === name)!.execute(input, { signal });
  return { tools, call, loadIndex, navigate };
}

afterEach(() => vi.unstubAllGlobals());

describe("public WebMCP tools", () => {
  it("does not load content until called, and searches with the palette's ranking", async () => {
    const { tools, call, loadIndex } = setup();
    expect(loadIndex).not.toHaveBeenCalled();
    expect(tools.map((tool) => tool.name)).toEqual([
      "fhfs_search",
      "fhfs_list_sections",
      "fhfs_open_page",
    ]);
    const result = await call("fhfs_search", { query: "React", limit: 2 });
    expect(result).toEqual({
      locale: "zh",
      query: "React",
      results: [
        {
          kind: "post",
          title: "React 笔记",
          path: "/zh/blog/react",
          snippet: "组件与状态",
          meta: "2026-11-02",
        },
        { kind: "app", title: "React 工具", path: "/zh/software", snippet: "开发工具" },
      ],
    });
  });

  it("filters by kind, supports both languages, and retains moment fragments", async () => {
    const { call, loadIndex } = setup();
    expect(
      await call("fhfs_search", { query: "React", kind: "moment", locale: "en" }),
    ).toMatchObject({ locale: "en", results: [{ path: "/en/moments#m-1" }] });
    expect(loadIndex).toHaveBeenCalledWith("en", undefined);
    expect(await setup("en").call("fhfs_list_sections", {})).toEqual({
      locale: "en",
      sections: [
        { title: "首页", path: "/en" },
        { title: "文章", path: "/en/blog" },
      ],
    });
  });

  it.each([
    null,
    [],
    "React",
    {},
    { query: " " },
    { query: "x".repeat(201) },
    { query: "React", limit: 0 },
    { query: "React", limit: 21 },
    { query: "React", limit: 1.5 },
    { query: "React", limit: null },
    { query: "React", kind: "admin" },
    { query: "React", locale: "fr" },
    { query: "React", extra: true },
  ])("validates search input before reading content: %j", async (input) => {
    const { call, loadIndex } = setup();
    expect(await call("fhfs_search", input)).toMatchObject({ error: { code: "INVALID_INPUT" } });
    expect(loadIndex).not.toHaveBeenCalled();
  });

  it("navigates only after validating a current indexed target", async () => {
    const { call, navigate } = setup();
    expect(await call("fhfs_open_page", { path: "/en/moments#m-1" })).toEqual({
      path: "/en/moments#m-1",
      title: "",
      opened: true,
    });
    expect(navigate).toHaveBeenCalledWith("/en/moments#m-1", undefined);
    expect(await call("fhfs_open_page", { path: "/zh" })).toMatchObject({ opened: true });
  });

  it.each([
    "/admin",
    "/zh/admin",
    "/zh/api/media/cleanup",
    "/zh/_server/action",
    "https://other.invalid/zh/blog",
    "//other.invalid/zh/blog",
    "/fr/blog",
    "/zh/blog?preview=true",
    "/zh/blog/unknown",
    "/zh/moments#unknown",
    "/zh/blog/../admin",
    "/zh/%2e%2e/admin",
    "/zh/\\other.invalid",
  ])("rejects unsafe or unknown navigation: %s", async (path) => {
    const { call, navigate } = setup();
    expect(await call("fhfs_open_page", { path })).toMatchObject({
      error: { code: "INVALID_INPUT" },
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("reports failed reads and failed navigation without reporting success", async () => {
    const { call, loadIndex, navigate } = setup();
    loadIndex.mockRejectedValueOnce(new Error("private implementation detail"));
    expect(await call("fhfs_search", { query: "React" })).toMatchObject({
      error: { code: "UNAVAILABLE" },
    });
    expect(await call("fhfs_search", { query: "React" })).toMatchObject({
      results: expect.any(Array),
    });
    navigate.mockRejectedValueOnce(new Error("navigation failed"));
    expect(await call("fhfs_open_page", { path: "/zh/blog" })).toMatchObject({
      error: { code: "UNAVAILABLE" },
    });
  });

  it("stops cancelled work before reads and before navigation", async () => {
    const { call, loadIndex, navigate } = setup();
    const abort = new AbortController();
    abort.abort();
    expect(await call("fhfs_search", { query: "React" }, abort.signal)).toMatchObject({
      error: { code: "CANCELLED" },
    });
    expect(loadIndex).not.toHaveBeenCalled();
    const delayed = new AbortController();
    loadIndex.mockImplementationOnce(async () => {
      delayed.abort();
      return entries;
    });
    expect(await call("fhfs_open_page", { path: "/zh/blog" }, delayed.signal)).toMatchObject({
      error: { code: "CANCELLED" },
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("fetches as an anonymous visitor, forwards cancellation, and retries failures", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(Response.json(entries));
    vi.stubGlobal("fetch", fetcher);
    const tool = createSiteTools({ locale: "en", navigate: async () => {} })[1]!;
    const { signal } = new AbortController();
    expect(await tool.execute({}, { signal })).toMatchObject({ error: { code: "UNAVAILABLE" } });
    expect(await tool.execute({}, { signal })).toMatchObject({
      locale: "en",
      sections: expect.any(Array),
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith("/en/search.json", {
      credentials: "omit",
      headers: { Accept: "application/json" },
      signal,
    });
  });
});

describe("WebMCP registration", () => {
  it("skips unsupported browsers without fetching anything", () => {
    const loadIndex = vi.fn();
    registerSiteTools(undefined, { locale: "zh", navigate: async () => {}, loadIndex })();
    expect(loadIndex).not.toHaveBeenCalled();
  });

  it("unregisters every tool on cleanup and can register a new locale", () => {
    const active = new Set<string>();
    const registry: WebMcpRegistry = {
      registerTool(tool, { signal }) {
        active.add(tool.name);
        signal.addEventListener("abort", () => active.delete(tool.name), { once: true });
      },
    };
    const options = { locale: "zh" as const, navigate: async () => {} };
    const cleanup = registerSiteTools(registry, options);
    expect(active.size).toBe(3);
    cleanup();
    expect(active.size).toBe(0);
    const next = registerSiteTools(registry, { ...options, locale: "en" });
    expect(active.size).toBe(3);
    next();
    expect(active.size).toBe(0);
  });

  it("contains synchronous and asynchronous browser registration failures", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const registerTool = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("unsupported");
      })
      .mockRejectedValueOnce(new Error("disabled"))
      .mockResolvedValueOnce(undefined);
    const cleanup = registerSiteTools({ registerTool }, { locale: "zh", navigate: async () => {} });
    await Promise.resolve();
    expect(registerTool).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledTimes(2);
    cleanup();
    warn.mockRestore();
  });
});
