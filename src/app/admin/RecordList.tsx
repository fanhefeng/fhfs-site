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
 *
 * `blank` adds a "new row" form after the list, and `deleteAction` a delete
 * button inside each existing row — the same shape the works page has, for
 * the tables that are edited through this list instead.
 */
export function RecordList({
  action,
  fields,
  rows,
  blank,
  blankLabel = "新建",
  deleteAction,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  fields: Field[];
  rows: ListRow[];
  /** Starting values for a new row; omit to make the list edit-only. */
  blank?: RecordData;
  blankLabel?: string;
  deleteAction?: (form: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
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
                  <RecordForm
                    action={action}
                    fields={fields}
                    record={row.data}
                    deleteAction={deleteAction}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {blank && (
        <section className="mt-12 pt-2">
          <h2 className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
            {blankLabel}
          </h2>
          <div className="mt-3">
            <RecordForm action={action} fields={fields} record={blank} isNew />
          </div>
        </section>
      )}
    </>
  );
}
