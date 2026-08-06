import { Link } from "@/i18n/navigation";
import { Sticker } from "@/components/ui/Sticker";

type Props = {
  tag: string;
  /** How many posts carry the tag — shown as a small tally in the cloud. */
  count?: number;
  /**
   * `sticker` is the tag-cloud form (die-cut white edge, micro tilt) — one of
   * the five sanctioned sticker spots. `plain` is the article meta line: a
   * bare mono word, because a headline area with stickers reads as clutter.
   */
  variant?: "sticker" | "plain";
  /** Index seed for the sticker's deterministic tilt. */
  seed?: number;
  className?: string;
};

/**
 * A tag as a link. Two materials for two jobs — see `variant`. Both keep a
 * ≥44px hit area via `.hit-ext`, so the small type stays thumb-friendly.
 */
export function TagPill({
  tag,
  count,
  variant = "plain",
  seed = 0,
  className,
}: Props) {
  const href = `/blog/tags/${encodeURIComponent(tag)}`;

  if (variant === "plain") {
    return (
      <Link
        href={href}
        className={`hit-ext relative inline-block font-mono text-meta uppercase tracking-meta text-fg-tertiary transition-colors duration-200 hover:text-accent ${className ?? ""}`}
      >
        #{tag}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`hit-ext group relative inline-block align-middle ${className ?? ""}`}
    >
      <Sticker seed={seed}>
        <span className="block rounded-full bg-surface-raised px-3 py-1.5 font-mono text-[11px] uppercase tracking-meta text-fg-secondary transition-colors duration-200 group-hover:text-accent">
          {tag}
          {count != null && (
            <span className="ml-1.5 tabular-nums text-fg-tertiary">{count}</span>
          )}
        </span>
      </Sticker>
    </Link>
  );
}
