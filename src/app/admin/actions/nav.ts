"use server";

import { db } from "@/db";



import * as schema from "@/db/schema";
import { adminSession } from "@/lib/auth/session";



import { str, validPath } from "@/lib/forms";

import { TAGS } from "@/lib/content";



import { isNavGroup, NAV_GROUPS } from "@/lib/nav";



import { invalidate, SESSION_EXPIRED, collectRows, type ActionState } from "./shared";




export async function saveNavItems(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const rows = collectRows(form, "nav")
    .map((i, index) => ({
      href: str(form, `nav.${i}.href`),
      labelKey: str(form, `nav.${i}.labelKey`),
      surfaces: ["header", "footer", "fullnav", "sitemap"].filter(
        (surface) => form.get(`nav.${i}.surface.${surface}`) === "on"
      ),
      sort: index,
      group: str(form, `nav.${i}.group`),
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

  // A label key that neither the catalogues nor copy_blocks knows renders as
  // raw "nav.xxx" in the header of every page — refuse it here instead.
  // `Object.hasOwn`, not `in`: "constructor" is `in` every object.
  const [zhNav, enNav] = await Promise.all(
    (["zh", "en"] as const).map((locale) =>
      import(`../../../../messages/${locale}.json`).then(
        (m) => (m.default as { nav?: Record<string, unknown> }).nav ?? {}
      )
    )
  );
  const overrides = new Set(
    (
      await db.select({ key: schema.copyBlocks.key }).from(schema.copyBlocks)
    ).map((row) => row.key)
  );
  for (const row of rows) {
    const known =
      (Object.hasOwn(zhNav!, row.labelKey) && Object.hasOwn(enNav!, row.labelKey)) ||
      overrides.has(`nav.${row.labelKey}`);
    if (!known) {
      return {
        error: `文案 key 不存在：nav.${row.labelKey} 在语言文件和站点文案里都找不到。`,
      };
    }
  }

  // Atomic for the same reason as saveChips — an empty nav_items is a site
  // with no header.
  const values = rows.map((row) => ({ ...row, group: row.group || null }));
  const wipe = db.delete(schema.navItems);
  await db.batch(
    values.length ? [wipe, db.insert(schema.navItems).values(values)] : [wipe]
  );

  invalidate(TAGS.nav);
  return { ok: true };
}
