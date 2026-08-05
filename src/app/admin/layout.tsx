import type { Metadata } from "next";
import { fontVariables } from "../fonts";
import "../globals.css";

/**
 * The admin's own root layout.
 *
 * This is a second root layout, which works because the site has no
 * `app/layout.tsx` — the only other one lives under `app/[locale]`. Being
 * outside that segment is the point: no locale routing to satisfy, and none of
 * the front-end's furniture (lenis, GSAP, three, the route transition) comes
 * along. Navigating between the site and here triggers a full document load,
 * which is exactly what should happen — the editor gets a clean page and the
 * reader's scroll rig is torn down rather than left running underneath.
 *
 * Being a root layout, it has to render <html> and <body> itself and bring its
 * own stylesheet.
 */
export const metadata: Metadata = {
  title: "Admin",
  // Nothing here should ever be indexed, whatever robots.txt says.
  robots: { index: false, follow: false },
};

/** Reads cookies on every page; never a candidate for caching. */
export const dynamic = "force-dynamic";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-dvh bg-bg text-fg">{children}</body>
    </html>
  );
}
