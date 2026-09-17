"use client";

import { useActionState, useEffect, useState } from "react";
import { saveChips, type ActionState } from "../actions";
import { ghostButtonClass, inputClass, labelClass } from "../styles";
import { SaveControls } from "../SaveControls";
import { Select } from "../ui/Select";

type ChipRow = {
  label: { zh: string; en: string };
  tone: "paper" | "ink" | "accent";
};

/** The three papers a chip can be cut from, named the way the wall reads. */
const TONES = [
  { value: "paper", label: "paper · 纸白", hint: "默认的那种，大多数用它" },
  { value: "ink", label: "ink · 墨黑", hint: "深色纸，压一压版面" },
  { value: "accent", label: "accent · 琥珀", hint: "全站唯一的强调色，别用多" },
];

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
            <div className="space-y-1">
              {i === 0 && <span className={labelClass}>纸色</span>}
              <Select
                name={`chip.${i}.tone`}
                value={chip.tone}
                onValueChange={(tone) =>
                  edit(i, { ...chip, tone: tone as ChipRow["tone"] })
                }
                options={TONES}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          setRows([...rows, { label: { zh: "", en: "" }, tone: "paper" }])
        }
        className={`${ghostButtonClass} mt-4`}
      >
        <span aria-hidden className="text-fg-tertiary">
          +
        </span>
        加一张
      </button>

      <SaveControls state={state} pending={pending} sticky />
    </form>
  );
}
