"use server";

import { db } from "@/db";

import * as schema from "@/db/schema";
import { adminSession } from "@/lib/server/auth/session";

import { formRows, validPath } from "@/lib/forms";

import { TAGS } from "@/lib/server/content";

import { copyCatalogues } from "@/lib/server/copyCatalogue";

import { isNavGroup, NAV_GROUPS } from "@/lib/nav";

import { invalidate, SESSION_EXPIRED, type ActionState } from "./shared";

export async function saveNavItems(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const rows = formRows(form, "nav")
    .map((row, index) => ({
      href: row.str("href"),
      labelKey: row.str("labelKey"),
      surfaces: ["header", "footer", "fullnav", "sitemap"].filter((surface) =>
        row.checked(`surface.${surface}`),
      ),
      sort: index,
      group: row.str("group"),
    }))
    .filter((row) => row.href);

  // The nav is this site's own pages, so a full URL is refused here where a
  // link field elsewhere would take one — see `validPath` for why `//` and
  // a backslash are not paths.
  for (const row of rows) {
    if (!validPath(row.href)) {
      return { error: `路径要以单个 / 开头，且不能含反斜杠：${row.href}` };
    }
    if (!row.labelKey) {
      return { error: `${row.href} 缺少文案 key。` };
    }
    // The wings are a closed list (`src/lib/nav.ts`): a group the surfaces
    // would not recognise is refused rather than saved and silently ignored.
    if (row.group && !isNavGroup(row.group)) {
      return { error: `分组只能是 ${NAV_GROUPS.join(" / ")} 或留空：${row.href}` };
    }
  }

  // A label key the catalogues don't have renders as raw "nav.xxx" in the
  // header of every page — refuse it here instead. The catalogues are the
  // whole list: `copy_blocks` only overrides lines the files already have.
  // `Object.hasOwn`, not `in`: "constructor" is `in` every object.
  const { zh, en } = await copyCatalogues();
  for (const row of rows) {
    const key = `nav.${row.labelKey}`;
    if (!Object.hasOwn(zh, key) || !Object.hasOwn(en, key)) {
      return {
        error: `文案 key 不存在：nav.${row.labelKey} 在语言文件里找不到。`,
      };
    }
  }

  // Atomic for the same reason as saveChips — an empty nav_items is a site
  // with no header.
  const values = rows.map((row) => ({ ...row, group: row.group || null }));
  const wipe = db.delete(schema.navItems);
  await db.batch(values.length ? [wipe, db.insert(schema.navItems).values(values)] : [wipe]);

  invalidate(TAGS.nav);
  return { ok: true };
}
