"use client";

import { useActionState, useState } from "react";
import { saveCopy } from "../actions/copy";
import type { ActionState } from "../actions/shared";
import { cardClass, fieldSkin, hintClass, inputClass, metaClass } from "../styles";
import { SaveControls } from "../SaveControls";

type CopyRow = {
  key: string;
  zh: string;
  en: string;
  note: string | null;
};

/**
 * All of the site's copy on one page, grouped by namespace.
 *
 * One page rather than one row at a time, because several of these lines only
 * work in relation to each other: the hero's subtitle is deliberately in the
 * other language from the two lines above it, the slogan and its echo are the
 * same sentence twice, and the footer's two time fragments are a word-order
 * pair. Editing them in separate forms would hide exactly the thing that needs
 * to be looked at together.
 *
 * A hundred-odd rows is more than one screen, so there is a filter — and it
 * *hides* rather than unmounts. The action writes every key the form carries;
 * a row taken out of the DOM would simply not be saved, and the one thing this
 * page must never do is make a save depend on what happens to be filtered in.
 */
export function CopyForm({ rows }: { rows: CopyRow[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveCopy,
    {}
  );
  const [query, setQuery] = useState("");

  const groups = new Map<string, CopyRow[]>();
  for (const row of rows) {
    const namespace = row.key.split(".")[0]!;
    groups.set(namespace, [...(groups.get(namespace) ?? []), row]);
  }

  const needle = query.trim().toLowerCase();
  const matches = (row: CopyRow) =>
    !needle ||
    `${row.key} ${row.zh} ${row.en} ${row.note ?? ""}`.toLowerCase().includes(needle);
  const hits = rows.filter(matches).length;

  return (
    <form action={formAction}>
      <div className="flex flex-wrap items-center gap-3">
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
            placeholder="按 key 或文案找…"
            aria-label="筛选文案"
            className={`${fieldSkin} h-10 w-full pr-3 pl-9 text-body placeholder:text-fg-tertiary/60`}
          />
        </div>
        {/* The total is already beside the title; this counts what is left
            after filtering, which is the only number the box needs. */}
        {needle && (
          <span className={`${metaClass} tabular-nums`}>
            {hits} / {rows.length} 条
          </span>
        )}
      </div>

      {/* Jump to one namespace by filtering to it — the list of namespaces is
          also the only table of contents this page has. */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[...groups.keys()].map((namespace) => {
          const active = needle === `${namespace}.`;
          return (
            <button
              key={namespace}
              type="button"
              onClick={() => setQuery(active ? "" : `${namespace}.`)}
              className={`rounded-chip border px-2.5 py-1 font-mono text-meta transition-colors ${
                active
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-line text-fg-tertiary hover:text-fg"
              }`}
            >
              {namespace}
            </button>
          );
        })}
      </div>

      <div className="mt-6 space-y-5">
        {[...groups].map(([namespace, items]) => {
          const shown = items.filter(matches).length;
          return (
            <section
              key={namespace}
              className={`${cardClass} p-5 sm:p-6 ${shown === 0 ? "hidden" : ""}`}
            >
              <h2 className={`${metaClass} border-b border-line pb-2`}>
                {namespace}
                <span className="ml-2 tabular-nums opacity-70">
                  {shown === items.length ? items.length : `${shown} / ${items.length}`}
                </span>
              </h2>

              <div className="mt-4 space-y-5">
                {items.map((row) => (
                  <div key={row.key} className={matches(row) ? "" : "hidden"}>
                    <p className="font-mono text-meta text-fg-tertiary">
                      {row.key.slice(namespace.length + 1)}
                    </p>
                    {row.note && (
                      <p className={`mt-1 max-w-[70ch] ${hintClass}`}>{row.note}</p>
                    )}
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1">
                        <span className="font-mono text-meta text-fg-tertiary">zh</span>
                        <input
                          name={`${row.key}.zh`}
                          defaultValue={row.zh}
                          className={inputClass}
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="font-mono text-meta text-fg-tertiary">en</span>
                        <input
                          name={`${row.key}.en`}
                          defaultValue={row.en}
                          className={inputClass}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {hits === 0 && (
        <p className={`mt-6 ${hintClass}`}>没有匹配「{query}」的文案。</p>
      )}

      <SaveControls state={state} pending={pending} label="保存全部" sticky />
    </form>
  );
}
