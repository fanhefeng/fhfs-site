/**
 * Shared field styling for the admin forms, and nothing else in this file.
 *
 * It lives apart from `AdminChrome` on purpose. Every form here is a client
 * component, and they all wanted these three strings — but `AdminChrome` is a
 * server module that reaches for `@/db/schema` (its `SECTIONS` table list) and
 * for the logout action. Importing three class names from it dragged the whole
 * drizzle schema across the client boundary: a 38 KB chunk carrying every
 * table, column and constraint name, in the first load of all nineteen /admin
 * routes — `/admin/login` included, which is served before anyone has signed
 * in. Nothing in the browser ever read a byte of it.
 *
 * So: no imports here, ever. That is the whole point of the file.
 */

export const inputClass =
  "w-full rounded-card border border-line bg-surface px-3 py-2 text-body text-fg outline-none focus-visible:border-accent";
export const labelClass =
  "block font-mono text-meta uppercase tracking-meta text-fg-tertiary";
export const buttonClass =
  "min-h-11 rounded-card bg-fg px-5 text-caption text-bg transition-opacity disabled:opacity-50";
