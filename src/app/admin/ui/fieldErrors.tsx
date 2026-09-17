"use client";

import { useCallback, useId, useState, type FormEvent } from "react";

type Checked = HTMLInputElement | HTMLTextAreaElement;

const isChecked = (target: EventTarget): target is Checked =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

/** The browser's own sentence is the fallback: it is at least correct, and in
 *  the reader's language, for a constraint nobody wrote a line for. */
function messageFor(field: Checked): string {
  const { validity } = field;
  if (validity.valueMissing) return "这一项要填。";
  if (validity.patternMismatch) return field.dataset.mismatch ?? "格式不对。";
  if (validity.badInput) return "这里要填数字。";
  return field.validationMessage;
}

/**
 * The browser's constraint validation, without the browser's bubble.
 *
 * `required` and `pattern` stay on the inputs — they are what stops a submit
 * before it costs a round trip — but the `invalid` event is cancelled, which
 * is what suppresses the native tooltip, and the sentence goes under the field
 * in the workbench's own type instead. React's `onInvalid` bubbles (the DOM
 * event does not), so one handler on the form hears every field in it.
 *
 * Spread `formProps` on the `<form>`, `field(name)` on each constrained input,
 * and put `message(name)` where the line should appear. A field's line clears
 * itself as soon as what is typed satisfies the constraint.
 */
export function useFieldErrors() {
  const [errors, setErrors] = useState<{ [name: string]: string }>({});
  const id = useId();

  const onInvalid = useCallback((event: FormEvent<HTMLFormElement>) => {
    const field = event.target;
    if (!isChecked(field)) return;
    event.preventDefault();
    const text = messageFor(field);
    setErrors((prev) => (prev[field.name] === text ? prev : { ...prev, [field.name]: text }));
    // Every invalid field fires in document order; cancelling the event also
    // cancels the browser's focus, so the first one takes it by hand.
    if (field.form?.querySelector(":invalid") === field) field.focus();
  }, []);

  const onInput = useCallback((event: FormEvent<HTMLFormElement>) => {
    const field = event.target;
    if (!isChecked(field)) return;
    setErrors((prev) => {
      if (!(field.name in prev)) return prev;
      const next = { ...prev };
      if (field.validity.valid) delete next[field.name];
      else next[field.name] = messageFor(field);
      return next;
    });
  }, []);

  return {
    formProps: { onInvalid, onInput },
    field: (name: string) =>
      errors[name] ? ({ "aria-invalid": true, "aria-describedby": `${id}-${name}` } as const) : {},
    message: (name: string) =>
      errors[name] ? (
        // A span: these sit inside <label>, where a <p> is not allowed.
        <span
          id={`${id}-${name}`}
          className="flex items-center gap-2 text-caption text-accent animate-[admin-pop_160ms_ease-out]"
        >
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent" />
          {errors[name]}
        </span>
      ) : null,
  };
}
