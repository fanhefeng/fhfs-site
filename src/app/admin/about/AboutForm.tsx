"use client";

import { saveAbout } from "../actions/about";
import { inputClass, monoClass, textareaClass, labelClass } from "../styles";
import { SaveControls } from "../SaveControls";
import { useSaveAction } from "../ui/useSaveAction";

export function AboutForm({
  about,
}: {
  about: { locale: "zh" | "en"; title: string; bodyMd: string };
}) {
  const { state, pending, formProps } = useSaveAction(saveAbout);

  return (
    <form {...formProps} className="space-y-4">
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
          className={`${textareaClass} ${monoClass}`}
        />
      </label>

      <SaveControls state={state} pending={pending} />
    </form>
  );
}
