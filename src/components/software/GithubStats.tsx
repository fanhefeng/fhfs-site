import { useFormatter, useTranslations } from "next-intl";
import type { RepositoryStats } from "@/lib/githubData";

/** Printed counts on a sleeve; outbound links when shown beside the deck. */
export function GithubStats({ stats, repoUrl }: { stats: RepositoryStats; repoUrl?: string }) {
  const t = useTranslations("software");
  const format = useFormatter();
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-meta text-fg-tertiary">
      {(["stars", "forks"] as const).map((kind) => {
        const label = t(kind, { count: stats[kind] });
        const content = (
          <>
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5 shrink-0"
            >
              {kind === "stars" ? (
                <path d="m8 1.5 2 4.1 4.5.7-3.3 3.2.8 4.5-4-2.1-4 2.1.8-4.5L1.5 6.3l4.5-.7Z" />
              ) : (
                <>
                  <circle cx="4" cy="3" r="1.5" />
                  <circle cx="12" cy="3" r="1.5" />
                  <circle cx="8" cy="13" r="1.5" />
                  <path d="M4 4.5V6a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V4.5M8 8v3.5" />
                </>
              )}
            </svg>
            <span aria-hidden="true">{format.number(stats[kind])}</span>
            <span className="sr-only">{label}</span>
          </>
        );
        return repoUrl ? (
          <a
            key={kind}
            href={`${repoUrl}/${kind === "stars" ? "stargazers" : "forks"}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-8 items-center gap-1.5 hover:text-accent"
            title={label}
          >
            {content}
          </a>
        ) : (
          <span key={kind} className="inline-flex items-center gap-1.5" title={label}>
            {content}
          </span>
        );
      })}
    </span>
  );
}
