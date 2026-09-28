"use client";

import { useId, type ReactNode } from "react";
import type { ActionState } from "../actions/shared";
import { inputClass, labelClass, monoClass, textareaClass } from "../styles";
import { SaveControls } from "../SaveControls";
import { DeleteRow } from "../DeleteRow";
import { useFieldErrors } from "./fieldErrors";
import { useSaveAction } from "./useSaveAction";
import { Select } from "./Select";
import { Toggle } from "./Segmented";
import { KEY_MESSAGE, KEY_PATTERN } from "@/lib/forms";

/** What a post and a secret both are, as the form edits them. */
export type LongformDraft = {
  slug: string;
  locale: "zh" | "en";
  title: string;
  date: string;
  summary: string;
  draft: boolean;
  bodyMd: string;
};

/**
 * The long-form editor: a plain textarea for markdown, and the rest as fields.
 * Posts and secrets are this form with a few fields of their own — the
 * secret's kind beside the address (`head`), the post's tags or the episode's
 * audio beside the draft switch (`extras`) — and used to be two copies of it.
 *
 * No live preview — the rendering happens on save, in the same pipeline the
 * site uses, so a preview here would be a second renderer to keep honest. The
 * page itself is one click away and shows the real thing.
 */
export function LongformForm({
  action,
  deleteAction,
  doc,
  isNew,
  head,
  headCols,
  extras,
  extrasCols,
  draftHint,
  bodyLabel,
  datePlaceholder,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  deleteAction: (form: FormData) => Promise<void>;
  doc: LongformDraft;
  isNew: boolean;
  /** Fields between the language and the date. */
  head?: ReactNode;
  /** The grid for the address row — a literal class, so Tailwind sees it. */
  headCols: string;
  /** Fields in the row that ends with the draft switch. */
  extras: ReactNode;
  extrasCols: string;
  draftHint: string;
  bodyLabel: string;
  datePlaceholder: string;
}) {
  const { state, pending, formProps } = useSaveAction(action);
  const check = useFieldErrors();
  const localeLabel = useId();

  return (
    <>
      <form {...formProps} className="space-y-5" {...check.formProps}>
        {/* Tells the action to refuse an existing address and, once saved, to
            redirect to the edit page: this page's props are a blank draft, and
            a saved form resets to its props (useSaveAction) — without the
            redirect a successful save would wipe the editor. */}
        {isNew && <input type="hidden" name="isNew" value="1" />}
        <div className={`grid gap-5 ${headCols}`}>
          <label className="space-y-1.5">
            <span className={labelClass}>slug</span>
            <input
              name="slug"
              defaultValue={doc.slug}
              readOnly={!isNew}
              required
              pattern={KEY_PATTERN}
              data-mismatch={KEY_MESSAGE}
              className={`${inputClass} ${isNew ? "" : "text-fg-tertiary"}`}
              {...check.field("slug")}
            />
            {check.message("slug")}
          </label>

          <div className="space-y-1.5">
            <span id={localeLabel} className={labelClass}>
              语言
            </span>
            <Select
              name="locale"
              labelledBy={localeLabel}
              defaultValue={doc.locale}
              disabled={!isNew}
              options={[
                { value: "zh", label: "zh · 中文" },
                { value: "en", label: "en · English" },
              ]}
            />
            {/* A disabled control submits nothing — keep the value in the post. */}
            {!isNew && <input type="hidden" name="locale" value={doc.locale} />}
          </div>

          {head}

          <label className="space-y-1.5">
            <span className={labelClass}>日期</span>
            <input
              name="date"
              defaultValue={doc.date}
              placeholder={datePlaceholder}
              required
              pattern="\d{4}-\d{2}-\d{2}"
              data-mismatch="日期要写成 YYYY-MM-DD。"
              className={inputClass}
              {...check.field("date")}
            />
            {check.message("date")}
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className={labelClass}>标题</span>
          <input
            name="title"
            defaultValue={doc.title}
            required
            className={inputClass}
            {...check.field("title")}
          />
          {check.message("title")}
        </label>

        <label className="block space-y-1.5">
          <span className={labelClass}>摘要</span>
          <input name="summary" defaultValue={doc.summary} className={inputClass} />
        </label>

        <div className={`grid gap-5 ${extrasCols}`}>
          {extras}
          <div className="flex items-end pb-2.5">
            <Toggle
              name="draft"
              defaultChecked={doc.draft}
              label="草稿"
              hint={draftHint}
              onLabel="草稿"
              offLabel="已公开"
            />
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className={labelClass}>{bodyLabel}</span>
          <textarea
            name="bodyMd"
            defaultValue={doc.bodyMd}
            rows={24}
            spellCheck={false}
            className={`${textareaClass} ${monoClass}`}
          />
        </label>

        <SaveControls state={state} pending={pending} sticky />
      </form>

      {!isNew && (
        <DeleteRow
          action={deleteAction}
          fields={{ slug: doc.slug, locale: doc.locale }}
          what={`${doc.slug}.${doc.locale}`}
          label="删除这篇"
        />
      )}
    </>
  );
}
