import { validGithubRepo } from "@/lib/forms";

/** The public GitHub fields the site uses. No API credentials or raw payloads
 * cross into the software page's client island. */
export type Release = {
  version: string;
  url: string;
  publishedAt: string | null;
  downloads: { name: string; url: string; size: number }[];
};

export type RepositoryStats = { stars: number; forks: number };
export type GithubProject = { release: Release | null; stats: RepositoryStats | null };

/** GitHub repository names are case-insensitive; cache invalidation must be too. */
export const githubCacheTag = (repo: string): string => `github:${repo.toLowerCase()}`;

const object = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Public outbound URLs are limited to this repo on GitHub, even if an API
 * response is malformed. Encoding is left to GitHub's URLs, not recreated. */
function repoLink(value: unknown, repo: string): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.origin === "https://github.com" &&
      !url.username &&
      !url.password &&
      url.pathname.toLowerCase().startsWith(`/${repo.toLowerCase()}/`)
    );
  } catch {
    return false;
  }
}

export function parseGithubRelease(value: unknown, repo: string): Release | null {
  const row = object(value);
  if (
    !row ||
    row.draft !== false ||
    row.prerelease !== false ||
    typeof row.tag_name !== "string" ||
    !row.tag_name.trim() ||
    !repoLink(row.html_url, repo)
  ) {
    return null;
  }
  const publishedAt =
    typeof row.published_at === "string" && Number.isFinite(Date.parse(row.published_at))
      ? new Date(row.published_at).toISOString()
      : null;
  const downloads: Release["downloads"] = [];
  for (const item of Array.isArray(row.assets) ? row.assets : []) {
    const asset = object(item);
    if (
      asset?.state === "uploaded" &&
      typeof asset.name === "string" &&
      asset.name.trim() &&
      repoLink(asset.browser_download_url, repo) &&
      count(asset.size)
    ) {
      downloads.push({ name: asset.name, url: asset.browser_download_url, size: asset.size });
    }
  }
  return { version: row.tag_name, url: row.html_url, publishedAt, downloads };
}

export function parseGithubTag(value: unknown, repo: string): Release | null {
  const tag = Array.isArray(value) ? object(value[0])?.name : undefined;
  if (typeof tag !== "string" || !tag.trim()) return null;
  return {
    version: tag,
    url: `https://github.com/${repo}/tree/${encodeURIComponent(tag)}`,
    publishedAt: null,
    downloads: [],
  };
}

export function parseGithubStats(value: unknown): RepositoryStats | null {
  const row = object(value);
  if (!row || row.private !== false || !count(row.stargazers_count) || !count(row.forks_count)) {
    return null;
  }
  return { stars: row.stargazers_count, forks: row.forks_count };
}

const SYNC_EVENTS = new Set([
  "release",
  "push",
  "create",
  "delete",
  "repository",
  "star",
  "fork",
  "public",
]);

/** An event is only a hint to refetch; it never writes webhook content to the
 * database. The handler additionally checks this name against getApps(). */
export function githubEventRepo(event: string | null, value: unknown): string | null {
  if (!event || !SYNC_EVENTS.has(event)) return null;
  const repo = object(object(value)?.repository)?.full_name;
  return typeof repo === "string" && validGithubRepo(repo) ? repo : null;
}
