import "server-only";

/**
 * The one thing the site reads from somewhere other than its own database:
 * the latest version of each app, straight from GitHub. It used to be a
 * hand-typed constant on the home page ("v1.0", forever) — a release is
 * something that happens on GitHub, so the site asks GitHub.
 *
 * Cached through `fetch`'s own data cache for an hour: a page that shows a
 * version therefore regenerates at most hourly, and six repos at one request
 * each sit far inside the unauthenticated limit of sixty an hour. Set
 * `GITHUB_TOKEN` to raise it. Any failure — no release, rate-limited, offline
 * at build time — resolves to `null` and the page simply shows no version,
 * which is what it showed before this existed.
 */

export type Release = {
  /** "v0.12.0" — the tag as published. */
  version: string;
  /** The release page, or the tag's tree when the repo only has tags. */
  url: string;
};

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

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: headers(),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** A repo's latest release, falling back to its newest tag; null if neither. */
export async function getLatestRelease(repo: string | null): Promise<Release | null> {
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;

  const release = await getJson<{ tag_name: string; html_url: string }>(
    `/repos/${repo}/releases/latest`
  );
  if (release?.tag_name) return { version: release.tag_name, url: release.html_url };

  const tags = await getJson<{ name: string }[]>(`/repos/${repo}/tags?per_page=1`);
  const tag = tags?.[0]?.name;
  if (tag) return { version: tag, url: `https://github.com/${repo}/releases/tag/${tag}` };

  return null;
}

/** Latest releases for many repos at once, keyed by repo. */
export async function getLatestReleases(
  repos: (string | null)[]
): Promise<Map<string, Release>> {
  const unique = [...new Set(repos.filter((r): r is string => Boolean(r)))];
  const results = await Promise.all(unique.map((repo) => getLatestRelease(repo)));
  const out = new Map<string, Release>();
  unique.forEach((repo, i) => {
    const r = results[i];
    if (r) out.set(repo, r);
  });
  return out;
}
