"use client";

import { useActionState } from "react";
import { saveAbout, type ActionState } from "../actions";
import { inputClass, labelClass } from "../AdminChrome";
import { SaveControls } from "../SaveControls";

export function AboutForm({
  about,
}: {
  about: { locale: "zh" | "en"; title: string; bodyMd: string };
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveAbout,
    {}
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={about.locale} />

      <label className="block space-y-1.5">
        <span className={labelClass}>标题</span>
        <input name="title" defaultValue={about.title} className={inputClass} />
      </label>

      <label className="block space-y-1.5">
        <span className={labelClass}>正文（Markdown）</span>
        <textarea
          name="bodyMd"
          defaultValue={about.bodyMd}
          rows={14}
          spellCheck={false}
          className={`${inputClass} font-mono text-caption leading-relaxed`}
        />
      </label>

      <SaveControls state={state} pending={pending} />
    </form>
  );
}
