"use client";

import type { ActionState } from "./actions";
import { buttonClass } from "./AdminChrome";

/**
 * The submit button and the error/saved lines every admin form ends with.
 * `sticky` pins the row to the viewport bottom for the long one-page forms.
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
  const messages = (
    <>
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
    </>
  );
  const button = (
    <button type="submit" disabled={pending} className={buttonClass}>
      {pending ? "保存中…" : label}
    </button>
  );

  if (sticky) {
    return (
      <div className="sticky bottom-0 mt-6 flex items-center gap-4 border-t border-line bg-bg py-4">
        {button}
        {messages}
      </div>
    );
  }
  return (
    <>
      {messages}
      {button}
    </>
  );
}
