"use client";

import { useLayoutEffect } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";

/** The stored choice, else — only when storage is unreadable — what <html>
 *  already carries, else the OS preference, else paper. */
function resolve(): "light" | "dark" {
  // An empty read and a failed read mean opposite things, so they must not
  // share a branch. Blocked storage throws rather than returning null (Safari
  // private mode, third-party iframes, "block all cookies").
  let blocked = false;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    blocked = true;
  }

  // Storage threw, so <html> is the only surviving record of the reader's
  // choice: LightSwitch and RadialFab both write the attribute first and
  // swallow the failing setItem. Falling through to the OS preference here
  // would silently undo a toggle on the very next client navigation — and
  // since this effect runs on every render, the reader could not even see
  // what reverted it.
  //
  // Deliberately NOT consulted when the read merely came back empty: that
  // means the reader has never chosen, and they should keep following the OS.
  // Reading the attribute there would pin the theme to whatever the pre-paint
  // script wrote on first load and stop the site responding to an appearance
  // change made mid-session.
  if (blocked) {
    const live = document.documentElement.dataset.theme;
    if (live === "light" || live === "dark") return live;
  }

  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

/**
 * Keeps `data-theme` and `data-js` on <html> true after React re-renders the
 * root layout.
 *
 * The attribute is owned by the pre-paint script in the layout and by the
 * toggles (LightSwitch, RadialFab) — deliberately not rendered as JSX, since
 * a rendered value would overwrite the reader's choice on every re-render.
 * But React drops attributes it finds on an element it re-renders and does
 * not own, and a locale switch re-renders <html> on the client: dark-mode
 * readers used to get dropped back onto paper mid-session, with no way back
 * short of a reload.
 *
 * Runs on every render (no dependency array) and writes only on a mismatch,
 * in a layout effect so the correction lands before paint.
 */
export function ThemeKeeper() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const theme = resolve();
    if (root.dataset.theme !== theme) root.dataset.theme = theme;

    // The same wipe takes `data-js` with it — the "scripting is on" flag the
    // pre-paint script stamps. Nothing else writes that one back, so after a
    // locale switch every page whose CSS keys a pre-intro state off `[data-js]`
    // rendered finished instead of animating in.
    if (!root.hasAttribute("data-js")) root.dataset.js = "";
  });

  return null;
}
