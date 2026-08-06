"use client";

import { useActionState, useEffect, useState } from "react";
import { saveNavItems, type ActionState } from "../actions";
import { inputClass, labelClass } from "../AdminChrome";
import { SaveControls } from "../SaveControls";

type NavRow = { href: string; labelKey: string; surfaces: string[] };

const SURFACES = [
  { id: "header", label: "顶栏" },
  { id: "footer", label: "页脚" },
  { id: "fullnav", label: "全屏菜单" },
  { id: "sitemap", label: "sitemap" },
] as const;

/**
 * One table for every place a link appears.
 *
 * These used to be four separate lists in four files, and they had drifted:
 * /intro reached only the sitemap, home reached only the full-screen menu.
 * Ticking boxes across one row is what stops that happening again.
 *
 * Inputs are controlled and re-synced from the server after a save — the save
 * rewrites the whole table, so stale values would silently overwrite it.
 */
export function NavForm({ items }: { items: NavRow[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveNavItems,
    {}
  );
  const [rows, setRows] = useState(items);
  useEffect(() => setRows(items), [items]);

  const edit = (index: number, row: NavRow) =>
    setRows(rows.map((r, i) => (i === index ? row : r)));

  return (
    <form action={formAction}>
      <div className="space-y-5">
        {rows.map((row, i) => (
          <div key={i} className="border-t border-line pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className={labelClass}>路径</span>
                <input
                  name={`nav.${i}.href`}
                  value={row.href}
                  onChange={(e) => edit(i, { ...row, href: e.target.value })}
                  placeholder="/blog"
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>文案 key（nav.…）</span>
                <input
                  name={`nav.${i}.labelKey`}
                  value={row.labelKey}
                  onChange={(e) => edit(i, { ...row, labelKey: e.target.value })}
                  placeholder="blog"
                  className={inputClass}
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {SURFACES.map((surface) => (
                <label key={surface.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name={`nav.${i}.surface.${surface.id}`}
                    checked={row.surfaces.includes(surface.id)}
                    onChange={(e) =>
                      edit(i, {
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
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          setRows([...rows, { href: "", labelKey: "", surfaces: ["sitemap"] }])
        }
        className="mt-4 text-caption text-fg-tertiary hover:text-accent"
      >
        + 加一条
      </button>

      <SaveControls state={state} pending={pending} sticky />
    </form>
  );
}
