"use client";

import { useActionState } from "react";
import { deleteWork, saveWork, type ActionState } from "../actions";
import { inputClass, labelClass, textareaClass } from "../styles";
import { DeleteRow } from "../DeleteRow";
import { SaveControls } from "../SaveControls";

export type WorkDraft = {
  key: string;
  title: { zh: string; en: string };
  description: { zh: string; en: string };
  year: number;
  cover: string | null;
  url: string | null;
  tags: string[];
  accent: string | null;
  sort: number;
};

export function WorkForm({
  work,
  isNew,
}: {
  work: WorkDraft;
  isNew: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveWork,
    {}
  );

  return (
    <>
      <form action={formAction} className="space-y-5">
        {/* Tells saveWork to refuse a key that already exists rather than
            overwrite the work that has it. */}
        {isNew && <input type="hidden" name="isNew" value="1" />}
        <div className="grid gap-5 sm:grid-cols-[1fr_7rem_7rem]">
          <label className="space-y-1.5">
            <span className={labelClass}>key</span>
            <input
              name="key"
              defaultValue={work.key}
              readOnly={!isNew}
              required
              className={`${inputClass} ${isNew ? "" : "text-fg-tertiary"}`}
            />
          </label>
          <label className="space-y-1.5">
            <span className={labelClass}>年份</span>
            <input
              name="year"
              type="number"
              defaultValue={work.year}
              className={inputClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className={labelClass}>排序</span>
            <input
              name="sort"
              type="number"
              defaultValue={work.sort}
              className={inputClass}
            />
          </label>
        </div>

        {(["title", "description"] as const).map((field) => (
          <div key={field}>
            <span className={labelClass}>
              {field === "title" ? "标题" : "描述"}
            </span>
            <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
              {(["zh", "en"] as const).map((locale) => (
                <label key={locale} className="space-y-1">
                  <span className="font-mono text-meta text-fg-tertiary">
                    {locale}
                  </span>
                  {field === "description" ? (
                    <textarea
                      name={`${field}.${locale}`}
                      defaultValue={work[field][locale]}
                      rows={3}
                      className={textareaClass}
                    />
                  ) : (
                    <input
                      name={`${field}.${locale}`}
                      defaultValue={work[field][locale]}
                      className={inputClass}
                    />
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className={labelClass}>链接（可空）</span>
            <input name="url" defaultValue={work.url ?? ""} className={inputClass} />
          </label>
          <label className="space-y-1.5">
            {/* 列存在、也会保存，但作品墙目前不在站上（/portfolio 已下线，
                挂上第一件作品时再议页面）——等渲染端接上前先如实标注。 */}
            <span className={labelClass}>封面路径（暂未生效）</span>
            <input
              name="cover"
              defaultValue={work.cover ?? ""}
              className={inputClass}
            />
          </label>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className={labelClass}>标签（逗号分隔）</span>
            <input
              name="tags"
              defaultValue={work.tags.join(", ")}
              className={inputClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className={labelClass}>主色（hex，可空）</span>
            <input
              name="accent"
              defaultValue={work.accent ?? ""}
              placeholder="#4c7a5b"
              className={inputClass}
            />
          </label>
        </div>

        <SaveControls state={state} pending={pending} />
      </form>

      {!isNew && (
        <DeleteRow
          action={deleteWork}
          fields={{ key: work.key }}
          what={work.key}
          label="删除这件"
        />
      )}
    </>
  );
}
