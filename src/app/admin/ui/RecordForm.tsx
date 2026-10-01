"use client";

import { useId } from "react";
import type { ActionState } from "../actions/shared";
import { hintClass, inputClass, labelClass, metaClass, monoClass, textareaClass } from "../styles";
import { SaveControls } from "./SaveControls";
import { DeleteRow } from "./DeleteRow";
import { Select, type SelectOption } from "./Select";
import { Segmented } from "./Segmented";
import { useFieldErrors } from "./fieldErrors";
import { KEY_MESSAGE, KEY_PATTERN } from "@/lib/forms";
import { RowsField, type RowsSpec } from "./RowsField";
import { useSaveAction } from "./useSaveAction";

export type Field =
  | {
      name: string;
      label: string;
      kind: "text";
      placeholder?: string;
      readOnly?: boolean;
      hint?: string;
      /** Optional heading this field is filed under. */
      group?: string;
    }
  | { name: string; label: string; kind: "number"; hint?: string; group?: string }
  /** A single-language textarea — for text that is what it is, not a translation pair.
   *  `mono` sets it in the code face with no spellcheck, for lines that are
   *  addresses and numbers (the board's media field, `parseMedia`'s grammar). */
  | {
      name: string;
      label: string;
      kind: "area";
      rows?: number;
      hint?: string;
      group?: string;
      mono?: boolean;
    }
  | {
      name: string;
      label: string;
      kind: "select";
      /** Plain values, or values with a label and a line of explanation. */
      options: (string | SelectOption)[];
      hint?: string;
      group?: string;
    }
  | { name: string; label: string; kind: "localized"; hint?: string; group?: string }
  | {
      name: string;
      label: string;
      kind: "localizedArea";
      rows?: number;
      hint?: string;
      group?: string;
    }
  | { name: string; label: string; kind: "lines"; hint?: string; rows?: number; group?: string }
  /** A repeated group of small records — a film's stills, an idol's milestones.
   *  The record holds them as an array under `name`; see `ui/RowsField`. */
  | { name: string; label: string; kind: "rows"; hint?: string; group?: string; rows: RowsSpec };

export type RecordData = { [key: string]: unknown };

/** Two options that read as one switch get a segmented control instead of a
 *  listbox: seeing both words at once beats opening a panel to learn there
 *  were only ever two. */
const BINARY = new Set(["yes,no", "no,yes", "zh,en", "en,zh"]);

const optionValue = (option: string | SelectOption) =>
  typeof option === "string" ? option : option.value;
const optionLabel = (option: string | SelectOption) =>
  typeof option === "string" ? option : (option.label ?? option.value);

/**
 * One form for all the structured lists.
 *
 * They differ only in which fields they carry, and each one is short enough
 * that a bespoke component per table would be more code than the tables have
 * rows. Bilingual fields render as a pair of inputs side by side, which is the
 * only arrangement that makes a missing translation obvious.
 *
 * Fields carrying a `group` are filed under that heading, in the order the
 * groups first appear; the ones without stay in an unlabelled block at the top.
 * That is the whole of the layout logic — a table with six fields doesn't need
 * headings, and one with fifteen is unreadable without them.
 *
 * `foldEmpty` folds a group whose every field is empty behind its heading —
 * for the tables that carry more ways to say a thing than the content uses
 * (the resume keeps two), where a screen of blank boxes reads as lost data.
 * A folded field still submits: a closed <details> hides its inputs, it does
 * not take them out of the form.
 *
 * `isNew` turns the form into a "create" form: read-only fields (the key)
 * open up, and the action is told so it can refuse to overwrite an existing
 * row. `deleteAction` adds the delete control underneath, keyed by
 * `record.key`.
 */
export function RecordForm({
  action,
  fields,
  record,
  isNew = false,
  deleteAction,
  foldEmpty = false,
  view,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  fields: Field[];
  record: RecordData;
  isNew?: boolean;
  deleteAction?: (form: FormData) => Promise<void>;
  foldEmpty?: boolean;
  /** Where this row's own page is — shown beside the save button. */
  view?: string;
}) {
  const { state, pending, formProps } = useSaveAction(action);
  const formId = useId();
  const check = useFieldErrors();

  const value = (name: string): string => {
    const parts = name.split(".");
    let node: unknown = record;
    for (const part of parts) {
      node = (node as RecordData | undefined)?.[part];
    }
    // The leaves are strings, numbers, dates and string arrays (tags), and
    // String() is the form each one is edited in; nothing nests deeper.
    // oxlint-disable-next-line typescript/no-base-to-string
    return node == null ? "" : String(node);
  };

  const key = value("key");

  const hasValue = (field: Field): boolean => {
    if (field.kind === "rows") {
      const list = record[field.name];
      return Array.isArray(list) && list.length > 0;
    }
    if (field.kind === "lines") {
      const pair = record[field.name] as { [locale: string]: string[] } | undefined;
      return Boolean(pair?.zh?.some(Boolean) || pair?.en?.some(Boolean));
    }
    if (field.kind === "localized" || field.kind === "localizedArea") {
      return Boolean(value(`${field.name}.zh`) || value(`${field.name}.en`));
    }
    return Boolean(value(field.name));
  };

  // Grouped, in first-seen order, with the ungrouped block first.
  const groups: { name: string | null; fields: Field[] }[] = [];
  for (const field of fields) {
    const name = field.group ?? null;
    const bucket = groups.find((group) => group.name === name);
    if (bucket) bucket.fields.push(field);
    else groups.push({ name, fields: [field] });
  }
  // First-seen order alone put the ungrouped block first only when an
  // ungrouped field happened to be declared first — true of every table so
  // far, and not of the next one to put a group at the top of its list.
  const loose = groups.findIndex((group) => group.name === null);
  if (loose > 0) groups.unshift(...groups.splice(loose, 1));

  const renderField = (field: Field) => {
    const labelId = `${formId}-${field.name}`;

    if (field.kind === "localized" || field.kind === "localizedArea") {
      return (
        <div key={field.name}>
          <span className={labelClass}>{field.label}</span>
          {field.hint && <p className={`mt-1 ${hintClass}`}>{field.hint}</p>}
          <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
            {(["zh", "en"] as const).map((locale) => (
              <label key={locale} className="space-y-1">
                <span className="font-mono text-meta text-fg-tertiary">{locale}</span>
                {field.kind === "localizedArea" ? (
                  <textarea
                    name={`${field.name}.${locale}`}
                    defaultValue={value(`${field.name}.${locale}`)}
                    rows={field.rows ?? 3}
                    className={textareaClass}
                  />
                ) : (
                  <input
                    name={`${field.name}.${locale}`}
                    defaultValue={value(`${field.name}.${locale}`)}
                    className={inputClass}
                  />
                )}
              </label>
            ))}
          </div>
        </div>
      );
    }

    if (field.kind === "rows") {
      const list = record[field.name];
      return (
        <RowsField
          key={field.name}
          name={field.name}
          label={field.label}
          hint={field.hint}
          spec={field.rows}
          defaultRows={Array.isArray(list) ? (list as RecordData[]) : []}
        />
      );
    }

    if (field.kind === "area") {
      return (
        <label key={field.name} className="block space-y-1.5">
          <span className={labelClass}>{field.label}</span>
          {field.hint && <span className={`block ${hintClass}`}>{field.hint}</span>}
          <textarea
            name={field.name}
            defaultValue={value(field.name)}
            rows={field.rows ?? 6}
            spellCheck={field.mono ? false : undefined}
            className={field.mono ? `${textareaClass} ${monoClass}` : textareaClass}
          />
        </label>
      );
    }

    if (field.kind === "lines") {
      return (
        <div key={field.name}>
          <span className={labelClass}>{field.label}</span>
          {field.hint && <p className={`mt-1 ${hintClass}`}>{field.hint}</p>}
          <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
            {(["zh", "en"] as const).map((locale) => (
              <label key={locale} className="space-y-1">
                <span className="font-mono text-meta text-fg-tertiary">{locale}</span>
                <textarea
                  name={`${field.name}.${locale}`}
                  defaultValue={
                    (record[field.name] as { [k: string]: string[] })?.[locale]?.join("\n") ?? ""
                  }
                  rows={field.rows ?? 4}
                  className={`${textareaClass} ${monoClass}`}
                />
              </label>
            ))}
          </div>
        </div>
      );
    }

    if (field.kind === "select") {
      const values = field.options.map(optionValue);
      const binary = values.length === 2 && BINARY.has(values.join(","));
      return (
        <div key={field.name} className="space-y-1.5">
          <span id={labelId} className={labelClass}>
            {field.label}
          </span>
          {field.hint && <p className={hintClass}>{field.hint}</p>}
          {binary ? (
            <div>
              <Segmented
                name={field.name}
                labelledBy={labelId}
                defaultValue={value(field.name)}
                tone={values[1] === "yes" ? "accent" : "ink"}
                options={field.options.map((option) => ({
                  value: optionValue(option),
                  label: optionLabel(option),
                }))}
              />
            </div>
          ) : (
            <Select
              name={field.name}
              labelledBy={labelId}
              defaultValue={value(field.name)}
              options={field.options.map((option) =>
                typeof option === "string" ? { value: option } : option,
              )}
            />
          )}
        </div>
      );
    }

    // A new row's key has to be typed; an existing row's must not change.
    const readOnly = !isNew && field.kind === "text" && field.readOnly;
    // The read-only field of a table is its key, and a new one has to be typed.
    const typedKey = isNew && field.kind === "text" && field.readOnly;

    return (
      <label key={field.name} className="block space-y-1.5">
        <span className={labelClass}>{field.label}</span>
        {field.hint && <span className={`block ${hintClass}`}>{field.hint}</span>}
        <input
          name={field.name}
          type={field.kind === "number" ? "number" : "text"}
          defaultValue={value(field.name)}
          placeholder={"placeholder" in field ? field.placeholder : undefined}
          readOnly={readOnly || undefined}
          required={typedKey}
          pattern={typedKey ? KEY_PATTERN : undefined}
          data-mismatch={typedKey ? KEY_MESSAGE : undefined}
          className={`${inputClass} ${field.kind === "number" ? "tabular-nums" : ""}`}
          {...check.field(field.name)}
        />
        {check.message(field.name)}
      </label>
    );
  };

  return (
    <>
      <form {...formProps} className="space-y-6" {...check.formProps}>
        {isNew && <input type="hidden" name="isNew" value="1" />}

        {groups.map((group) =>
          foldEmpty && !isNew && group.name && !group.fields.some(hasValue) ? (
            <details key={group.name}>
              <summary className={`${metaClass} cursor-pointer border-b border-line pb-2`}>
                {group.name}
                <span className="ml-2 text-fg-tertiary normal-case">都空着 · 点开填写</span>
              </summary>
              <div className="mt-5 space-y-5">{group.fields.map(renderField)}</div>
            </details>
          ) : (
            <div key={group.name ?? "_"} className="space-y-5">
              {group.name && (
                <h3 className={`${metaClass} border-b border-line pb-2`}>{group.name}</h3>
              )}
              {group.fields.map(renderField)}
            </div>
          ),
        )}

        <SaveControls state={state} pending={pending} />
        {view && !isNew && (
          <a
            href={view}
            target="_blank"
            rel="noreferrer"
            className={`${hintClass} inline-block underline decoration-line underline-offset-4 hover:text-accent`}
          >
            在站上看上次保存的版本 ↗
          </a>
        )}
      </form>

      {deleteAction && !isNew && key && (
        <DeleteRow action={deleteAction} fields={{ key }} what={key} />
      )}
    </>
  );
}
