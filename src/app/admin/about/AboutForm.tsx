"use client";

import { useActionState } from "react";
import { saveAbout, type ActionState } from "../actions";
import { buttonClass, inputClass, labelClass } from "../AdminChrome";

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
  );
}
