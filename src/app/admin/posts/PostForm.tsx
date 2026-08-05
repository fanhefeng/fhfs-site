"use client";

import { useActionState } from "react";
import { deletePost, savePost, type ActionState } from "../actions";
import { buttonClass, inputClass, labelClass } from "../AdminChrome";

export type PostDraft = {
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
export function PostForm({
  post,
  isNew,
}: {
  post: PostDraft;
  isNew: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    savePost,
    {}
  );

  return (
    <>
      <form action={formAction} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-[1fr_6rem_10rem]">
          <label className="space-y-1.5">
            <span className={labelClass}>slug</span>
            <input
              name="slug"
              defaultValue={post.slug}
              readOnly={!isNew}
              required
              className={`${inputClass} ${isNew ? "" : "text-fg-tertiary"}`}
            />
          </label>

          <label className="space-y-1.5">
            <span className={labelClass}>语言</span>
            <select
              name="locale"
              defaultValue={post.locale}
              disabled={!isNew}
              className={inputClass}
            >
              <option value="zh">zh</option>
              <option value="en">en</option>
            </select>
            {/* A disabled select submits nothing — keep the value in the post. */}
            {!isNew && <input type="hidden" name="locale" value={post.locale} />}
          </label>

          <label className="space-y-1.5">
            <span className={labelClass}>日期</span>
            <input
              name="date"
              defaultValue={post.date}
              placeholder="2026-08-05"
              required
              className={inputClass}
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className={labelClass}>标题</span>
          <input
            name="title"
            defaultValue={post.title}
            required
            className={inputClass}
          />
        </label>

        <label className="block space-y-1.5">
          <span className={labelClass}>摘要</span>
          <input
            name="summary"
            defaultValue={post.summary}
            className={inputClass}
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
          <label className="space-y-1.5">
            <span className={labelClass}>标签（逗号分隔）</span>
            <input
              name="tags"
              defaultValue={post.tags.join(", ")}
              className={inputClass}
            />
          </label>

          <label className="flex items-end gap-2 pb-2.5">
            <input
              type="checkbox"
              name="draft"
              defaultChecked={post.draft}
              className="size-4"
            />
            <span className="text-caption">草稿（不公开）</span>
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className={labelClass}>正文（Markdown）</span>
          <textarea
            name="bodyMd"
            defaultValue={post.bodyMd}
            rows={24}
            spellCheck={false}
            className={`${inputClass} font-mono text-caption leading-relaxed`}
          />
        </label>

        {state.error && (
          <p className="text-caption text-accent" role="alert">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="text-caption text-fg-secondary" role="status">
            已保存，前台已刷新。
          </p>
        )}

        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "保存中…" : "保存"}
        </button>
      </form>

      {!isNew && (
        <form action={deletePost} className="mt-10 border-t border-line pt-6">
          <input type="hidden" name="slug" value={post.slug} />
          <input type="hidden" name="locale" value={post.locale} />
          <button
            type="submit"
            className="text-caption text-fg-tertiary hover:text-accent"
          >
            删除这篇（{post.slug}.{post.locale}）
          </button>
        </form>
      )}
    </>
  );
}
