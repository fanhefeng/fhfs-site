"use client";

import { useActionState, useState } from "react";
import { saveChips, type ActionState } from "../actions";
import { buttonClass, inputClass, labelClass } from "../AdminChrome";

export type ChipRow = {
  label: { zh: string; en: string };
  tone: "paper" | "ink" | "accent";
};

const BLANK: ChipRow = { label: { zh: "", en: "" }, tone: "paper" };

/**
 * The whole wall on one page, in order.
 *
 * Rows are positional: what you see is the order they appear on the wall, and
 * clearing both language fields is how one goes away. That keeps adding,
 * removing and reordering as the same gesture instead of three buttons.
 */
export function ChipsForm({ chips }: { chips: ChipRow[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveChips,
    {}
  );
  const [rows, setRows] = useState<ChipRow[]>(chips);

  return (
    <form action={formAction}>
      <div className="space-y-3">
        {rows.map((chip, i) => (
          <div
            key={i}
            className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem] sm:items-end"
          >
            <label className="space-y-1">
              {i === 0 && <span className={labelClass}>中文</span>}
              <input
                name={`chip.${i}.label.zh`}
                defaultValue={chip.label.zh}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              {i === 0 && <span className={labelClass}>English</span>}
              <input
                name={`chip.${i}.label.en`}
                defaultValue={chip.label.en}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              {i === 0 && <span className={labelClass}>纸色</span>}
              <select
                name={`chip.${i}.tone`}
                defaultValue={chip.tone}
                className={inputClass}
              >
                <option value="paper">paper</option>
                <option value="ink">ink</option>
                <option value="accent">accent</option>
              </select>
            </label>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRows([...rows, { ...BLANK, label: { zh: "", en: "" } }])}
        className="mt-4 text-caption text-fg-tertiary hover:text-accent"
      >
        + 加一张
      </button>

      <div className="sticky bottom-0 mt-6 flex items-center gap-4 border-t border-line bg-bg py-4">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "保存中…" : "保存"}
        </button>
        {state.error && (
          <p className="text-caption text-accent" role="alert">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="text-caption text-fg-secondary" role="status">
            已保存，前台已刷新。
          </p>
        )}
      </div>
    </form>
  );
}
