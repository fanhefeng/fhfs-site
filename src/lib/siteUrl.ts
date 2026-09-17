/** Where the site lived before it had a domain; the answer off Vercel. */
export const FALLBACK_SITE_URL = "https://fhfs-site.vercel.app";

/**
 * The production origin, no trailing slash.
 *
 * It used to be a string in config/site.ts with "update after binding a
 * domain" next to it — and a forgotten update would have left every
 * canonical, hreflang, sitemap and feed address pointing at the old host,
 * with nothing failing. Vercel already knows the answer:
 * `VERCEL_PROJECT_PRODUCTION_URL` is the project's production domain (custom
 * one first), on preview deployments too — which is what a canonical on a
 * preview should point at. `SITE_URL` overrides it, for another host or to
 * choose between two bound domains.
 */
export function siteUrl(env: Record<string, string | undefined>): string {
  const explicit = env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return FALLBACK_SITE_URL;
}
