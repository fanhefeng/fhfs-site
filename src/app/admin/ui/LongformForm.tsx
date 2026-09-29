"use client";

import { useId, useRef, useState, type ReactNode, type RefObject } from "react";
import type { ActionState } from "../actions/shared";
import { inputClass, labelClass, monoClass, textareaClass } from "../styles";
import { SaveControls } from "../SaveControls";
import { DeleteRow } from "../DeleteRow";
import { useFieldErrors } from "./fieldErrors";
import { useSaveAction } from "./useSaveAction";
import { Select } from "./Select";
import { Toggle } from "./Segmented";
import { KEY_MESSAGE, KEY_PATTERN } from "@/lib/forms";
import { MediaUploader } from "./MediaUploader";

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
 * The preview is not a second renderer: "预览" posts the textarea to
 * `/admin/preview/markdown`, which runs the save's own pipeline and hands back
 * the HTML a save would store, drawn in the article's own `.prose-editorial`.
 * "在站上看" goes further — the real page, in Draft Mode, draft or not — and
 * shows the last save, which is why it is only there once there is one.
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
  below,
  draftHint,
  bodyLabel,
  datePlaceholder,
  previewKind,
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
  /** Under the draft row, full width — the episode's audio uploader. */
  below?: ReactNode;
  draftHint: string;
  bodyLabel: string;
  datePlaceholder: string;
  /** Which room "在站上看" opens the piece in. */
  previewKind: "post" | "secret";
}) {
  const { state, pending, formProps } = useSaveAction(action);
  const body = useRef<HTMLTextAreaElement>(null);
  const bodyLabelId = useId();
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
        {below}

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span id={bodyLabelId} className={labelClass}>
              {bodyLabel}
            </span>
            {!isNew && (
              <a
                href={`/admin/preview?${new URLSearchParams({
                  kind: previewKind,
                  slug: doc.slug,
                  locale: doc.locale,
                })}`}
                target="_blank"
                rel="noopener"
                className="font-mono text-meta text-fg-secondary underline-offset-4 hover:text-accent hover:underline"
              >
                在站上看上次保存的版本 ↗
              </a>
            )}
          </div>
          <MarkdownPreview source={body}>
            <textarea
              ref={body}
              name="bodyMd"
              aria-labelledby={bodyLabelId}
              defaultValue={doc.bodyMd}
              rows={24}
              spellCheck={false}
              className={`${textareaClass} ${monoClass}`}
            />
            <MediaUploader
              folder={previewKind === "post" ? "posts" : "secrets"}
              kinds={["image"]}
              label="插入图片"
              onUploaded={(file) => {
                const el = body.current;
                if (!el) return;
                // At the caret, as a paragraph of its own.
                const at = el.selectionStart ?? el.value.length;
                const image = `\n\n![](${file.src})\n\n`;
                el.value = `${el.value.slice(0, at).replace(/\s+$/, "")}${image}${el.value.slice(at).replace(/^\s+/, "")}`;
              }}
            />
          </MarkdownPreview>
        </div>

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

/**
 * 写 / 预览 over the body. The textarea stays mounted while the preview is up,
 * only hidden: the form is uncontrolled, and unmounting the field would drop
 * what was typed — and leave it out of the next save.
 */
function MarkdownPreview({
  source,
  children,
}: {
  source: RefObject<HTMLTextAreaElement | null>;
  children: ReactNode;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const showing = html !== null;

  const preview = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/admin/preview/markdown", {
        method: "POST",
        body: source.current?.value ?? "",
      });
      if (response.status === 401) setError("登录过期了，先在新标签页重新登录，这里的内容不会丢。");
      else if (!response.ok) setError(`预览失败（${response.status}）。`);
      else setHtml(await response.text());
    } catch {
      setError("预览失败：连不上服务器。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div role="group" aria-label="正文视图" className="flex gap-2">
        <ViewButton pressed={!showing} onClick={() => setHtml(null)}>
          写
        </ViewButton>
        <ViewButton pressed={showing} onClick={() => void preview()} disabled={busy}>
          {busy ? "渲染中…" : showing ? "刷新预览" : "预览"}
        </ViewButton>
      </div>
      {error && <p className="text-caption text-accent">{error}</p>}
      <div hidden={showing}>{children}</div>
      {showing && (
        <div className="rounded-chip border border-line bg-surface px-6 py-8">
          <div className="prose-editorial" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
    </>
  );
}

function ViewButton({
  pressed,
  onClick,
  disabled,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-1 font-mono text-meta transition-colors ${
        pressed
          ? "border-fg bg-fg text-bg"
          : "border-line text-fg-secondary hover:border-fg-tertiary"
      }`}
    >
      {children}
    </button>
  );
}
