"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { lockScroll, unlockScroll } from "@/lib/client/scrollLock";
import { search, type SearchEntry, type SearchHit } from "@/lib/search";

/** One fetch per language per visit, however often the palette opens. */
const indexes = new Map<string, Promise<SearchEntry[]>>();
const loadIndex = (locale: string) => {
  let index = indexes.get(locale);
  if (!index) {
    index = fetch(`/${locale}/search.json`).then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json() as Promise<SearchEntry[]>;
    });
    // A failed fetch is not remembered — the next open tries again.
    index.catch(() => indexes.delete(locale));
    indexes.set(locale, index);
  }
  return index;
};

/**
 * ⌘K: one field over everything the site holds, in a native `<dialog>` so
 * focus, Escape and the top layer are the browser's. The field is a combobox
 * over a listbox of links: arrows move, Enter follows the highlighted link by
 * clicking it — so a jump from here goes through the route veil like any
 * other link — and a pointer can simply click. With nothing typed it lists
 * the site's pages, which is where most people who press it want to go.
 */
export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("search");
  const locale = useLocale();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lockedRef = useRef(false);
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    let live = true;
    setFailed(false);
    loadIndex(locale).then(
      (index) => live && setEntries(index),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [open, locale]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      lockScroll();
      lockedRef.current = true;
      inputRef.current?.select();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // An unmount mid-open (a locale switch remounts the layout) must not leave
  // the page locked.
  useEffect(
    () => () => {
      if (lockedRef.current) unlockScroll();
    },
    [],
  );

  const hits: SearchHit[] = useMemo(() => {
    if (!entries) return [];
    if (!query.trim()) {
      return entries
        .filter((entry) => entry.kind === "page")
        .map((entry) => ({ ...entry, snippet: "" }));
    }
    return search(entries, query);
  }, [entries, query]);

  // A new query starts at the top.
  useEffect(() => setActive(0), [query]);

  const optionId = (i: number) => `${listId}-${i}`;

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (hits.length === 0) return;
      const next = (active + (event.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length;
      setActive(next);
      document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      document.getElementById(optionId(active))?.click();
    }
  };

  const onClosed = () => {
    if (lockedRef.current) unlockScroll();
    lockedRef.current = false;
    onClose();
  };

  const status = failed
    ? t("error")
    : entries === null
      ? t("loading")
      : query.trim() && hits.length === 0
        ? t("empty", { query: query.trim() })
        : null;

  return (
    <dialog
      ref={dialogRef}
      aria-label={t("dialogAria")}
      onClose={onClosed}
      // The field's keys, heard as they bubble: the field is the only thing
      // in here that takes focus.
      onKeyDown={onKeyDown}
      onClick={(event) => {
        // A press on the backdrop is a press on the dialog itself.
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-transparent p-4 pt-[12vh] backdrop:bg-black/35 backdrop:backdrop-blur-[2px]"
    >
      <div className="mx-auto flex max-h-[70vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[1.25rem] border border-line bg-surface-raised text-fg shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-5">
          <svg
            viewBox="0 0 24 24"
            className="size-[17px] shrink-0 text-fg-tertiary"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="6" />
            <line x1="15" y1="15" x2="20" y2="20" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls={listId}
            aria-activedescendant={hits.length > 0 ? optionId(active) : undefined}
            aria-autocomplete="list"
            aria-label={t("inputAria")}
            placeholder={t("placeholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            // The panel is the field's frame and the field is all it holds: no
            // ring of its own (inline, because the site's ring is unlayered
            // on purpose and outranks any utility), and no native clear
            // button beside the palette's own Esc.
            style={{ outline: "none" }}
            className="h-14 min-w-0 flex-1 bg-transparent text-body text-fg placeholder:text-fg-tertiary [&::-webkit-search-cancel-button]:appearance-none"
          />
          <kbd className="hidden shrink-0 font-mono text-meta text-fg-tertiary sm:block">esc</kbd>
        </div>

        {status && <p className="px-5 py-6 text-caption text-fg-secondary">{status}</p>}

        <div
          id={listId}
          role="listbox"
          aria-label={t("resultsAria")}
          data-lenis-prevent
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2"
        >
          {!query.trim() && hits.length > 0 && (
            <p
              role="presentation"
              className="px-5 pb-1 pt-2 font-mono text-meta uppercase tracking-meta text-fg-tertiary"
            >
              {t("suggestions")}
            </p>
          )}
          {hits.map((hit, i) => (
            <Link
              key={`${hit.kind}:${hit.href}:${i}`}
              id={optionId(i)}
              href={hit.href}
              role="option"
              aria-selected={i === active}
              tabIndex={-1}
              onMouseMove={() => setActive(i)}
              onClick={() => dialogRef.current?.close()}
              className={`mx-2 flex items-baseline gap-3 rounded-xl px-3 py-2.5 ${
                i === active ? "bg-fg/[0.06]" : ""
              }`}
            >
              <span className="w-10 shrink-0 font-mono text-meta uppercase tracking-meta text-accent">
                {t(`kinds.${hit.kind}`)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-caption text-fg">
                  {hit.title || hit.snippet}
                </span>
                {hit.title && hit.snippet && (
                  <span className="mt-0.5 block truncate text-meta text-fg-tertiary">
                    {hit.snippet}
                  </span>
                )}
              </span>
              {hit.meta && (
                <span className="shrink-0 font-mono text-meta text-fg-tertiary tabular-nums">
                  {hit.meta}
                </span>
              )}
            </Link>
          ))}
        </div>

        <p className="hidden border-t border-line px-5 py-2.5 font-mono text-meta text-fg-tertiary sm:block">
          {t("hint")}
        </p>
      </div>
    </dialog>
  );
}
