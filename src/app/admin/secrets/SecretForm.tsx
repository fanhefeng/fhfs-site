"use client";

import { useId } from "react";
import { deleteSecret, saveSecret } from "../actions/secrets";
import { inputClass, labelClass } from "../styles";
import { Select } from "../ui/Select";
import { LongformForm, type LongformDraft } from "../ui/LongformForm";

export type SecretDraft = LongformDraft & {
  kind: "essay" | "podcast";
  audio: string;
  duration: string;
};

/**
 * The editor for 《不能说的秘密》: the long-form form with what a post does
 * not have — what kind of piece this is, and for an episode, where the audio
 * is and how long it runs. The notes under an episode are markdown like the
 * rest.
 */
export function SecretForm({ secret, isNew }: { secret: SecretDraft; isNew: boolean }) {
  const kindLabel = useId();
  return (
    <LongformForm
      action={saveSecret}
      deleteAction={deleteSecret}
      doc={secret}
      isNew={isNew}
      previewKind="secret"
      headCols="sm:grid-cols-[1fr_9rem_9rem_10rem]"
      head={
        <div className="space-y-1.5">
          <span id={kindLabel} className={labelClass}>
            类型
          </span>
          <Select
            name="kind"
            labelledBy={kindLabel}
            defaultValue={secret.kind}
            options={[
              { value: "essay", label: "随笔", hint: "只有文字，不填音频" },
              { value: "podcast", label: "播客", hint: "要填音频地址和时长，正文当节目笔记" },
            ]}
          />
        </div>
      }
      extrasCols="sm:grid-cols-[1fr_8rem_auto]"
      extras={
        <>
          <label className="space-y-1.5">
            <span className={labelClass}>音频地址（播客必填；站内路径或媒体站地址）</span>
            <input
              name="audio"
              defaultValue={secret.audio}
              placeholder="/secrets/episode-1.mp3"
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
        </>
      }
      draftHint="开着就不公开"
      bodyLabel="正文 / 节目笔记（Markdown）"
      datePlaceholder="2026-09-07"
    />
  );
}
