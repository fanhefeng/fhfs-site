/**
 * The overlay step in reading the message catalogues: the JSON file is the
 * base, the rows of `copy_blocks` are laid over it. Lives apart from
 * `i18n/request.ts` so the rule can be tested without a Next runtime.
 */

export type Messages = Record<string, unknown>;

/**
 * The namespaces client components read through `useTranslations` — and
 * therefore the only ones the layout hands to `NextIntlClientProvider`.
 *
 * Without the cut, the provider inherits the whole catalogue and every page
 * carries all of it in its RSC payload: the ten lab studies, the idol's
 * timeline, the film's stills, the résumé labels — 19 KB of JSON escaped
 * into the HTML of a page that renders none of it, and again inside every
 * prefetched route. Server components keep reading the full catalogue
 * through `getTranslations`; this list is only what has to cross the wire.
 *
 * A namespace missing from here fails loudly (a MISSING_MESSAGE error in the
 * browser), and `messages.test.ts` scans `src` for every `useTranslations`
 * call so the list cannot drift behind a new component.
 */
export const CLIENT_NAMESPACES = [
  "about",
  "blog",
  "common",
  "error",
  "footer",
  "home",
  "moments",
  "nav",
  "notFound",
  "secrets",
  "software",
] as const;

/** The catalogue cut down to `namespaces` — a namespace it lacks is skipped. */
export function pick(messages: Messages, namespaces: readonly string[]): Messages {
  const out: Messages = {};
  for (const namespace of namespaces) {
    // Own keys only. `in` walks the prototype, so a namespace named after
    // something on `Object.prototype` would hand the client a method where a
    // catalogue should be — and `merge` below already refuses that direction.
    if (Object.hasOwn(messages, namespace)) out[namespace] = messages[namespace];
  }
  return out;
}

function isPlainObject(value: unknown): value is Messages {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Overlays `override` onto `base`, one key at a time. Plain objects recurse,
 * a leaf replaces a leaf, and a key the catalogue lacks is added whole. What
 * is refused is a shape mismatch — a string laid over a namespace, or an
 * object over a string: either would take every `t()` beneath it down, so
 * the catalogue's shape wins and the row is ignored.
 *
 * The override comes out of a table. `content.ts` already refuses a
 * `__proto__` segment on the way in; this is the second belt, because
 * `out["__proto__"] = value` on a plain object is the setter, and would hand
 * the merged catalogue a foreign prototype.
 */
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function merge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (UNSAFE_KEYS.has(key)) continue;
    const existing = out[key];
    if (existing === undefined) {
      out[key] = value;
    } else if (isPlainObject(existing) && isPlainObject(value)) {
      out[key] = merge(existing, value);
    } else if (!isPlainObject(existing) && !isPlainObject(value)) {
      out[key] = value;
    }
  }
  return out;
}
