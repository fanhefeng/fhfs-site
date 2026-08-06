"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

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
        className="w-full rounded-card border border-line bg-surface px-4 py-3 text-body text-fg outline-none focus-visible:border-accent"
      />

      {state.error && (
        <p className="mt-3 text-caption text-accent" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 min-h-11 w-full rounded-card bg-fg px-4 text-caption text-bg transition-opacity disabled:opacity-50"
      >
        {pending ? "正在进入…" : "进入"}
      </button>
    </form>
  );
}
