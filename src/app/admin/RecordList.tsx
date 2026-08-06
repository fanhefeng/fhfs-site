"use client";

import { useState } from "react";
import type { ActionState } from "./actions";
import { RecordForm, type Field, type RecordData } from "./RecordForm";

type ListRow = {
  /** Stable identity, and the key React uses. */
  id: string;
  /** The row's headline, composed on the server. */
  label: string;
  /** The dimmer line beside it. */
  meta?: string;
  data: RecordData;
};

/**
 * A list where each row opens into its own form.
 *
 * These tables are short — ten timeline entries, six apps, five experiments —
 * so a separate route per record would mean a page load to change a word.
 * Everything is on the page already; opening a row just reveals it.
 *
 * Rows arrive with their labels already composed. A server component may hand
 * a Server Action across this boundary but not an ordinary function, so
 * anything like `labelOf` has to be applied before the props are built.
 */
export function RecordList({
  action,
  fields,
  rows,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  fields: Field[];
  rows: ListRow[];
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ul className="divide-y divide-line border-y border-line">
      {rows.map((row) => {
        const isOpen = open === row.id;
        return (
          <li key={row.id} className="py-1">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : row.id)}
              aria-expanded={isOpen}
              className="flex min-h-11 w-full items-baseline gap-4 text-left hover:text-accent"
            >
              <span className="font-mono text-meta text-fg-tertiary">
                {isOpen ? "−" : "+"}
              </span>
              <span className="flex-1 text-body">{row.label}</span>
              {row.meta && (
                <span className="font-mono text-meta text-fg-tertiary">
                  {row.meta}
                </span>
              )}
            </button>

            {isOpen && (
              <div className="py-6">
                <RecordForm action={action} fields={fields} record={row.data} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
