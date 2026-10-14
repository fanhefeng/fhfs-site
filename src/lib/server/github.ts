import "server-only";
import {
  githubCacheTag,
  parseGithubRelease,
  parseGithubStats,
  parseGithubTag,
  type GithubProject,
  type Release,
} from "@/lib/githubData";
import { validGithubRepo } from "@/lib/forms";

export type { Release } from "@/lib/githubData";

/**
 * The one thing the site reads from somewhere other than its own database:
 * releases, download assets and repository statistics, straight from GitHub.
 *
 * Cached through `fetch`'s own data cache for an hour: a page that shows a
 * version regenerates hourly as a fallback. A signed webhook expires the
 * repository's tag immediately, across the home and software pages. Set
 * `GITHUB_TOKEN` to raise the unauthenticated API limit. Failures (no release,
 * rate-limited, offline) omit only the unavailable data.
 */

const REVALIDATE_SECONDS = 60 * 60;

function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "fhfs-site",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function getJson(
  repo: string,
  path: string,
): Promise<{ status: number; value: unknown } | null> {
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: headers(),
      signal: AbortSignal.timeout(4000),
      cache: "force-cache",
      next: { revalidate: REVALIDATE_SECONDS, tags: [githubCacheTag(repo)] },
    });
    // Only a real 404 means a repo has no release. A timeout or rate limit
    // must not turn an older bare tag into its supposedly latest version.
    if (!res.ok) return { status: res.status, value: null };
    return { status: res.status, value: await res.json() };
  } catch {
    return null;
  }
}

/** A repo's latest release, falling back to its newest tag; null if neither.
 *  Every caller wants several at once, so only the plural is exported. */
async function getLatestRelease(repo: string | null): Promise<Release | null> {
  if (!repo || !validGithubRepo(repo)) return null;

  const release = await getJson(repo, `/repos/${repo}/releases/latest`);
  if (release?.status === 200) return parseGithubRelease(release.value, repo);
  if (release?.status !== 404) return null;
  const tags = await getJson(repo, `/repos/${repo}/tags?per_page=1`);
  return parseGithubTag(tags?.value, repo);
}

/** Latest releases for many repos at once, keyed by repo. */
export async function getLatestReleases(repos: (string | null)[]): Promise<Map<string, Release>> {
  const unique = uniqueRepos(repos);
  const results = await Promise.all(unique.map((repo) => getLatestRelease(repo)));
  const out = new Map<string, Release>();
  unique.forEach((repo, i) => {
    const r = results[i];
    if (r) out.set(repo, r);
  });
  return out;
}

function uniqueRepos(repos: (string | null)[]): string[] {
  return [...new Set(repos.filter((r): r is string => r !== null && validGithubRepo(r)))];
}

/** Independent requests: stats still appear when a repo has no releases, and
 * releases still appear when the metadata request fails. */
export async function getGithubProjects(
  repos: (string | null)[],
): Promise<Map<string, GithubProject>> {
  const unique = uniqueRepos(repos);
  const projects = await Promise.all(
    unique.map(async (repo): Promise<[string, GithubProject]> => {
      const [release, metadata] = await Promise.all([
        getLatestRelease(repo),
        getJson(repo, `/repos/${repo}`),
      ]);
      return [repo, { release, stats: parseGithubStats(metadata?.value) }];
    }),
  );
  return new Map(projects);
}
