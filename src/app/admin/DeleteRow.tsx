"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { useFormStatus } from "react-dom";
import { dangerButtonClass, ghostButtonClass, hintClass } from "./styles";

/**
 * The delete control every editable row ends with.
 *
 * It arms rather than confirming: the first press swaps the button for the
 * sentence and the real one. `window.confirm` did the same job, but it is a
 * grey OS box dropped on a themed page, it can't say *what* is about to go, and
 * on a fast double-click the second click lands on the dialog. This version is
 * two deliberate presses in the page's own material.
 *
 * `fields` are the hidden inputs the delete action keys on — `key` for most
 * tables, `slug` + `locale` for the ones that hold one row per language.
 */
export function DeleteRow({
  action,
  fields,
  what,
  label = "删除这条",
}: {
  action: (form: FormData) => Promise<void>;
  fields: { [name: string]: string };
  /** What is about to be deleted, in the words the editor sees elsewhere. */
  what: string;
  label?: string;
}) {
  const [armed, setArmed] = useState(false);
  const backOutRef = useRef<HTMLButtonElement>(null);
  const armRef = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);

  // Arming replaces the very button that had focus, and disarming replaces the
  // one that took it — either way focus would fall to <body>. It goes to the
  // safe choice on the way in, and back to where it started on the way out.
  useEffect(() => {
    if (!moved.current) return;
    (armed ? backOutRef : armRef).current?.focus();
  }, [armed]);

  const arm = (next: boolean) => {
    moved.current = true;
    setArmed(next);
  };

  return (
    <form action={action} className="mt-8 border-t border-line pt-5">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {armed ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className={hintClass}>
            删掉「<span className="font-mono">{what}</span>」，没有回收站。
          </p>
          <Confirm />
          <BackOut ref={backOutRef} onBackOut={() => arm(false)} />
        </div>
      ) : (
        <button
          ref={armRef}
          type="button"
          onClick={() => arm(true)}
          className="text-caption text-fg-tertiary transition-colors hover:text-accent"
        >
          {label}（{what}）
        </button>
      )}
    </form>
  );
}

/** Its own component because `useFormStatus` reads the form it is *inside*.
 *  A delete is idempotent, so a second press did no harm — but it also said
 *  nothing, and a cold database makes that a long silence. */
function Confirm() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={dangerButtonClass}>
      {pending ? "删除中…" : "确认删除"}
    </button>
  );
}

/** Once the delete is on its way it cannot be called back — so while it is,
 *  "算了" says so by being unavailable, instead of folding the sentence away
 *  and letting the row vanish a moment later anyway. */
function BackOut({ ref, onBackOut }: { ref: Ref<HTMLButtonElement>; onBackOut: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button
      ref={ref}
      type="button"
      disabled={pending}
      onClick={onBackOut}
      className={ghostButtonClass}
    >
      算了
    </button>
  );
}
