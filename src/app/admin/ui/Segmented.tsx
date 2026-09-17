"use client";

import { metaClass } from "../styles";

/**
 * A two-or-three-way choice shown in full, as a segmented control.
 *
 * Anything with a handful of options and a real default — 公开/草稿,
 * 原创/摘录, zh/en — reads better as a row you can see all of than as a
 * dropdown you have to open to learn what the alternatives even are. The
 * markup is a radio group, so arrow keys, form reset and the submitted value
 * are the browser's own; only the skin is ours.
 *
 * `tone: "accent"` paints the chosen segment amber instead of ink — for the
 * choice that means "this is not live yet".
 */
export function Segmented({
  name,
  options,
  defaultValue,
  tone = "ink",
}: {
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  /** Which segment colour the chosen option gets. */
  tone?: "ink" | "accent";
}) {
  const chosen =
    tone === "accent"
      ? "peer-checked:bg-accent peer-checked:text-bg"
      : "peer-checked:bg-fg peer-checked:text-bg";

  return (
    <div
      role="radiogroup"
      className="inline-flex rounded-chip border border-line bg-surface p-1"
    >
      {options.map((option) => (
        <label key={option.value} className="relative cursor-pointer">
          <input
            type="radio"
            name={name}
            value={option.value}
            defaultChecked={option.value === defaultValue}
            className="peer sr-only"
          />
          <span
            className={`block rounded-[calc(var(--r-chip)-0.25rem)] px-3.5 py-1.5 text-caption text-fg-secondary transition-colors peer-focus-visible:ring-[3px] peer-focus-visible:ring-accent/25 ${chosen}`}
          >
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}

/**
 * The same control for a boolean that a Server Action reads as a checkbox
 * (`form.get("draft") === "on"`). A hidden checkbox holds the state and a pair
 * of labels drive it, so the submitted field stays exactly what it was.
 */
export function Toggle({
  name,
  defaultChecked = false,
  label,
  onLabel = "是",
  offLabel = "否",
  hint,
}: {
  name: string;
  defaultChecked?: boolean;
  label: string;
  onLabel?: string;
  offLabel?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="peer sr-only"
        />
        {/* The track. The knob is a child rather than a sibling of the input, so
            the moving rule has to be written from the track: `peer-checked` can
            only ever reach siblings. */}
        <span className="relative h-6 w-11 shrink-0 rounded-full border border-line bg-surface transition-colors peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:ring-[3px] peer-focus-visible:ring-accent/25 peer-checked:[&>span]:translate-x-5">
          <span className="absolute top-[2px] left-[2px] size-[1.125rem] rounded-full bg-surface-raised shadow-card transition-transform duration-200" />
        </span>
        <span className="text-caption text-fg-secondary">{label}</span>
        {/* The state in a word, so the switch is readable without knowing
            which way is "on" — only one of the two is ever shown. */}
        <span className={`${metaClass} peer-checked:hidden`}>{offLabel}</span>
        <span className={`${metaClass} hidden text-accent peer-checked:inline`}>
          {onLabel}
        </span>
      </label>
      {hint && (
        <p className="mt-1.5 ml-14 text-caption text-fg-tertiary">{hint}</p>
      )}
    </div>
  );
}
