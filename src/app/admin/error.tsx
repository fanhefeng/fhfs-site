"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonClass } from "./AdminChrome";

/**
 * The admin's error boundary.
 *
 * The save actions never throw for an expired session — they hand the form a
 * message instead, so nothing typed is lost (see actions.ts). What still
 * reaches here: a delete pressed after the session ran out, a database that
 * would not answer, or a bug. The page says so in the editor's own language,
 * and offers the two ways out that actually help — try again, or sign in
 * again in place.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
        fhf · admin
      </p>
      <h1 className="mt-6 text-title">这一步没成功</h1>
      <p className="mt-4 max-w-[60ch] text-body text-fg-secondary">
        可能是登录已经过期（会话八小时有效），也可能是数据库没有应答。
        先「再试一次」；还不行就重新登录再回来——正在编辑的表单如果还开着，内容仍在那一页里。
      </p>
      {error.digest && (
        <p className="mt-4 font-mono text-meta text-fg-tertiary">{error.digest}</p>
      )}
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button type="button" onClick={reset} className={buttonClass}>
          再试一次
        </button>
        <Link
          href="/admin/login"
          className="min-h-11 rounded-card border border-line px-4 py-2.5 text-caption hover:border-accent hover:text-accent"
        >
          重新登录
        </Link>
        <Link href="/admin" className="text-caption text-fg-tertiary hover:text-accent">
          回到内容列表
        </Link>
      </div>
    </main>
  );
}
