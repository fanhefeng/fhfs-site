"use client";

import { useActionState } from "react";
import { deleteSecret, saveSecret, type ActionState } from "../actions";
import { inputClass, labelClass } from "../styles";
import { SaveControls } from "../SaveControls";

export type SecretDraft = {
  slug: string;
  locale: "zh" | "en";
  kind: "essay" | "podcast";
  title: string;
  date: string;
  summary: string;
  audio: string;
  duration: string;
  draft: boolean;
  bodyMd: string;
};

/**
 * The editor for 《不能说的秘密》: the article editor with two more fields —
 * what kind of piece this is, and for an episode, where the audio is and
 * how long it runs. The notes under an episode are markdown like the rest.
 */
export function SecretForm({ secret, isNew }: { secret: SecretDraft; isNew: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveSecret, {});

  return (
    <>
      <form action={formAction} className="space-y-5">
        {isNew && <input type="hidden" name="isNew" value="1" />}
        <div className="grid gap-5 sm:grid-cols-[1fr_6rem_8rem_10rem]">
          <label className="space-y-1.5">
            <span className={labelClass}>slug</span>
            <input
              name="slug"
              defaultValue={secret.slug}
              readOnly={!isNew}
              required
              className={`${inputClass} ${isNew ? "" : "text-fg-tertiary"}`}
            />
          </label>

          <label className="space-y-1.5">
            <span className={labelClass}>语言</span>
            <select name="locale" defaultValue={secret.locale} disabled={!isNew} className={inputClass}>
              <option value="zh">zh</option>
              <option value="en">en</option>
            </select>
            {!isNew && <input type="hidden" name="locale" value={secret.locale} />}
          </label>

          <label className="space-y-1.5">
            <span className={labelClass}>类型</span>
            <select name="kind" defaultValue={secret.kind} className={inputClass}>
              <option value="essay">随笔</option>
              <option value="podcast">播客</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className={labelClass}>日期</span>
            <input
              name="date"
              defaultValue={secret.date}
              placeholder="2026-09-07"
              required
              className={inputClass}
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className={labelClass}>标题</span>
          <input name="title" defaultValue={secret.title} required className={inputClass} />
        </label>

        <label className="block space-y-1.5">
          <span className={labelClass}>摘要</span>
          <input name="summary" defaultValue={secret.summary} className={inputClass} />
        </label>

        <div className="grid gap-5 sm:grid-cols-[1fr_8rem_auto]">
          <label className="space-y-1.5">
            <span className={labelClass}>音频地址（播客必填；完整 URL 或站内路径）</span>
            <input
              name="audio"
              defaultValue={secret.audio}
              placeholder="https://…/episode-1.mp3"
              className={inputClass}
            />
          </label>

          <label className="space-y-1.5">
            <span className={labelClass}>时长（分钟）</span>
            <input name="duration" type="number" defaultValue={secret.duration} className={inputClass} />
          </label>

          <label className="flex items-end gap-2 pb-2.5">
            <input type="checkbox" name="draft" defaultChecked={secret.draft} className="size-4" />
            <span className="text-caption">草稿（不公开）</span>
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className={labelClass}>正文 / 节目笔记（Markdown）</span>
          <textarea
            name="bodyMd"
            defaultValue={secret.bodyMd}
            rows={24}
            spellCheck={false}
            className={`${inputClass} font-mono text-caption leading-relaxed`}
          />
        </label>

        <SaveControls state={state} pending={pending} />
      </form>

      {!isNew && (
        <form
          action={deleteSecret}
          onSubmit={(event) => {
            if (!window.confirm(`确定删除「${secret.slug}.${secret.locale}」？删了就没有了。`)) {
              event.preventDefault();
            }
          }}
          className="mt-10 border-t border-line pt-6"
        >
          <input type="hidden" name="slug" value={secret.slug} />
          <input type="hidden" name="locale" value={secret.locale} />
          <button type="submit" className="text-caption text-fg-tertiary hover:text-accent">
            删除这篇（{secret.slug}.{secret.locale}）
          </button>
        </form>
      )}
    </>
  );
}
