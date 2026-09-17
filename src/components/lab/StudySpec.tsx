/**
 * What a study is actually made of, as a table.
 *
 * The note above it says what the piece is trying to be; this says what it
 * costs and how it behaves — runtime, passes, what it loads, how it degrades.
 * Every row has to be a fact checkable against the code, and the numbers that
 * can drift (blade counts, how many dresses exist) are passed in from the
 * modules that define them rather than written out here, so a change to the
 * scene cannot leave the table quietly lying.
 *
 * A Server Component: it is prose and a definition list, and it wants to be in
 * the HTML that ships.
 */

export type SpecRow = {
  /** Short label, printed in the mono voice the site uses for metadata. */
  label: string;
  /** The fact itself. */
  value: string;
};

export function StudySpec({ title, rows }: { title: string; rows: SpecRow[] }) {
  return (
    <section className="mt-12">
      <h2 className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">{title}</h2>
      {/* A definition list rather than a table: these are pairs, not a grid —
          nothing lines up across rows and there is no column to compare down.
          The rule between them does the work a table's borders would. */}
      <dl className="mt-4 divide-y divide-line border-y border-line">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4"
          >
            <dt className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
              {row.label}
            </dt>
            <dd className="text-caption text-fg-secondary">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
