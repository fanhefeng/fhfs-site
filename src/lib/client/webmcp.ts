import { routing, type Locale } from "@/i18n/routing";
import { search, SEARCH_KINDS, type SearchEntry, type SearchKind } from "@/lib/search";

/** The small part of the experimental browser API used by the site. */
export type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute(input: unknown, options?: { signal?: AbortSignal }): Promise<unknown>;
};

export type WebMcpRegistry = {
  registerTool(tool: WebMcpTool, options: { signal: AbortSignal }): void | Promise<void>;
};

type SiteToolsOptions = {
  locale: Locale;
  navigate(this: void, path: string, signal?: AbortSignal): Promise<void>;
  loadIndex?(this: void, locale: Locale, signal?: AbortSignal): Promise<SearchEntry[]>;
};

const PUBLIC_SECTIONS = new Set([
  "",
  "about",
  "intro",
  "resume",
  "software",
  "life",
  "moments",
  "blog",
  "secrets",
  "lab",
  "films",
  "idols",
]);
const BASE = "https://fhfs.invalid";
const localeSchema = {
  type: "string",
  enum: [...routing.locales],
  description: "Content language. Defaults to the language of the current page.",
};

class InvalidInput extends Error {}

function inputObject(input: unknown, allowed: string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new InvalidInput("Pass an object matching the tool's input schema.");
  if (Object.keys(input).some((key) => !allowed.includes(key)))
    throw new InvalidInput(`Allowed fields: ${allowed.join(", ")}.`);
  return input as Record<string, unknown>;
}

function inputLocale(value: unknown, fallback: Locale): Locale {
  if (value === undefined) return fallback;
  if (value === "zh" || value === "en") return value;
  throw new InvalidInput("locale must be zh or en.");
}

/** Only public routes from the existing index can become navigation targets. */
function publicPath(href: string, locale: Locale): string | null {
  if (!href.startsWith("/") || href.startsWith("//") || /[\\\s\p{Cc}]/u.test(href)) return null;
  const url = new URL(href, BASE);
  if (url.origin !== BASE || url.search || !PUBLIC_SECTIONS.has(url.pathname.split("/")[1]!))
    return null;
  return `/${locale}${url.pathname === "/" ? "" : url.pathname}${url.hash}`;
}

async function fetchIndex(locale: Locale, signal?: AbortSignal): Promise<SearchEntry[]> {
  // Always read as an anonymous visitor, even if the browser has an admin session.
  // The server's existing public cache expires within 30 seconds; no extra client cache.
  const response = await fetch(`/${locale}/search.json`, {
    credentials: "omit",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error("Search index unavailable");
  const entries: SearchEntry[] = await response.json();
  if (!Array.isArray(entries)) throw new Error("Invalid search index");
  return entries;
}

/** No request is made until a tool is called. All content uses the palette's index and ranking. */
export function createSiteTools({
  locale,
  navigate,
  loadIndex = fetchIndex,
}: SiteToolsOptions): WebMcpTool[] {
  const tool = (
    name: string,
    description: string,
    inputSchema: object,
    readOnlyHint: boolean,
    run: (input: unknown, signal?: AbortSignal) => Promise<unknown>,
  ): WebMcpTool => ({
    name,
    description,
    inputSchema,
    annotations: { readOnlyHint, untrustedContentHint: true },
    async execute(input, { signal } = {}) {
      try {
        signal?.throwIfAborted();
        return await run(input, signal);
      } catch (error) {
        return {
          error: {
            code: signal?.aborted
              ? "CANCELLED"
              : error instanceof InvalidInput
                ? "INVALID_INPUT"
                : "UNAVAILABLE",
            message: signal?.aborted
              ? "The operation was cancelled."
              : error instanceof InvalidInput
                ? error.message
                : "The public content or page is unavailable. Try again or use the website directly.",
          },
        };
      }
    },
  });
  const entriesFor = async (language: Locale, signal?: AbortSignal) => {
    const entries = await loadIndex(language, signal);
    signal?.throwIfAborted();
    return entries.filter((entry) => publicPath(entry.href, language) !== null);
  };
  return [
    tool(
      "fhfs_search",
      "Search fhf's public articles, software, motion studies, films, people and moments. Returns localized paths for fhfs_open_page. Use keywords in the requested content language; all query terms must match.",
      {
        type: "object",
        properties: {
          query: { type: "string", minLength: 1, maxLength: 200 },
          locale: localeSchema,
          kind: { type: "string", enum: [...SEARCH_KINDS] },
          limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
        },
        required: ["query"],
        additionalProperties: false,
      },
      true,
      async (input, signal) => {
        const args = inputObject(input, ["query", "locale", "kind", "limit"]);
        if (typeof args.query !== "string" || !args.query.trim() || args.query.length > 200)
          throw new InvalidInput("query must contain 1 to 200 characters and cannot be blank.");
        const language = inputLocale(args.locale, locale);
        if (args.kind !== undefined && !SEARCH_KINDS.includes(args.kind as SearchKind))
          throw new InvalidInput(`kind must be one of: ${SEARCH_KINDS.join(", ")}.`);
        const limit = args.limit === undefined ? 10 : args.limit;
        if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 20)
          throw new InvalidInput("limit must be an integer from 1 to 20.");
        const entries = (await entriesFor(language, signal)).filter(
          (entry) => args.kind === undefined || entry.kind === args.kind,
        );
        return {
          locale: language,
          query: args.query.trim(),
          results: search(entries, args.query, limit).map((entry) => ({
            kind: entry.kind,
            title: entry.title,
            path: publicPath(entry.href, language),
            snippet: entry.snippet,
            ...(entry.meta ? { meta: entry.meta } : {}),
          })),
        };
      },
    ),
    tool(
      "fhfs_list_sections",
      "List the public sections of fhf's website, with localized titles and paths. Use this to browse the site without a search query.",
      {
        type: "object",
        properties: { locale: localeSchema },
        additionalProperties: false,
      },
      true,
      async (input, signal) => {
        const args = inputObject(input, ["locale"]);
        const language = inputLocale(args.locale, locale);
        return {
          locale: language,
          sections: (await entriesFor(language, signal))
            .filter((entry) => entry.kind === "page")
            .map((entry) => ({ title: entry.title, path: publicPath(entry.href, language) })),
        };
      },
    ),
    tool(
      "fhfs_open_page",
      "Navigate the current browser tab to a public page returned by fhfs_search or fhfs_list_sections. Pass the exact localized path, including any moment fragment. This changes the visible page.",
      {
        type: "object",
        properties: { path: { type: "string", minLength: 3, maxLength: 2048 } },
        required: ["path"],
        additionalProperties: false,
      },
      false,
      async (input, signal) => {
        const args = inputObject(input, ["path"]);
        if (typeof args.path !== "string" || args.path.length > 2048)
          throw new InvalidInput("Use an exact localized path returned by another fhfs tool.");
        const match = /^\/(zh|en)(?=\/|#|$)/.exec(args.path);
        if (!match) throw new InvalidInput("path must start with /zh or /en.");
        const language = match[1] as Locale;
        const href = args.path.slice(3);
        const canonical = publicPath(href.startsWith("#") ? `/${href}` : href || "/", language);
        if (canonical !== args.path)
          throw new InvalidInput("Use an exact public path without query parameters.");
        const entry = (await entriesFor(language, signal)).find(
          (item) => publicPath(item.href, language) === args.path,
        );
        if (!entry)
          throw new InvalidInput(
            "Page not found in the public index. Search or list sections first.",
          );
        signal?.throwIfAborted();
        await navigate(args.path, signal);
        return { path: args.path, title: entry.title, opened: true };
      },
    ),
  ];
}

/** AbortSignal owns registration across locale changes, unmounts and React StrictMode. */
export function registerSiteTools(
  registry: WebMcpRegistry | undefined,
  options: SiteToolsOptions,
): () => void {
  if (typeof registry?.registerTool !== "function") return () => {};
  const lifecycle = new AbortController();
  for (const tool of createSiteTools(options)) {
    const report = () => {
      if (!lifecycle.signal.aborted) console.warn(`[fhfs WebMCP] Could not register ${tool.name}.`);
    };
    try {
      void Promise.resolve(registry.registerTool(tool, { signal: lifecycle.signal })).catch(report);
    } catch {
      report();
    }
  }
  return () => lifecycle.abort();
}
