"use client";

import { useLayoutEffect } from "react";

const KEY = "fhfs-theme";

/** The stored choice, else the OS preference, else paper. */
function resolve(): "light" | "dark" {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

/**
 * Keeps `data-theme` on <html> true after React re-renders the root layout.
 *
 * The attribute is owned by the pre-paint script in the layout and by
 * LightSwitch — deliberately not rendered as JSX, since a rendered value
 * would overwrite the reader's choice on every re-render. But React drops
 * attributes it finds on an element it re-renders and does not own, and a
 * locale switch re-renders <html> on the client: dark-mode readers used to
 * get dropped back onto paper mid-session, with no way back short of a
 * reload.
 *
 * Runs on every render (no dependency array) and writes only on a mismatch,
 * in a layout effect so the correction lands before paint.
 */
export function ThemeKeeper() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const theme = resolve();
    if (root.dataset.theme !== theme) root.dataset.theme = theme;
  });

  return null;
}
