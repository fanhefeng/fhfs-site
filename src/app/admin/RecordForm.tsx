"use client";

import { useActionState } from "react";
import type { ActionState } from "./actions";
import { inputClass, labelClass } from "./AdminChrome";
import { SaveControls } from "./SaveControls";

export type Field =
  | {
      name: string;
      label: string;
      kind: "text";
      placeholder?: string;
      readOnly?: boolean;
      hint?: string;
    }
  | { name: string; label: string; kind: "number" }
  | { name: string; label: string; kind: "select"; options: string[] }
  | { name: string; label: string; kind: "localized" }
  | { name: string; label: string; kind: "localizedArea"; rows?: number }
  | { name: string; label: string; kind: "lines"; hint?: string };

export type RecordData = { [key: string]: unknown };

/**
 * One form for all the structured lists.
 *
 * They differ only in which fields they carry, and each one is short enough
 * that a bespoke component per table would be more code than the tables have
 * rows. Bilingual fields render as a pair of inputs side by side, which is the
 * only arrangement that makes a missing translation obvious.
 *
 * `isNew` turns the form into a "create" form: read-only fields (the key)
 * open up, and the action is told so it can refuse to overwrite an existing
 * row. `deleteAction` adds the delete form underneath, keyed by `record.key`,
 * the way WorkForm does it.
 */
export function RecordForm({
  action,
  fields,
  record,
  isNew = false,
  deleteAction,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  fields: Field[];
  record: RecordData;
  isNew?: boolean;
  deleteAction?: (form: FormData) => Promise<void>;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {}
  );

  const value = (name: string): string => {
    const parts = name.split(".");
    let node: unknown = record;
    for (const part of parts) {
      node = (node as RecordData | undefined)?.[part];
    }
    return node == null ? "" : String(node);
  };

  const key = value("key");

  return (
    <>
      <form action={formAction} className="space-y-5">
        {isNew && <input type="hidden" name="isNew" value="1" />}
        {fields.map((field) => {
          if (field.kind === "localized" || field.kind === "localizedArea") {
            return (
              <div key={field.name}>
                <span className={labelClass}>{field.label}</span>
                <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
                  {(["zh", "en"] as const).map((locale) => (
                    <label key={locale} className="space-y-1">
                      <span className="font-mono text-meta text-fg-tertiary">
                        {locale}
                      </span>
                      {field.kind === "localizedArea" ? (
                        <textarea
                          name={`${field.name}.${locale}`}
                          defaultValue={value(`${field.name}.${locale}`)}
                          rows={field.rows ?? 3}
                          className={inputClass}
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

          if (field.kind === "lines") {
            return (
              <div key={field.name}>
                <span className={labelClass}>{field.label}</span>
                {field.hint && (
                  <p className="mt-1 text-caption text-fg-tertiary">{field.hint}</p>
                )}
                <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
                  {(["zh", "en"] as const).map((locale) => (
                    <label key={locale} className="space-y-1">
                      <span className="font-mono text-meta text-fg-tertiary">
                        {locale}
                      </span>
                      <textarea
                        name={`${field.name}.${locale}`}
                        defaultValue={
                          (record[field.name] as { [k: string]: string[] })?.[
                            locale
                          ]?.join("\n") ?? ""
                        }
                        rows={4}
                        className={`${inputClass} font-mono text-caption`}
                      />
                    </label>
                  ))}
                </div>
              </div>
            );
          }

          // A new row's key has to be typed; an existing row's must not change.
          const readOnly = !isNew && field.kind === "text" && field.readOnly;

          return (
            <label key={field.name} className="block space-y-1.5">
              <span className={labelClass}>{field.label}</span>
              {field.kind === "text" && field.hint && (
                <span className="block text-caption text-fg-tertiary">
                  {field.hint}
                </span>
              )}
              {field.kind === "select" ? (
                <select
                  name={field.name}
                  defaultValue={value(field.name)}
                  className={inputClass}
                >
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={field.name}
                  type={field.kind === "number" ? "number" : "text"}
                  defaultValue={value(field.name)}
                  placeholder={"placeholder" in field ? field.placeholder : undefined}
                  readOnly={readOnly || undefined}
                  required={isNew && field.kind === "text" && field.readOnly}
                  className={`${inputClass} ${readOnly ? "text-fg-tertiary" : ""}`}
                />
              )}
            </label>
          );
        })}

        <SaveControls state={state} pending={pending} />
      </form>

      {deleteAction && !isNew && key && (
        <form
          action={deleteAction}
          onSubmit={(event) => {
            if (!window.confirm(`确定删除「${key}」？删了就没有了。`)) {
              event.preventDefault();
            }
          }}
          className="mt-8 border-t border-line pt-6"
        >
          <input type="hidden" name="key" value={key} />
          <button
            type="submit"
            className="text-caption text-fg-tertiary hover:text-accent"
          >
            删除这条（{key}）
          </button>
        </form>
      )}
    </>
  );
}
