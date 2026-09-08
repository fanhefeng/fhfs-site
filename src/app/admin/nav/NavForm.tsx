"use client";

import { useActionState, useEffect, useState } from "react";
import { NAV_GROUPS, type NavGroup } from "@/lib/nav";
import { saveNavItems, type ActionState } from "../actions";
import { inputClass, labelClass } from "../AdminChrome";
import { SaveControls } from "../SaveControls";

type NavRow = { href: string; labelKey: string; surfaces: string[]; group: NavGroup | null };
/** A row with the identity the form needs: rows move, so the index is not one. */
type FormRow = NavRow & { id: number };

const SURFACES = [
  { id: "header", label: "顶栏" },
  { id: "footer", label: "页脚" },
  { id: "fullnav", label: "全屏菜单" },
  { id: "sitemap", label: "sitemap" },
] as const;

/** What each wing is called in the form — the site's own names are in messages. */
const GROUP_LABELS: Record<NavGroup, string> = {
  issue: "正刊",
  rooms: "房间",
  me: "作者",
};

/** A new row is, by default, a room: footer, menu and sitemap, under 生活. */
const NEW_ROW: NavRow = { href: "", labelKey: "", surfaces: ["footer", "fullnav", "sitemap"], group: "rooms" };

let nextId = 1;
const withIds = (rows: NavRow[]): FormRow[] => rows.map((row) => ({ ...row, id: nextId++ }));

/**
 * One table for every place a link appears.
 *
 * These used to be four separate lists in four files, and they had drifted:
 * /intro reached only the sitemap, home reached only the full-screen menu.
 * Ticking boxes across one row is what stops that happening again. The
 * group says which wing a row belongs to — the footer clusters by it, the
 * full-screen menu hangs a group's rows under its door (the row of the
 * group that is on the header surface), and /life lists the rooms.
 *
 * Inputs are controlled and re-synced from the server after a save — the save
 * rewrites the whole table, so stale values would silently overwrite it.
 */
export function NavForm({ items }: { items: NavRow[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveNavItems,
    {}
  );
  const [rows, setRows] = useState<FormRow[]>(() => withIds(items));
  useEffect(() => setRows(withIds(items)), [items]);

  const edit = (id: number, row: NavRow) =>
    setRows(rows.map((r) => (r.id === id ? { ...row, id } : r)));

  // Order is the table's `sort`; a row moves one step at a time. The rows
  // are keyed by id, so the moved row's DOM travels with it — and focus is
  // put back on the same button of the same row, so a second press moves
  // it again rather than the row that took its place.
  const move = (id: number, delta: -1 | 1) => {
    const index = rows.findIndex((r) => r.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>(`[data-move="${delta}"][data-row="${id}"]`)
        ?.focus();
    });
  };

  const rowName = (row: NavRow) => row.labelKey || row.href || "新行";

  // `saveNavItems` drops any row with no path, so emptying the field was
  // always the way to remove one — but nothing on the page said so, and a
  // link nobody can delete is a link nobody dares add.
  const remove = (id: number) => {
    const row = rows.find((r) => r.id === id);
    if (row && (row.href || row.labelKey)) {
      if (!window.confirm(`确定删掉「${rowName(row)}」这一行？保存后生效。`)) return;
    }
    setRows(rows.filter((r) => r.id !== id));
  };

  return (
    <form action={formAction}>
      <div className="space-y-5">
        {rows.map((row, i) => (
          <div key={row.id} className="border-t border-line pt-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <label className="space-y-1">
                <span className={labelClass}>路径</span>
                <input
                  name={`nav.${i}.href`}
                  value={row.href}
                  onChange={(e) => edit(row.id, { ...row, href: e.target.value })}
                  placeholder="/blog"
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>文案 key（nav.…）</span>
                <input
                  name={`nav.${i}.labelKey`}
                  value={row.labelKey}
                  onChange={(e) => edit(row.id, { ...row, labelKey: e.target.value })}
                  placeholder="blog"
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>分组</span>
                <select
                  name={`nav.${i}.group`}
                  value={row.group ?? ""}
                  onChange={(e) =>
                    edit(row.id, { ...row, group: (e.target.value || null) as NavGroup | null })
                  }
                  className={inputClass}
                >
                  <option value="">不分组</option>
                  {NAV_GROUPS.map((group) => (
                    <option key={group} value={group}>
                      {GROUP_LABELS[group]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              {SURFACES.map((surface) => (
                <label key={surface.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name={`nav.${i}.surface.${surface.id}`}
                    checked={row.surfaces.includes(surface.id)}
                    onChange={(e) =>
                      edit(row.id, {
                        ...row,
                        surfaces: e.target.checked
                          ? [...row.surfaces, surface.id]
                          : row.surfaces.filter((s) => s !== surface.id),
                      })
                    }
                    className="size-4"
                  />
                  <span className="text-caption">{surface.label}</span>
                </label>
              ))}
              <span className="ml-auto flex items-center gap-1 font-mono text-meta text-fg-tertiary">
                <button
                  type="button"
                  onClick={() => move(row.id, -1)}
                  disabled={i === 0}
                  data-move="-1"
                  data-row={row.id}
                  aria-label={`上移 ${rowName(row)}`}
                  className="rounded-chip px-2 py-1 hover:text-accent disabled:opacity-30 disabled:hover:text-fg-tertiary"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(row.id, 1)}
                  disabled={i === rows.length - 1}
                  data-move="1"
                  data-row={row.id}
                  aria-label={`下移 ${rowName(row)}`}
                  className="rounded-chip px-2 py-1 hover:text-accent disabled:opacity-30 disabled:hover:text-fg-tertiary"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(row.id)}
                  aria-label={`删除 ${rowName(row)}`}
                  className="rounded-chip px-2 py-1 hover:text-accent"
                >
                  ×
                </button>
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRows([...rows, ...withIds([NEW_ROW])])}
        className="mt-4 text-caption text-fg-tertiary hover:text-accent"
      >
        + 加一间房
      </button>

      <SaveControls state={state} pending={pending} sticky />
    </form>
  );
}
