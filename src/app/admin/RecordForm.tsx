"use client";

import { useActionState } from "react";
import type { ActionState } from "./actions";
import { inputClass, labelClass } from "./AdminChrome";
import { SaveControls } from "./SaveControls";

export type Field =
  | { name: string; label: string; kind: "text"; placeholder?: string; readOnly?: boolean }
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
 */
export function RecordForm({
  action,
  fields,
  record,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  fields: Field[];
  record: RecordData;
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

  return (
    <form action={formAction} className="space-y-5">
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

        return (
          <label key={field.name} className="block space-y-1.5">
            <span className={labelClass}>{field.label}</span>
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
                readOnly={"readOnly" in field ? field.readOnly : undefined}
                className={inputClass}
              />
            )}
          </label>
        );
      })}

      <SaveControls state={state} pending={pending} />
    </form>
  );
}
