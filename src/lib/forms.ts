import type { MomentMedia } from "@/lib/moments";
import { lines } from "@/lib/resume";

/**
 * How the admin's Server Actions read a form.
 *
 * Every field the editor submits goes through one of these, so the rules —
 * what counts as a key, a date, a link — are stated once and tested once
 * (src/lib/__tests__/forms.test.ts) rather than re-derived per action. Pure
 * functions over `FormData` and strings: no database, no request, nothing
 * that needs Next.
 */

export const str = (form: FormData, key: string): string => String(form.get(key) ?? "").trim();

/**
 * Verbatim, including leading and trailing spaces.
 *
 * Copy has to be read this way. `footer.timePrefix` is `"青岛 · "` and
 * `timeSuffix` is `" in Qingdao"` — the two of them bracket a clock, and which
 * side the city sits on differs by language. Trimming them silently closes the
 * gap, and nothing downstream notices: the markup still renders, HTML collapses
 * the whitespace, and the line just reads slightly wrong forever.
 */
export const raw = (form: FormData, key: string): string => String(form.get(key) ?? "");

/** Narrows to the locale union — excluding literals off `string` does not. */
export const parseLocale = (value: string): "zh" | "en" | null =>
  value === "zh" || value === "en" ? value : null;

export const localized = (form: FormData, key: string) => ({
  zh: str(form, `${key}.zh`),
  en: str(form, `${key}.en`),
});

/** A bilingual textarea read as a list — one item per line, blanks dropped. */
export const localizedLines = (form: FormData, key: string) => ({
  zh: lines(raw(form, `${key}.zh`)),
  en: lines(raw(form, `${key}.en`)),
});

/**
 * A comma-separated field as a list: tags, platforms. Either comma — the
 * full-width one a Chinese keyboard produces is the same character to the
 * author, the same way the résumé's grammar takes either pipe.
 */
export const list = (form: FormData, key: string): string[] =>
  str(form, key)
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * The grammar of a key, as source: the action tests it, and the "new" forms
 * hand the same string to `<input pattern>` so a bad key is caught beside the
 * field instead of after a round trip. The hyphen is escaped because a
 * browser compiles `pattern` with the `v` flag, where a bare one in a class
 * is a syntax error — and an invalid pattern is silently no pattern at all.
 */
export const KEY_PATTERN = "[a-z0-9][a-z0-9\\-]*";
const KEY_RE = new RegExp(`^${KEY_PATTERN}$`);

/** Shared by every keyed table — an empty key would upsert a "" row forever.
 *  Post slugs obey the same grammar (they become URLs). */
export const validKey = (key: string): boolean => KEY_RE.test(key);

/** What the forms say beside a key that breaks the grammar. */
export const KEY_MESSAGE = "只能用小写字母、数字和连字符，且不能以连字符开头。";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The regex is happy with 2026-02-30; the round trip through `Date` is not
 *  (a date-only ISO string parses as UTC, so it comes back unchanged). */
export const validDate = (value: string): boolean => {
  if (!DATE_RE.test(value)) return false;
  const time = Date.parse(value);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
};

const MOMENT_TIME_RE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})$/;

/**
 * A moment is stamped to the minute, in the site's zone: `2026-09-07 23:15`
 * as the author would write it (a `T` in place of the space is fine too),
 * read as the instant that is. Null for anything that is not a real minute —
 * 24:00, 2026-02-30. The site's zone is UTC+8 without daylight saving, so
 * the offset is a constant.
 */
export function parseMomentTime(value: string): Date | null {
  const match = MOMENT_TIME_RE.exec(value);
  if (!match) return null;
  const [, day, hour, minute] = match;
  if (!validDate(day!) || Number(hour) > 23 || Number(minute) > 59) return null;
  return new Date(`${day}T${hour}:${minute}:00+08:00`);
}

/**
 * A site-relative path: one leading slash and no way off the site.
 * `//evil.com` also starts with "/" — a browser reads that as
 * protocol-relative — and so does `/\evil.com`, since URL parsing treats a
 * backslash as a slash.
 */
export const validPath = (value: string): boolean =>
  value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");

/**
 * Anything a page renders as an `href` or `src`: a full http(s) URL, or a
 * path on this site. Everything else with a scheme — `javascript:`, `data:`
 * — is refused, the same belt the markdown pipeline wears (lib/markdown.ts).
 * Only the author writes here; this is for the day that stops being true.
 */
export const validLink = (value: string): boolean =>
  /^https?:\/\/\S+$/.test(value) || validPath(value);

/** A GitHub account name — it is spliced into a URL path on /resume. */
export const validGithubUser = (value: string): boolean => /^[A-Za-z0-9-]{1,39}$/.test(value);

/** What a Postgres `integer` column holds. `Number.isInteger(1e10)` is true,
 *  and the column would still refuse it — as a database error, not a form one. */
const INT4_MIN = -2147483648;
const INT4_MAX = 2147483647;

/**
 * `Number(form.get("sort") ?? 0)` looked safe and was not: `Number("abc")` is
 * NaN and `Number("1e400")` is Infinity, and either reaches the integer column
 * as a database error rather than a form one. Empty means `fallback`; anything
 * else has to be a whole number the column can hold.
 */
export function intField<Fallback extends number | null>(
  form: FormData,
  key: string,
  label: string,
  fallback: Fallback,
): { ok: true; value: number | Fallback } | { ok: false; error: string } {
  const text = str(form, key);
  if (!text) return { ok: true, value: fallback };
  const n = Number(text);
  if (!Number.isInteger(n)) return { ok: false, error: `${label}要填整数。` };
  if (n < INT4_MIN || n > INT4_MAX) return { ok: false, error: `${label}超出范围了。` };
  return { ok: true, value: n };
}

const SIZE_RE = /^(\d+)x(\d+)$/;
const DURATION_RE = /^(\d+(?:\.\d+)?)s$/;
const MEDIA_KINDS = new Set(["image", "audio", "video"]);

export type MediaParse = { ok: true; value: MomentMedia[] } | { ok: false; error: string };

/**
 * The board's media field, one file per line: the kind, its address, then
 * what that kind needs, in any order — `1080x1440` for a picture or a video,
 * `90s` for a voice note or a video, `poster=/moments/x.jpg` for a video.
 *
 *   image /moments/soul-1-1.jpg 1080x1440
 *   audio /moments/soul-2-1.m4a 90s
 *   video https://…/soul-3-1.mp4 720x1280 30s poster=/moments/soul-3-1.jpg
 *
 * `formatMedia` writes the same lines back, so a row round-trips through the
 * editor unchanged. Errors name the line: this field is a list, and a
 * "看不懂" without a line number sends the author reading all of it.
 */
export function parseMedia(text: string): MediaParse {
  const out: MomentMedia[] = [];
  const rows = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  for (const [i, line] of rows.entries()) {
    const at = `第 ${i + 1} 行`;
    const [kind, src, ...rest] = line.split(/\s+/);
    if (!kind || !MEDIA_KINDS.has(kind)) {
      return { ok: false, error: `${at}：开头要是 image、audio 或 video。` };
    }
    if (!src || !validLink(src)) {
      return {
        ok: false,
        error: `${at}：第二项要是文件地址——站内以单个 / 开头，或完整的 http(s):// 地址。`,
      };
    }
    let size: [number, number] | undefined;
    let duration: number | undefined;
    let poster: string | undefined;
    for (const token of rest) {
      const s = SIZE_RE.exec(token);
      const d = DURATION_RE.exec(token);
      if (s && Number(s[1]) > 0 && Number(s[2]) > 0) size = [Number(s[1]), Number(s[2])];
      else if (d && Number(d[1]) > 0) duration = Number(d[1]);
      else if (token.startsWith("poster=") && validPath(token.slice("poster=".length))) {
        poster = token.slice("poster=".length);
      } else {
        return {
          ok: false,
          error: `${at}：看不懂「${token}」。尺寸写 1080x1440，时长写 90s，封面写 poster=/moments/x.jpg。`,
        };
      }
    }
    if (kind === "image") {
      if (!size) return { ok: false, error: `${at}：图片要写尺寸，如 1080x1440。` };
      out.push({ kind, src, width: size[0], height: size[1] });
    } else if (kind === "audio") {
      if (!duration) return { ok: false, error: `${at}：语音要写时长，如 90s。` };
      out.push({ kind, src, duration });
    } else {
      if (!size || !duration || !poster) {
        return {
          ok: false,
          error: `${at}：视频要写尺寸、时长和封面，如 720x1280 30s poster=/moments/x.jpg。`,
        };
      }
      out.push({ kind: "video", src, poster, width: size[0], height: size[1], duration });
    }
  }
  return { ok: true, value: out };
}

/** The lines `parseMedia` reads, written back for the editor. */
export const formatMedia = (media: MomentMedia[]): string =>
  media
    .map((item) => {
      if (item.kind === "image") return `image ${item.src} ${item.width}x${item.height}`;
      if (item.kind === "audio") return `audio ${item.src} ${item.duration}s`;
      return `video ${item.src} ${item.width}x${item.height} ${item.duration}s poster=${item.poster}`;
    })
    .join("\n");
