"use client";

import { useActionState } from "react";
import { deleteSecret, saveSecret } from "../actions/secrets";
import type { ActionState } from "../actions/shared";
import { inputClass, labelClass, monoClass, textareaClass } from "../styles";
import { DeleteRow } from "../DeleteRow";
import { Select } from "../ui/Select";
import { Toggle } from "../ui/Segmented";
import { SaveControls } from "../SaveControls";
import { useFieldErrors } from "../ui/fieldErrors";
import { KEY_MESSAGE, KEY_PATTERN } from "@/lib/forms";

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
  const check = useFieldErrors();

  return (
    <>
      <form action={formAction} className="space-y-5" {...check.formProps}>
        {isNew && <input type="hidden" name="isNew" value="1" />}
        <div className="grid gap-5 sm:grid-cols-[1fr_9rem_9rem_10rem]">
          <label className="space-y-1.5">
            <span className={labelClass}>slug</span>
            <input
              name="slug"
              defaultValue={secret.slug}
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
            <span id="secret-locale" className={labelClass}>
              语言
            </span>
            <Select
              name="locale"
              labelledBy="secret-locale"
              defaultValue={secret.locale}
              disabled={!isNew}
              options={[
                { value: "zh", label: "zh · 中文" },
                { value: "en", label: "en · English" },
              ]}
            />
            {!isNew && <input type="hidden" name="locale" value={secret.locale} />}
          </div>

          <div className="space-y-1.5">
            <span id="secret-kind" className={labelClass}>
              类型
            </span>
            <Select
              name="kind"
              labelledBy="secret-kind"
              defaultValue={secret.kind}
              options={[
                { value: "essay", label: "随笔", hint: "只有文字，不填音频" },
                { value: "podcast", label: "播客", hint: "要填音频地址和时长，正文当节目笔记" },
              ]}
            />
          </div>

          <label className="space-y-1.5">
            <span className={labelClass}>日期</span>
            <input
              name="date"
              defaultValue={secret.date}
              placeholder="2026-09-07"
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
            defaultValue={secret.title}
            required
            className={inputClass}
            {...check.field("title")}
          />
          {check.message("title")}
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
            <input
              name="duration"
              type="number"
              defaultValue={secret.duration}
              className={inputClass}
            />
          </label>

          <div className="flex items-end pb-2.5">
            <Toggle
              name="draft"
              defaultChecked={secret.draft}
              label="草稿"
              hint="开着就不公开"
              onLabel="草稿"
              offLabel="已公开"
            />
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className={labelClass}>正文 / 节目笔记（Markdown）</span>
          <textarea
            name="bodyMd"
            defaultValue={secret.bodyMd}
            rows={24}
            spellCheck={false}
            className={`${textareaClass} ${monoClass}`}
          />
        </label>

        <SaveControls state={state} pending={pending} sticky />
      </form>

      {!isNew && (
        <DeleteRow
          action={deleteSecret}
          fields={{ slug: secret.slug, locale: secret.locale }}
          what={`${secret.slug}.${secret.locale}`}
          label="删除这篇"
        />
      )}
    </>
  );
}
