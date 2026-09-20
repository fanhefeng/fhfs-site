"use client";

import { useState } from "react";
import type { CopyEntry } from "@/lib/copy";
import { saveCopy } from "../actions/copy";
import { cardClass, fieldSkin, hintClass, inputClass, metaClass } from "../styles";
import { SaveControls } from "../SaveControls";
import { useSaveAction } from "../ui/useSaveAction";

/**
 * One namespace of the catalogue, edited as a whole.
 *
 * Every field starts on what the site currently says — the override if there
 * is one, otherwise the line from `messages/*.json` — so editing is always
 * "change these words", never "fill this in". Clearing a field is how you take
 * an override back off, and the default is printed under any line that carries
 * one so you can see what it would go back to.
 *
 * The filter *hides* rather than unmounts, the way it always has: a row taken
 * out of the DOM would reach the action as a field that isn't there, and the
 * one thing this page must never do is let what is filtered in decide what
 * gets saved. (The action ignores keys the form doesn't carry, which is the
 * second belt on the same trousers.)
 */
export function CopyForm({ namespace, entries }: { namespace: string; entries: CopyEntry[] }) {
  const { state, pending, formProps } = useSaveAction(saveCopy);
  const [query, setQuery] = useState("");
  const [onlyEdited, setOnlyEdited] = useState(false);

  const needle = query.trim().toLowerCase();
  const matches = (entry: CopyEntry) =>
    (!onlyEdited || entry.overridden) &&
    (!needle || `${entry.key} ${entry.zh} ${entry.en}`.toLowerCase().includes(needle));
  const hits = entries.filter(matches).length;
  const edited = entries.filter((entry) => entry.overridden).length;

  return (
    <form {...formProps}>
      <input type="hidden" name="namespace" value={namespace} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
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
            placeholder="按 key 或文案找…"
            aria-label="筛选文案"
            className={`${fieldSkin} h-10 w-full pr-3 pl-9 text-body placeholder:text-fg-tertiary/60`}
          />
        </div>

        <button
          type="button"
          onClick={() => setOnlyEdited((value) => !value)}
          aria-pressed={onlyEdited}
          className={`rounded-chip border px-2.5 py-1 font-mono text-meta transition-colors ${
            onlyEdited
              ? "border-accent bg-accent/10 text-accent"
              : "border-line text-fg-tertiary hover:text-fg"
          }`}
        >
          只看改过的 {edited}
        </button>

        <span className={`${metaClass} tabular-nums`}>
          {hits} / {entries.length} 条
        </span>
      </div>

      <div className={`${cardClass} mt-4 divide-y divide-line`}>
        {entries.map((entry) => (
          <div key={entry.key} className={`p-5 sm:p-6 ${matches(entry) ? "" : "hidden"}`}>
            <p className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-meta text-fg-tertiary">
                {entry.key.slice(namespace.length + 1)}
              </span>
              {entry.overridden && (
                <span className="rounded-chip border border-accent/40 px-1.5 font-mono text-meta text-accent">
                  改过
                </span>
              )}
            </p>
            {entry.note && <p className={`mt-1 max-w-[70ch] ${hintClass}`}>{entry.note}</p>}

            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="font-mono text-meta text-fg-tertiary">zh</span>
                <input name={`${entry.key}.zh`} defaultValue={entry.zh} className={inputClass} />
                {entry.overridden && <Default value={entry.zhDefault} />}
              </label>
              <label className="space-y-1">
                <span className="font-mono text-meta text-fg-tertiary">en</span>
                <input name={`${entry.key}.en`} defaultValue={entry.en} className={inputClass} />
                {entry.overridden && <Default value={entry.enDefault} />}
              </label>
            </div>
          </div>
        ))}
      </div>

      {hits === 0 && (
        <p className={`mt-6 ${hintClass}`}>
          {onlyEdited && !needle ? "这一组还没有改过的文案。" : `没有匹配「${query}」的文案。`}
        </p>
      )}

      <SaveControls state={state} pending={pending} label="保存这一组" sticky />
    </form>
  );
}

/** What the field goes back to if it is cleared — shown only where it differs
 *  from what is in the box, which is exactly the overridden lines. */
function Default({ value }: { value: string }) {
  return (
    <p className={hintClass}>
      默认：{value === "" ? <span className="opacity-60">（空）</span> : value}
    </p>
  );
}
