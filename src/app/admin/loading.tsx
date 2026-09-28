"use client";

import { usePathname } from "next/navigation";
import { AdminSidebar } from "./AdminSidebar";

/**
 * What a click in the admin shows while the next page reads its rows.
 *
 * Every admin page is dynamic — it reads the database on each request — and
 * a dynamic route with no loading state is neither prefetched nor answered
 * until the server has finished: a click did nothing visible for a second or
 * more, and read as a click that had not landed. With this file Next can
 * prefetch the shell and swap it in at once.
 *
 * The sidebar is drawn without its counts (they come with the page), and the
 * main column is a quiet placeholder in the page's own proportions. The
 * sign-in page has neither — a list of sections flashed at someone not yet
 * signed in would be the wrong first sight — so it gets nothing.
 */
export default function AdminLoading() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin/login")) return null;

  return (
    <div className="lg:flex">
      <AdminSidebar />
      <main className="min-w-0 flex-1" aria-busy="true">
        <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 lg:py-12">
          <div className="border-b border-line pb-6">
            <div className="h-3 w-24 rounded-full bg-surface" />
            <div className="mt-4 h-7 w-40 rounded-chip bg-surface" />
            <div className="mt-4 h-3 w-72 max-w-full rounded-full bg-surface" />
          </div>
          <p className="sr-only" role="status">
            正在读取……
          </p>
          <div className="mt-8 space-y-3">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="h-11 rounded-chip bg-surface/70" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
