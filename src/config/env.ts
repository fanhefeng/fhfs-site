/**
 * What the site needs from its environment, said once.
 *
 * Each variable is still read where it is used — `src/db/index.ts` throws
 * without DATABASE_URL, the login action refuses without the other two — but
 * those fire one at a time, and the admin's only at the first login after a
 * deploy. `envProblems` is the same list checked together, and next.config.ts
 * runs it when a production build or server starts: a deploy with a secret
 * missing or mangled fails there, with every problem named at once.
 *
 * `.env.example` documents the same variables; `env.test.ts` keeps the two in
 * step. No `fs`, no imports — next.config.ts loads this before anything else.
 */

type Rule = { required: boolean; valid: (value: string) => boolean; shape: string };

export const ENV_RULES: Record<string, Rule> = {
  DATABASE_URL: {
    required: true,
    valid: (v) => /^postgres(ql)?:\/\/\S+$/.test(v),
    shape: "a postgres:// connection string (Neon's pooled one)",
  },
  DATABASE_URL_UNPOOLED: {
    required: false,
    valid: (v) => /^postgres(ql)?:\/\/\S+$/.test(v),
    shape: "a postgres:// connection string (Neon's direct one; scripts and migrations prefer it)",
  },
  AUTH_SECRET: {
    required: true,
    // `pnpm admin:password` mints 32 random bytes; anything much shorter is
    // a placeholder someone forgot to replace.
    valid: (v) => v.length >= 32,
    shape: "at least 32 characters — `pnpm admin:password` prints one",
  },
  ADMIN_PASSWORD_HASH: {
    required: true,
    valid: (v) => /^[0-9a-f]{16,}:[0-9a-f]{64,}$/.test(v),
    shape: "`salt:hash` in hex, as `pnpm admin:password` prints it",
  },
  SITE_URL: {
    required: false,
    valid: (v) => /^https:\/\/[a-z0-9.-]+$/.test(v),
    shape:
      "an https:// origin with no path or trailing slash (overrides the domain Vercel reports; src/lib/siteUrl.ts)",
  },
  GITHUB_TOKEN: {
    required: false,
    valid: (v) => v.trim() === v && v.length >= 20,
    shape: "a GitHub token (only lifts the release lookups' rate limit)",
  },
};

/** One line per variable that is missing or malformed; empty when all is well. */
export function envProblems(env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  for (const [name, rule] of Object.entries(ENV_RULES)) {
    const value = env[name];
    if (value === undefined || value === "") {
      if (rule.required) problems.push(`${name} is not set — expected ${rule.shape}`);
    } else if (!rule.valid(value)) {
      // Never the value itself: this ends up in build logs.
      problems.push(`${name} is set but malformed — expected ${rule.shape}`);
    }
  }
  return problems;
}
