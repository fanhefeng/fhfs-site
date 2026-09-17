"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "./login/actions";
import { SECTION_GROUPS, type SectionCounts } from "./sections";
import { metaClass } from "./styles";

/**
 * The standing table of contents, grouped the way the front of the site is.
 *
 * Thirteen sections in one flat row of links (what the header used to be) told
 * you nothing about where you were; four named groups of three or four tell you
 * both that and what else lives next door. The count beside each one is read in
 * a single statement for the whole sidebar (`./counts`), so this costs one
 * round trip per page, not thirteen.
 *
 * `next/navigation`'s usePathname, not the i18n one: /admin sits outside the
 * locale tree, so there is no locale to strip and the next-intl router would
 * have nothing to do here.
 *
 * Below `lg` it collapses into a bar with a drawer behind it. The drawer closes
 * on every navigation — soft navigation keeps this component mounted, so
 * without that it would stay open over the page you just asked for.
 */
export function AdminSidebar({ counts }: { counts: SectionCounts }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  // The drawer is a layer over the page; the page under it must not scroll,
  // and Escape closes it — it covers the screen the way a dialog does, and a
  // layer you can only leave by finding the backdrop is a trap for anyone not
  // using a mouse.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = SECTION_GROUPS.flatMap((group) => group.sections).find(
    (section) => pathname === section.href || pathname.startsWith(`${section.href}/`),
  );

  const nav = (
    <nav className="space-y-7">
      {SECTION_GROUPS.map((group) => (
        <div key={group.id}>
          <h2 className={`${metaClass} px-3`}>{group.label}</h2>
          <ul className="mt-2 space-y-0.5">
            {group.sections.map((section) => {
              const isCurrent = section.href === current?.href;
              return (
                <li key={section.href}>
                  <Link
                    href={section.href}
                    aria-current={isCurrent ? "page" : undefined}
                    className={`relative flex min-h-10 items-center gap-3 rounded-chip px-3 text-body transition-colors ${
                      isCurrent
                        ? "bg-surface text-fg"
                        : "text-fg-secondary hover:bg-surface/60 hover:text-fg"
                    }`}
                  >
                    {/* The amber tick that marks where you are. */}
                    <span
                      aria-hidden
                      className={`absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-opacity ${
                        isCurrent ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    <span className="flex-1 truncate">{section.label}</span>
                    <span className="font-mono text-meta text-fg-tertiary tabular-nums">
                      {counts[section.href] ?? 0}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <Link
      href="/admin"
      className="font-mono text-meta uppercase tracking-meta text-fg-tertiary transition-colors hover:text-accent"
    >
      fhf · admin
    </Link>
  );

  const signOut = (
    <form action={logout}>
      <button
        type="submit"
        className="font-mono text-meta uppercase tracking-meta text-fg-tertiary transition-colors hover:text-accent"
      >
        退出
      </button>
    </form>
  );

  return (
    <>
      {/* ≥lg: the column that is always there. */}
      <aside className="hidden lg:flex lg:h-dvh lg:sticky lg:top-0 lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-line lg:bg-bg">
        <div className="flex items-center justify-between px-6 py-5">
          {brand}
          {signOut}
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">{nav}</div>
        <p className="border-t border-line px-6 py-4 text-caption text-fg-tertiary">
          保存即生效，不用重新部署。
        </p>
      </aside>

      {/* <lg: a bar, and the same nav behind it. */}
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-bg/92 px-4 py-3 backdrop-blur-sm lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="admin-drawer"
          className="flex size-9 items-center justify-center rounded-chip border border-line text-fg-secondary transition-colors hover:text-fg"
        >
          <span className="sr-only">板块</span>
          <svg viewBox="0 0 16 16" aria-hidden className="size-4">
            <path
              d={open ? "M3.5 3.5l9 9m0-9l-9 9" : "M2.5 4h11M2.5 8h11M2.5 12h11"}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {brand}
        <span className="text-caption text-fg-tertiary">/</span>
        <span className="flex-1 truncate text-caption text-fg-secondary">
          {current?.label ?? "内容"}
        </span>
        {signOut}
      </div>

      {open && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            aria-label="收起板块"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
          />
          <div
            id="admin-drawer"
            className="absolute inset-x-0 top-[57px] max-h-[calc(100dvh-57px)] overflow-y-auto border-b border-line bg-bg px-3 py-6 shadow-lift animate-[admin-pop_160ms_ease-out]"
          >
            {nav}
          </div>
        </div>
      )}
    </>
  );
}
