/**
 * Shared field styling for the admin forms, and nothing else in this file.
 *
 * It lives apart from `AdminChrome` on purpose. Every form here is a client
 * component, and they all wanted these strings — but `AdminChrome` is a server
 * module that reaches for `@/db/schema` (through `./counts`) and for the logout
 * action. Importing three class names from it dragged the whole drizzle schema
 * across the client boundary: a 38 KB chunk carrying every table, column and
 * constraint name, in the first load of all nineteen /admin routes —
 * `/admin/login` included, which is served before anyone has signed in.
 * Nothing in the browser ever read a byte of it.
 *
 * So: no imports here, ever. That is the whole point of the file.
 *
 * Everything below is built out of the site's own tokens (`--surface-raised`,
 * `--line`, `--r-chip`, the text scale) so the workbench reads as the same
 * material as the magazine without borrowing its furniture. No glass: the
 * admin is a flat solid background, and §1.3 forbids glass with nothing behind
 * it to refract. The press feedback (`:active { scale: .97 }`) is already on
 * every button globally — don't repeat it here.
 */

/** The shared skin of anything you type into: input, textarea, the select trigger. */
export const fieldSkin =
  "rounded-chip border border-line bg-surface-raised text-fg transition-[border-color,box-shadow,background-color] duration-150 " +
  "hover:border-fg-tertiary/35 focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/20 focus-visible:outline-none";

export const inputClass = `w-full px-3.5 py-2.5 text-body placeholder:text-fg-tertiary/60 read-only:bg-surface read-only:text-fg-tertiary read-only:hover:border-line ${fieldSkin}`;

/** Textareas get the same skin, plus room to breathe and a grab handle. */
export const textareaClass = `${inputClass} resize-y leading-relaxed`;

/** For the fields that hold code, keys and markdown rather than prose. */
export const monoClass = "font-mono text-caption";

export const labelClass =
  "flex items-baseline gap-2 font-mono text-meta uppercase tracking-meta text-fg-tertiary";

/** The dimmer line under a label that explains the field. */
export const hintClass = "text-caption text-fg-tertiary";

/** The primary action: save, sign in. */
export const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-chip bg-fg px-5 text-caption font-medium text-bg " +
  "transition-[opacity,background-color] hover:opacity-90 disabled:pointer-events-none disabled:opacity-45";

/** The secondary action: new row, cancel, "see it out front". */
export const ghostButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-chip border border-line bg-surface-raised px-4 text-caption text-fg-secondary " +
  "transition-[color,border-color] hover:border-fg-tertiary/40 hover:text-fg";

/** Destructive, and quiet until hovered — deleting is never the default move. */
export const dangerButtonClass =
  "inline-flex min-h-10 items-center gap-2 rounded-chip border border-line px-3.5 text-caption text-fg-tertiary " +
  "transition-[color,border-color] hover:border-accent hover:text-accent";

/** A surface a step above the page: form panels, list rows, dashboard cards. */
export const cardClass = "rounded-card border border-line bg-surface-raised";

/** The mono kicker used for group names, counts and timestamps. */
export const metaClass = "font-mono text-meta uppercase tracking-meta text-fg-tertiary";
