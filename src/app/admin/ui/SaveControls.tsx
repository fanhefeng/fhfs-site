"use client";

import { useEffect, useRef, useState } from "react";
import type { ActionState } from "../actions/shared";
import { buttonClass, ghostButtonClass } from "../styles";

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
  cancelable = false,
}: {
  state: ActionState;
  pending: boolean;
  label?: string;
  sticky?: boolean;
  cancelable?: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const controls = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = controls.current;
    const form = bar?.closest("form");
    if (!sticky || !bar || !form) return;

    // Scroll-to-field (including keyboard focus and validation) must clear
    // the whole bar. Its height changes when messages wrap or fonts resize.
    const measure = () => {
      form.style.setProperty(
        "--admin-save-height",
        `${Math.ceil(bar.getBoundingClientRect().height)}px`,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      form.style.removeProperty("--admin-save-height");
    };
  }, [sticky]);

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
      {cancelable && (
        <button
          type="reset"
          disabled={pending}
          className={`${ghostButtonClass} disabled:pointer-events-none disabled:opacity-45`}
        >
          取消本次编辑
        </button>
      )}
      {!pending && state.error && (
        <p
          role="alert"
          className="flex min-w-0 max-w-full items-center gap-2 text-caption text-accent [overflow-wrap:anywhere]"
        >
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent" />
          {state.error}
        </p>
      )}
      {!pending && saved && (
        <p
          role="status"
          className="flex min-w-0 max-w-full items-center gap-2 text-caption text-fg-secondary transition-opacity duration-500"
        >
          <svg viewBox="0 0 12 12" aria-hidden className="size-3 shrink-0 text-accent">
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
      <div
        ref={controls}
        data-sticky-save=""
        className="sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center gap-3 border-t border-line bg-bg px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10"
      >
        {button}
        {messages}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
      {button}
      {messages}
    </div>
  );
}
