"use client";

import { deletePost, savePost } from "../actions/posts";
import { inputClass, labelClass, monoClass, textareaClass } from "../styles";
import { SaveControls } from "../SaveControls";
import { useFieldErrors } from "../ui/fieldErrors";
import { useSaveAction } from "../ui/useSaveAction";
import { KEY_MESSAGE, KEY_PATTERN } from "@/lib/forms";
import { DeleteRow } from "../DeleteRow";
import { Select } from "../ui/Select";
import { Toggle } from "../ui/Segmented";

type PostDraft = {
  slug: string;
  locale: "zh" | "en";
  title: string;
  date: string;
  summary: string;
  tags: string[];
  draft: boolean;
  bodyMd: string;
};

/**
 * The article editor: a plain textarea for markdown, and the rest as fields.
 *
 * No live preview — the rendering happens on save, in the same pipeline the
 * site uses, so a preview here would be a second renderer to keep honest. The
 * article page is one click away and shows the real thing.
 */
export function PostForm({ post, isNew }: { post: PostDraft; isNew: boolean }) {
  const { state, pending, formProps } = useSaveAction(savePost);
  const check = useFieldErrors();

  return (
    <>
      <form {...formProps} className="space-y-5" {...check.formProps}>
        {/* Tells savePost to redirect to the edit page: this page's props are a
            blank draft, and a saved form resets to its props (useSaveAction) —
            without the redirect a successful save wipes the editor. */}
        {isNew && <input type="hidden" name="isNew" value="1" />}
        <div className="grid gap-5 sm:grid-cols-[1fr_9rem_10rem]">
          <label className="space-y-1.5">
            <span className={labelClass}>slug</span>
            <input
              name="slug"
              defaultValue={post.slug}
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
            <span id="post-locale" className={labelClass}>
              语言
            </span>
            <Select
              name="locale"
              labelledBy="post-locale"
              defaultValue={post.locale}
              disabled={!isNew}
              options={[
                { value: "zh", label: "zh · 中文" },
                { value: "en", label: "en · English" },
              ]}
            />
            {/* A disabled control submits nothing — keep the value in the post. */}
            {!isNew && <input type="hidden" name="locale" value={post.locale} />}
          </div>

          <label className="space-y-1.5">
            <span className={labelClass}>日期</span>
            <input
              name="date"
              defaultValue={post.date}
              placeholder="2026-08-05"
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
            defaultValue={post.title}
            required
            className={inputClass}
            {...check.field("title")}
          />
          {check.message("title")}
        </label>

        <label className="block space-y-1.5">
          <span className={labelClass}>摘要</span>
          <input name="summary" defaultValue={post.summary} className={inputClass} />
        </label>

        <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
          <label className="space-y-1.5">
            <span className={labelClass}>标签（逗号分隔）</span>
            <input name="tags" defaultValue={post.tags.join(", ")} className={inputClass} />
          </label>

          <div className="flex items-end pb-2.5">
            <Toggle
              name="draft"
              defaultChecked={post.draft}
              label="草稿"
              hint="开着就不公开，站上 404"
              onLabel="草稿"
              offLabel="已公开"
            />
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className={labelClass}>正文（Markdown）</span>
          <textarea
            name="bodyMd"
            defaultValue={post.bodyMd}
            rows={24}
            spellCheck={false}
            className={`${textareaClass} ${monoClass}`}
          />
        </label>

        <SaveControls state={state} pending={pending} sticky />
      </form>

      {!isNew && (
        <DeleteRow
          action={deletePost}
          fields={{ slug: post.slug, locale: post.locale }}
          what={`${post.slug}.${post.locale}`}
          label="删除这篇"
        />
      )}
    </>
  );
}
