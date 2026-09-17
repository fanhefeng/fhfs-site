"use client";

import { useEffect, useId, useRef, useState } from "react";
import { fieldSkin } from "../styles";

export type SelectOption = {
  value: string;
  /** What to show instead of the raw value, when the value is a code word. */
  label?: string;
  /** A second, dimmer line — what choosing it actually does. */
  hint?: string;
};

/**
 * A listbox, written out rather than borrowed from a native `<select>`.
 *
 * The native control can be given a border and an arrow, but its open menu is
 * drawn by the OS: on macOS that means a system popup in the system's own
 * colours, which in a dark workbench is the one thing on the page that ignores
 * the theme. This one is ordinary DOM, so the panel is the site's card — same
 * radius, same line, same amber for what is chosen — and each option can carry
 * a line of explanation, which `<option>` has nowhere to put.
 *
 * The value still leaves through a hidden input under the same `name`, so every
 * Server Action reads exactly what it read before. Disabled renders as a plain
 * read-only field and submits nothing, which is what a disabled `<select>`
 * does — the forms that need the value anyway (PostForm, SecretForm) already
 * carry their own hidden input for it.
 *
 * Keyboard: ↑/↓ move, Home/End jump, Enter/Space commit, Esc closes, and a
 * printable character jumps to the next option starting with it.
 */
export function Select({
  name,
  options,
  defaultValue,
  value: controlledValue,
  onValueChange,
  disabled = false,
  id,
  labelledBy,
}: {
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  /** Pass with `onValueChange` when the parent owns the value (ChipsForm). */
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  id?: string;
  /** The id of the element that names this control, when it isn't a <label>. */
  labelledBy?: string;
}) {
  const fallback = options[0]?.value ?? "";
  const [inner, setInner] = useState(defaultValue ?? fallback);
  const value = controlledValue ?? inner;
  const setValue = (next: string) => {
    if (controlledValue === undefined) setInner(next);
    onValueChange?.(next);
  };
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const listId = `${generatedId}-list`;

  const selected = options.find((option) => option.value === value);

  // Clicking anywhere else closes it. Pointerdown rather than click, so the
  // panel is gone before the click lands on whatever is underneath.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const openAt = (index: number) => {
    setActive(index < 0 ? 0 : index);
    setOpen(true);
  };

  const commit = (index: number) => {
    const option = options[index];
    if (!option) return;
    setValue(option.value);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const current = options.findIndex((option) => option.value === value);

    if (!open) {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        openAt(current);
      }
      return;
    }

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        event.preventDefault();
        setActive((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(active);
        break;
      case "Tab":
        setOpen(false);
        break;
      default: {
        if (event.key.length !== 1 || event.metaKey || event.ctrlKey) return;
        const needle = event.key.toLowerCase();
        const from = active + 1;
        const order = [...options.slice(from), ...options.slice(0, from)];
        const hit = order.find((option) =>
          (option.label ?? option.value).toLowerCase().startsWith(needle),
        );
        if (hit) setActive(options.indexOf(hit));
      }
    }
  };

  if (disabled) {
    return (
      <div
        id={id}
        className={`${fieldSkin} flex min-h-11 w-full cursor-not-allowed items-center bg-surface px-3.5 py-2.5 text-body text-fg-tertiary hover:border-line`}
      >
        {selected?.label ?? value}
      </div>
    );
  }

  return (
    <div ref={root} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        id={id}
        type="button"
        role="combobox"
        aria-controls={listId}
        aria-expanded={open}
        // On the element that holds the focus, which is this one — the options
        // are addressed, never focused. On the listbox it named an option that
        // no focused element pointed at, so a screen reader announced none of
        // the arrowing. Set only while there is a list to point into.
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-haspopup="listbox"
        aria-labelledby={labelledBy}
        onClick={() =>
          open ? setOpen(false) : openAt(options.findIndex((o) => o.value === value))
        }
        onKeyDown={onKeyDown}
        className={`${fieldSkin} flex min-h-11 w-full items-center gap-3 px-3.5 py-2.5 text-left text-body ${
          open ? "border-accent" : ""
        }`}
      >
        <span className="flex-1 truncate">{selected?.label ?? value}</span>
        <svg
          viewBox="0 0 12 12"
          aria-hidden
          className={`size-3 shrink-0 text-fg-tertiary transition-transform duration-200 ${
            open ? "-scale-y-100" : ""
          }`}
        >
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          ref={list}
          id={listId}
          role="listbox"
          tabIndex={-1}
          className="absolute z-30 mt-1.5 max-h-72 w-full overflow-auto rounded-card border border-line bg-surface-raised p-1 shadow-lift animate-[admin-pop_140ms_ease-out]"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- the keyboard path is the trigger's onKeyDown, which owns the whole listbox
              <div
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                // Focus stays on the trigger and travels by aria-activedescendant;
                // -1 keeps the options out of the tab order but addressable.
                tabIndex={-1}
                aria-selected={isSelected}
                onMouseEnter={() => setActive(index)}
                onClick={() => commit(index)}
                className={`flex cursor-pointer items-baseline gap-2.5 rounded-[calc(var(--r-chip)-0.25rem)] px-2.5 py-2 text-body transition-colors ${
                  index === active ? "bg-surface" : ""
                } ${isSelected ? "text-accent" : "text-fg"}`}
              >
                <span aria-hidden className="w-3 shrink-0 font-mono text-meta">
                  {isSelected ? "✓" : ""}
                </span>
                <span className="flex-1">
                  {option.label ?? option.value}
                  {option.hint && (
                    <span className="mt-0.5 block text-caption text-fg-tertiary">
                      {option.hint}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
