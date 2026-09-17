/**
 * The house rule a section wants said before you start typing in it — which
 * field may not be invented, what a status word promises, where a value is
 * read from.
 *
 * Distinct from the section's blurb in the header (that says *what* this page
 * changes) and quiet enough to skip once known: a rule, not a warning.
 *
 * No "use client": this renders inside server pages, and has no behaviour.
 */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 max-w-[72ch] space-y-2 rounded-card border border-line border-l-2 border-l-accent/50 bg-surface px-4 py-3 text-caption text-fg-secondary [&_code]:font-mono [&_code]:text-fg">
      {children}
    </div>
  );
}
