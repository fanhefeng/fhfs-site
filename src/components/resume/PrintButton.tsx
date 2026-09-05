"use client";

/**
 * "Print / save as PDF". The page's print stylesheet (globals.css) is the
 * whole export pipeline: the island, the footer, the glow and the grain
 * stay off the paper, the tokens go to ink on white, and the browser's own
 * print dialog offers the PDF. No generated file to keep in step with the
 * page — what is printed is the page.
 */
export function PrintButton({
  label,
  ariaLabel,
}: {
  label: string;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      aria-label={ariaLabel}
      className="hit-ext inline-flex min-h-11 shrink-0 items-center gap-2 rounded-chip border border-line px-4 py-2 font-mono text-meta uppercase tracking-meta text-fg-secondary transition-colors hover:border-accent hover:text-accent print:hidden"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4.5 6V2.5h7V6M4.5 11.5h7V14h-7z" />
        <path d="M3 6h10a1 1 0 0 1 1 1v4.5H2V7a1 1 0 0 1 1-1Z" />
      </svg>
      {label}
    </button>
  );
}
