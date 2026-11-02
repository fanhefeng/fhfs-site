import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/fx/Reveal";

/**
 * The home page's section masthead: title on the baseline, a quiet mono
 * "view all" link at the right when the section has an "all" to go to, one
 * hairline under both. The `id` is the anchor for the section's
 * `aria-labelledby`. `index` numbers the section the way a magazine numbers
 * its table of contents — purely visual, so it stays out of the accessible
 * name.
 */
export function SectionHeader({
  id,
  title,
  href,
  viewAllLabel,
  index,
}: {
  id: string;
  title: string;
  href?: ComponentProps<typeof Link>["href"];
  viewAllLabel?: string;
  index?: string;
}) {
  return (
    <Reveal>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-line pb-3">
        <h2 id={id} className="flex min-w-0 max-w-full items-baseline gap-3 text-title">
          {index ? (
            <span
              aria-hidden="true"
              className="shrink-0 font-mono text-meta uppercase tracking-meta text-fg-tertiary"
            >
              № {index}
            </span>
          ) : null}
          <span className="min-w-0 break-words">{title}</span>
        </h2>
        {href && viewAllLabel ? (
          <Link
            href={href}
            className="hit-ext ml-auto max-w-full shrink-0 break-words font-mono text-meta uppercase tracking-meta text-fg-tertiary transition-colors hover:text-accent"
          >
            {viewAllLabel}
          </Link>
        ) : null}
      </div>
    </Reveal>
  );
}
