"use client";

import { useMemo, useState } from "react";
import type { ActionState } from "../actions/shared";
import { RecordForm, type Field, type RecordData } from "./RecordForm";
import { cardClass, fieldSkin, ghostButtonClass, hintClass, metaClass } from "../styles";
import { MediaGallery, type PreviewMedia } from "./MediaPreview";

type ListRow = {
  /** Stable identity, and the key React uses. */
  id: string;
  /** The row's headline, composed on the server. */
  label: string;
  /** The dimmer line beside it. */
  meta?: string;
  /** Not on the public page yet. A list with any such row can show only those. */
  draft?: boolean;
  /** The row's own page out front, when it has one — drafts included, through
   *  the preview (`/admin/preview`). */
  view?: string;
  /** Saved files can be checked without opening their editing form. */
  media?: PreviewMedia[];
  data: RecordData;
};

/** Which rows the list shows, by whether they are out front. */
type View = "all" | "public" | "draft";

const VIEWS: { view: View; label: string }[] = [
  { view: "all", label: "全部" },
  { view: "public", label: "已公开" },
  { view: "draft", label: "草稿" },
];

/**
 * A list where each row opens into its own form.
 *
 * These tables hold a handful of rows each, apart from the board; a separate
 * route per record would mean a page load
 * to change a word. Everything is on the page already; opening a row just
 * reveals it. The filter box is what makes that scale: it matches the row's
 * headline, its dim line and its key, which between them carry the date, the
 * collection and the first words of the text. Where some rows are drafts, a
 * row of three buttons beside it narrows the list to the published ones or
 * the drafts — an import can bring in dozens of drafts, each waiting on a
 * decision, and a text match on "草稿" also finds a line that says the word.
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
  const [view, setView] = useState<View>("all");

  const drafts = useMemo(() => rows.filter((row) => row.draft).length, [rows]);
  // With no drafts left the buttons are gone, so a stale choice must not keep
  // hiding the list behind them.
  const current = drafts ? view : "all";

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (current === "all" || (current === "draft") === Boolean(row.draft)) &&
        (!needle || `${row.id} ${row.label} ${row.meta ?? ""}`.toLowerCase().includes(needle)),
    );
  }, [rows, query, current]);
  const narrowed = Boolean(query) || current !== "all";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {rows.length > 8 && (
          <div className="relative min-w-0 basis-full sm:max-w-xs sm:flex-1 sm:basis-auto">
            <svg
              viewBox="0 0 16 16"
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-fg-tertiary"
            >
              <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="m10.5 10.5 3 3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="筛选…"
              aria-label="筛选这张表"
              className={`${fieldSkin} h-12 w-full pr-3 pl-9 text-body placeholder:text-fg-tertiary`}
            />
          </div>
        )}

        {drafts > 0 && (
          <div role="group" aria-label="按公开状态筛选" className="flex gap-1.5">
            {VIEWS.map(({ view: value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                aria-pressed={current === value}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-chip border px-3 text-caption transition-colors ${
                  current === value
                    ? "border-fg bg-fg text-bg"
                    : "border-line bg-surface-raised text-fg-secondary hover:border-fg-tertiary/40 hover:text-fg"
                }`}
              >
                {label}
                {value === "draft" && <span className="font-mono tabular-nums">{drafts}</span>}
              </button>
            ))}
          </div>
        )}

        {/* The plain total is already beside the page title — this line only
            has something to add once the list is being filtered. */}
        {narrowed && (
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
                className={`group flex min-h-15 w-full items-baseline gap-3 px-2 py-3.5 text-left transition-colors hover:bg-surface/60 ${
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
                <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
                  <span
                    className={`line-clamp-2 min-w-0 flex-1 break-words text-body group-hover:text-accent ${
                      row.draft ? "text-fg-secondary" : ""
                    }`}
                  >
                    {row.label || <span className="text-fg-tertiary">（空）</span>}
                  </span>
                  {row.meta && (
                    <span className="font-mono text-meta break-words text-fg-tertiary sm:max-w-[40%] sm:text-right">
                      {row.meta}
                    </span>
                  )}
                </span>
              </button>

              {!isOpen && Boolean(row.media?.length) && (
                <div className="px-2 pt-1 pb-4 sm:pl-8">
                  <MediaGallery items={row.media!} compact limit={3} />
                </div>
              )}

              {isOpen && (
                <div className="px-2 pt-2 pb-8 animate-[admin-pop_160ms_ease-out]">
                  <RecordForm
                    action={action}
                    fields={fields}
                    record={row.data}
                    deleteAction={deleteAction}
                    view={row.view}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {shown.length === 0 && (
        <p className={`mt-6 ${hintClass}`}>
          {rows.length === 0
            ? "还没有内容。"
            : query
              ? `没有匹配「${query}」的。`
              : "这一栏是空的。"}
        </p>
      )}
    </>
  );
}
