"use client";

import { useId, useRef, useState } from "react";
import { hintClass, inputClass, labelClass, monoClass, textareaClass } from "../styles";
import { Select, type SelectOption } from "./Select";

type RowData = { [field: string]: unknown };

/** A row's plain field as text — the leaves are strings and numbers; the pairs are read apart. */
const leaf = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";

/** One field of a row: the same kinds `RecordForm` draws, minus the ones a row never needs. */
export type RowField =
  | {
      name: string;
      label: string;
      kind: "text";
      placeholder?: string;
      /** For addresses and ids, not prose. */
      mono?: boolean;
      /** Across the whole row, for an address. */
      wide?: boolean;
    }
  | { name: string; label: string; kind: "number" }
  | { name: string; label: string; kind: "select"; options: SelectOption[] }
  | { name: string; label: string; kind: "localized" }
  | { name: string; label: string; kind: "localizedArea"; rows?: number };

export type RowsSpec = {
  fields: RowField[];
  /** A new row's values. */
  blank: RowData;
  /** What one row is called, for its heading and its buttons: 张 / 句 / 条. */
  noun: string;
  /** Rows that are pictures: each shows its own beside its fields. */
  pictures?: boolean;
};

type Row = { uid: number; data: RowData };

/**
 * A repeated group inside a record — the stills on a film's wall, the lines
 * it quotes, an idol's milestones — edited in place: add, remove, move up or
 * down, and each row's own fields.
 *
 * The inputs stay uncontrolled, as every admin form's are (`useSaveAction`
 * keeps them from being reset). Each row is keyed by an identity of its own,
 * not by its position, so moving a row moves its inputs with whatever has
 * been typed into them; the names carry the position the row stands at now —
 * `<group>.<position>.<field>` — which is the order the action reads
 * (`formRows`).
 */
export function RowsField({
  name,
  label,
  hint,
  spec,
  defaultRows,
}: {
  name: string;
  label: string;
  hint?: string;
  spec: RowsSpec;
  defaultRows: RowData[];
}) {
  const next = useRef(0);
  const make = (data: RowData): Row => ({ uid: next.current++, data });
  const [rows, setRows] = useState<Row[]>(() => defaultRows.map(make));
  const groupId = useId();

  const move = (from: number, to: number) =>
    setRows((all) => {
      if (to < 0 || to >= all.length) return all;
      const copy = [...all];
      const [row] = copy.splice(from, 1);
      copy.splice(to, 0, row!);
      return copy;
    });

  return (
    <div role="group" aria-labelledby={groupId} className="space-y-3">
      <div>
        <span id={groupId} className={labelClass}>
          {label}
          <span className="normal-case tabular-nums">
            · {rows.length} {spec.noun}
          </span>
        </span>
        {hint && <p className={`mt-1 ${hintClass}`}>{hint}</p>}
      </div>

      {rows.length > 0 && (
        <ol className="space-y-3">
          {rows.map((row, i) => (
            <li key={row.uid} className="rounded-chip border border-line p-3 sm:p-4">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="font-mono text-meta text-fg-tertiary tabular-nums">
                  第 {i + 1} {spec.noun}
                </span>
                <span className="ml-auto flex gap-1.5">
                  <RowButton label="上移" disabled={i === 0} onClick={() => move(i, i - 1)}>
                    ↑
                  </RowButton>
                  <RowButton
                    label="下移"
                    disabled={i === rows.length - 1}
                    onClick={() => move(i, i + 1)}
                  >
                    ↓
                  </RowButton>
                  <RowButton
                    label={`去掉这${spec.noun}`}
                    onClick={() => setRows((all) => all.filter((r) => r.uid !== row.uid))}
                  >
                    ×
                  </RowButton>
                </span>
              </div>
              <div className={spec.pictures ? "grid gap-4 sm:grid-cols-[7rem_1fr]" : undefined}>
                {spec.pictures && <Thumb src={leaf(row.data.src)} />}
                <div className="grid gap-3 sm:grid-cols-4">
                  {spec.fields.map((field) => (
                    <RowInput
                      key={field.name}
                      field={field}
                      name={`${name}.${i}.${field.name}`}
                      value={row.data[field.name]}
                      onChange={
                        // The picture follows its address as it is typed.
                        spec.pictures && field.name === "src"
                          ? (src) =>
                              setRows((all) =>
                                all.map((r) =>
                                  r.uid === row.uid ? { ...r, data: { ...r.data, src } } : r,
                                ),
                              )
                          : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <button
        type="button"
        onClick={() => setRows((all) => [...all, make({ ...spec.blank })])}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 font-mono text-meta text-fg-secondary transition-colors hover:border-fg-tertiary hover:text-fg"
      >
        <span aria-hidden className="text-fg-tertiary">
          +
        </span>
        加一{spec.noun}
      </button>
    </div>
  );
}

function RowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-full border border-line font-mono text-meta text-fg-secondary transition-colors hover:border-fg-tertiary hover:text-fg disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  );
}

/** The picture a row describes, straight from its address — `public/` serves the plain path. */
function Thumb({ src }: { src: string }) {
  return src ? (
    // oxlint-disable-next-line nextjs/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      className="aspect-square w-28 rounded-lg border border-line bg-surface object-cover"
    />
  ) : (
    <span className="grid aspect-square w-28 place-items-center rounded-lg border border-dashed border-line font-mono text-meta text-fg-tertiary">
      没有图
    </span>
  );
}

function RowInput({
  field,
  name,
  value,
  onChange,
}: {
  field: RowField;
  name: string;
  value: unknown;
  onChange?: (value: string) => void;
}) {
  const labelId = useId();

  if (field.kind === "localized" || field.kind === "localizedArea") {
    const pair = (value ?? {}) as { zh?: string; en?: string };
    return (
      <div className="sm:col-span-4">
        <span className={labelClass}>{field.label}</span>
        <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
          {(["zh", "en"] as const).map((locale) => (
            <label key={locale} className="space-y-1">
              <span className="font-mono text-meta text-fg-tertiary">{locale}</span>
              {field.kind === "localizedArea" ? (
                <textarea
                  name={`${name}.${locale}`}
                  defaultValue={pair[locale] ?? ""}
                  rows={field.rows ?? 3}
                  className={textareaClass}
                />
              ) : (
                <input
                  name={`${name}.${locale}`}
                  defaultValue={pair[locale] ?? ""}
                  className={inputClass}
                />
              )}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.kind === "select") {
    return (
      <div className="space-y-1.5">
        <span id={labelId} className={labelClass}>
          {field.label}
        </span>
        <Select
          name={name}
          labelledBy={labelId}
          defaultValue={leaf(value)}
          options={field.options}
        />
      </div>
    );
  }

  return (
    <label
      className={`block space-y-1.5 ${field.kind === "text" && field.wide ? "sm:col-span-4" : ""}`}
    >
      <span className={labelClass}>{field.label}</span>
      <input
        name={name}
        type={field.kind === "number" ? "number" : "text"}
        inputMode={field.kind === "number" ? "numeric" : undefined}
        defaultValue={leaf(value)}
        placeholder={field.kind === "text" ? field.placeholder : undefined}
        onChange={onChange && ((event) => onChange(event.target.value))}
        spellCheck={field.kind === "text" && field.mono ? false : undefined}
        className={`${inputClass} ${field.kind === "number" ? "tabular-nums" : ""} ${
          field.kind === "text" && field.mono ? monoClass : ""
        }`}
      />
    </label>
  );
}
