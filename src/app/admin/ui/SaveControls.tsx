"use client";

import { useEffect, useState } from "react";
import type { ActionState } from "./actions/shared";
import { buttonClass } from "./styles";

/**
 * The submit button and the error/saved lines every admin form ends with.
 *
 * "已保存" fades itself out after a few seconds: it is news, and a line that
 * stays forever stops being read — while an error stays until the next attempt
 * clears it, because it is a thing still to be fixed. `sticky` pins the row to
 * the viewport bottom for the long one-page forms.
 */
export function SaveControls({
  state,
  pending,
  label = "保存",
  sticky = false,
}: {
  state: ActionState;
  pending: boolean;
  label?: string;
  sticky?: boolean;
}) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!state.ok) {
      setSaved(false);
      return;
    }
    setSaved(true);
    const timer = setTimeout(() => setSaved(false), 6000);
    return () => clearTimeout(timer);
  }, [state]);

  const messages = (
    <>
      {state.error && (
        <p role="alert" className="flex items-center gap-2 text-caption text-accent">
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent" />
          {state.error}
        </p>
      )}
      {saved && (
        <p
          role="status"
          className="flex items-center gap-2 text-caption text-fg-secondary transition-opacity duration-500"
        >
          <svg viewBox="0 0 12 12" aria-hidden className="size-3 text-accent">
            <path
              d="M2.5 6.5 5 9l4.5-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          已保存，前台已刷新。
        </p>
      )}
    </>
  );

  const button = (
    <button type="submit" disabled={pending} className={buttonClass}>
      {pending && (
        <span
          aria-hidden
          // Stops under reduce-motion, and closes its gap so it rests as a
          // whole ring; "保存中…" beside it is the part that carries meaning.
          className="size-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent motion-reduce:animate-none motion-reduce:border-t-current"
        />
      )}
      {pending ? "保存中…" : label}
    </button>
  );

  if (sticky) {
    return (
      <div className="sticky bottom-0 z-20 mt-6 flex flex-wrap items-center gap-4 border-t border-line bg-bg/92 py-4 backdrop-blur-sm">
        {button}
        {messages}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-4">
      {button}
      {messages}
    </div>
  );
}
