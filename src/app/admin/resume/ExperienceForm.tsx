"use client";

import { useActionState } from "react";
import type { ResumeProject } from "@/db/schema";
import { formatProjects } from "@/lib/resume";
import {
  deleteResumeExperience,
  saveResumeExperience,
  type ActionState,
} from "../actions";
import { inputClass, labelClass } from "../AdminChrome";
import { SaveControls } from "../SaveControls";

export type ExperienceDraft = {
  key: string;
  company: { zh: string; en: string };
  role: { zh: string; en: string };
  period: { zh: string; en: string };
  url: string | null;
  summary: { zh: string; en: string } | null;
  bullets: { zh: string[]; en: string[] };
  projects: { zh: ResumeProject[]; en: ResumeProject[] };
  sort: number;
};

const LINE_FIELDS = {
  company: "公司 / 组织",
  role: "职位",
  period: "时间段（原样显示，如 2021.06 – 至今）",
  summary: "一句话说明（可空，显示在职位下面）",
} as const;

export function ExperienceForm({
  experience,
  isNew,
}: {
  experience: ExperienceDraft;
  isNew: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveResumeExperience,
    {}
  );

  return (
    <>
      <form action={formAction} className="space-y-5">
        {/* Tells saveResumeExperience to refuse a key that already exists
            rather than overwrite the job that has it. */}
        {isNew && <input type="hidden" name="isNew" value="1" />}
        <div className="grid gap-5 sm:grid-cols-[1fr_7rem]">
          <label className="space-y-1.5">
            <span className={labelClass}>key</span>
            <input
              name="key"
              defaultValue={experience.key}
              readOnly={!isNew}
              required
              className={`${inputClass} ${isNew ? "" : "text-fg-tertiary"}`}
            />
          </label>
          <label className="space-y-1.5">
            <span className={labelClass}>排序</span>
            <input
              name="sort"
              type="number"
              defaultValue={experience.sort}
              className={inputClass}
            />
          </label>
        </div>

        {(Object.keys(LINE_FIELDS) as (keyof typeof LINE_FIELDS)[]).map(
          (field) => (
            <div key={field}>
              <span className={labelClass}>{LINE_FIELDS[field]}</span>
              <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
                {(["zh", "en"] as const).map((locale) => (
                  <label key={locale} className="space-y-1">
                    <span className="font-mono text-meta text-fg-tertiary">
                      {locale}
                    </span>
                    <input
                      name={`${field}.${locale}`}
                      defaultValue={experience[field]?.[locale] ?? ""}
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>
            </div>
          )
        )}

        <label className="block space-y-1.5">
          <span className={labelClass}>链接（可空）</span>
          <input
            name="url"
            defaultValue={experience.url ?? ""}
            className={inputClass}
          />
        </label>

        <div>
          <span className={labelClass}>要点</span>
          <p className="mt-1 text-caption text-fg-tertiary">
            这份工作本身的要点，一行一条，显示在项目之前。留空则整段不显示。
            **粗体** 和 `代码` 会按样式渲染。
          </p>
          <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
            {(["zh", "en"] as const).map((locale) => (
              <label key={locale} className="space-y-1">
                <span className="font-mono text-meta text-fg-tertiary">
                  {locale}
                </span>
                <textarea
                  name={`bullets.${locale}`}
                  defaultValue={experience.bullets[locale].join("\n")}
                  rows={3}
                  className={`${inputClass} font-mono text-caption`}
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <span className={labelClass}>项目</span>
          <p className="mt-1 text-caption text-fg-tertiary">
            以「# 项目名 | 时间段」起一个项目（时间段可省），下面一行一条要点，
            项目之间空一行。要点同样支持 **粗体** 和 `代码`。
          </p>
          <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
            {(["zh", "en"] as const).map((locale) => (
              <label key={locale} className="space-y-1">
                <span className="font-mono text-meta text-fg-tertiary">
                  {locale}
                </span>
                <textarea
                  name={`projects.${locale}`}
                  defaultValue={formatProjects(experience.projects[locale])}
                  rows={12}
                  className={`${inputClass} font-mono text-caption`}
                />
              </label>
            ))}
          </div>
        </div>

        <SaveControls state={state} pending={pending} />
      </form>

      {!isNew && (
        <form
          action={deleteResumeExperience}
          onSubmit={(event) => {
            if (
              !window.confirm(`确定删除「${experience.key}」？删了就没有了。`)
            ) {
              event.preventDefault();
            }
          }}
          className="mt-8 border-t border-line pt-6"
        >
          <input type="hidden" name="key" value={experience.key} />
          <button
            type="submit"
            className="text-caption text-fg-tertiary hover:text-accent"
          >
            删除这条（{experience.key}）
          </button>
        </form>
      )}
    </>
  );
}
