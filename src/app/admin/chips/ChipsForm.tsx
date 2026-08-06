"use client";

import { useActionState, useEffect, useState } from "react";
import { saveChips, type ActionState } from "../actions";
import { inputClass, labelClass } from "../AdminChrome";
import { SaveControls } from "../SaveControls";

type ChipRow = {
  label: { zh: string; en: string };
  tone: "paper" | "ink" | "accent";
};

/**
 * The whole wall on one page, in order.
 *
 * Rows are positional: what you see is the order they appear on the wall, and
 * clearing both language fields is how one goes away. That keeps adding,
 * removing and reordering as the same gesture instead of three buttons.
 *
 * Inputs are controlled and re-synced from the server after a save. The save
 * rewrites the whole table, so a form still showing stale values would
 * quietly write them back — deleted rows included.
 */
export function ChipsForm({ chips }: { chips: ChipRow[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveChips,
    {}
  );
  const [rows, setRows] = useState(chips);
  useEffect(() => setRows(chips), [chips]);

  const edit = (index: number, row: ChipRow) =>
    setRows(rows.map((r, i) => (i === index ? row : r)));

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
                value={chip.label.zh}
                onChange={(e) =>
                  edit(i, { ...chip, label: { ...chip.label, zh: e.target.value } })
                }
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              {i === 0 && <span className={labelClass}>English</span>}
              <input
                name={`chip.${i}.label.en`}
                value={chip.label.en}
                onChange={(e) =>
                  edit(i, { ...chip, label: { ...chip.label, en: e.target.value } })
                }
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              {i === 0 && <span className={labelClass}>纸色</span>}
              <select
                name={`chip.${i}.tone`}
                value={chip.tone}
                onChange={(e) =>
                  edit(i, { ...chip, tone: e.target.value as ChipRow["tone"] })
                }
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
        onClick={() =>
          setRows([...rows, { label: { zh: "", en: "" }, tone: "paper" }])
        }
        className="mt-4 text-caption text-fg-tertiary hover:text-accent"
      >
        + 加一张
      </button>

      <SaveControls state={state} pending={pending} sticky />
    </form>
  );
}
