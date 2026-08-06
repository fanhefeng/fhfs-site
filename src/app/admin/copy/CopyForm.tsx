"use client";

import { useActionState } from "react";
import { saveCopy, type ActionState } from "../actions";
import { inputClass, labelClass } from "../AdminChrome";
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
 */
export function CopyForm({ rows }: { rows: CopyRow[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveCopy,
    {}
  );

  const groups = new Map<string, CopyRow[]>();
  for (const row of rows) {
    const namespace = row.key.split(".")[0];
    groups.set(namespace, [...(groups.get(namespace) ?? []), row]);
  }

  return (
    <form action={formAction}>
      {[...groups].map(([namespace, items]) => (
        <section key={namespace} className="mb-10">
          <h2 className={labelClass}>{namespace}</h2>
          <div className="mt-3 space-y-5 border-t border-line pt-4">
            {items.map((row) => (
              <div key={row.key}>
                <p className="font-mono text-meta text-fg-tertiary">
                  {row.key.slice(namespace.length + 1)}
                </p>
                {row.note && (
                  <p className="mt-1 max-w-[70ch] text-caption text-fg-tertiary">
                    {row.note}
                  </p>
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
      ))}

      <SaveControls state={state} pending={pending} label="保存全部" sticky />
    </form>
  );
}
