"use client";

import { useMemo, useState } from "react";
import type { ActionState } from "./actions";
import { RecordForm, type Field, type RecordData } from "./RecordForm";
import { cardClass, fieldSkin, ghostButtonClass, hintClass, metaClass } from "./styles";

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
 * These tables hold a handful of rows each — except the board, which holds two
 * hundred and forty-two — so a separate route per record would mean a page load
 * to change a word. Everything is on the page already; opening a row just
 * reveals it. The filter box is what makes that scale: it matches the row's
 * headline, its dim line and its key, which between them carry the date, the
 * collection and the first words of the text.
 *
 * Rows arrive with their labels already composed. A server component may hand
 * a Server Action across this boundary but not an ordinary function, so
 * anything like `labelOf` has to be applied before the props are built.
 *
 * `blank` puts a "new row" form behind a button at the top — open, it is the
 * same form as an existing row's — and `deleteAction` a delete control inside
 * each row.
 */
export function RecordList({
  action,
  fields,
  rows,
  blank,
  blankLabel = "新建",
  deleteAction,
  /** The word this table counts in: 条 / 篇 / 张. */
  unit = "条",
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  fields: Field[];
  rows: ListRow[];
  /** Starting values for a new row; omit to make the list edit-only. */
  blank?: RecordData;
  blankLabel?: string;
  deleteAction?: (form: FormData) => Promise<void>;
  unit?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      `${row.id} ${row.label} ${row.meta ?? ""}`.toLowerCase().includes(needle)
    );
  }, [rows, query]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {rows.length > 8 && (
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <svg
              viewBox="0 0 16 16"
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-fg-tertiary"
            >
              <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="筛选…"
              aria-label="筛选这张表"
              className={`${fieldSkin} h-10 w-full pr-3 pl-9 text-body placeholder:text-fg-tertiary/60`}
            />
          </div>
        )}

        {/* The plain total is already beside the page title — this line only
            has something to add once the list is being filtered. */}
        {query && (
          <span className={`${metaClass} tabular-nums`}>
            {shown.length} / {rows.length} {unit}
          </span>
        )}

        {blank && (
          <button
            type="button"
            onClick={() => {
              setCreating((value) => !value);
              setOpen(null);
            }}
            aria-expanded={creating}
            className={`${ghostButtonClass} ml-auto`}
          >
            <span aria-hidden className="text-fg-tertiary">
              {creating ? "×" : "+"}
            </span>
            {creating ? "收起" : blankLabel}
          </button>
        )}
      </div>

      {blank && creating && (
        <section className={`${cardClass} mt-4 p-5 animate-[admin-pop_160ms_ease-out] sm:p-6`}>
          <h2 className={`${metaClass} mb-4`}>{blankLabel}</h2>
          <RecordForm action={action} fields={fields} record={blank} isNew />
        </section>
      )}

      <ul className="mt-5 divide-y divide-line border-y border-line">
        {shown.map((row) => {
          const isOpen = open === row.id;
          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : row.id)}
                aria-expanded={isOpen}
                className={`group flex min-h-12 w-full items-baseline gap-4 px-2 py-2.5 text-left transition-colors hover:bg-surface/60 ${
                  isOpen ? "bg-surface/60" : ""
                }`}
              >
                <span
                  aria-hidden
                  className={`font-mono text-meta transition-colors ${
                    isOpen ? "text-accent" : "text-fg-tertiary"
                  }`}
                >
                  {isOpen ? "−" : "+"}
                </span>
                <span className="flex-1 truncate text-body group-hover:text-accent">
                  {row.label || <span className="text-fg-tertiary">（空）</span>}
                </span>
                {row.meta && (
                  <span className="shrink-0 font-mono text-meta text-fg-tertiary">
                    {row.meta}
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="px-2 pt-2 pb-8 animate-[admin-pop_160ms_ease-out]">
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

      {shown.length === 0 && (
        <p className={`mt-6 ${hintClass}`}>
          {rows.length === 0 ? "还没有内容。" : `没有匹配「${query}」的。`}
        </p>
      )}
    </>
  );
}
