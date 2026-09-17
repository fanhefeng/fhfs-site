"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { buttonClass, inputClass } from "../styles";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {}
  );

  return (
    <form action={formAction} className="mt-6">
      <input type="hidden" name="next" value={next} />

      <label htmlFor="password" className="sr-only">
        密码
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoFocus
        autoComplete="current-password"
        placeholder="密码"
        className={inputClass}
      />

      {state.error && (
        <p className="mt-3 flex items-center gap-2 text-caption text-accent" role="alert">
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent" />
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`${buttonClass} mt-4 w-full`}
      >
        {pending && (
          <span
            aria-hidden
            className="size-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent"
          />
        )}
        {pending ? "正在进入…" : "进入"}
      </button>
    </form>
  );
}
