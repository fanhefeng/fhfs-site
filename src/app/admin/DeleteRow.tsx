"use client";

import { useState } from "react";
import { dangerButtonClass, ghostButtonClass, hintClass } from "./styles";

/**
 * The delete control every editable row ends with.
 *
 * It arms rather than confirming: the first press swaps the button for the
 * sentence and the real one. `window.confirm` did the same job, but it is a
 * grey OS box dropped on a themed page, it can't say *what* is about to go, and
 * on a fast double-click the second click lands on the dialog. This version is
 * two deliberate presses in the page's own material.
 *
 * `fields` are the hidden inputs the delete action keys on — `key` for most
 * tables, `slug` + `locale` for the ones that hold one row per language.
 */
export function DeleteRow({
  action,
  fields,
  what,
  label = "删除这条",
}: {
  action: (form: FormData) => Promise<void>;
  fields: { [name: string]: string };
  /** What is about to be deleted, in the words the editor sees elsewhere. */
  what: string;
  label?: string;
}) {
  const [armed, setArmed] = useState(false);

  return (
    <form action={action} className="mt-8 border-t border-line pt-5">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {armed ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className={hintClass}>
            删掉「<span className="font-mono">{what}</span>」，没有回收站。
          </p>
          <button type="submit" className={dangerButtonClass}>
            确认删除
          </button>
          <button type="button" onClick={() => setArmed(false)} className={ghostButtonClass}>
            算了
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="text-caption text-fg-tertiary transition-colors hover:text-accent"
        >
          {label}（{what}）
        </button>
      )}
    </form>
  );
}
