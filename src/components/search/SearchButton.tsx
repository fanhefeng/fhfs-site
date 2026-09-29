"use client";

import { useTranslations } from "next-intl";
import { openSearch } from "@/lib/client/search";

/** The magnifier in the island and the menu: it only asks; `SearchLauncher` answers. */
export function SearchButton({ className = "" }: { className?: string }) {
  const t = useTranslations("search");
  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label={t("buttonAria")}
      title={t("buttonTitle")}
      className={`grid size-9 cursor-pointer place-items-center rounded-full text-fg-secondary transition-colors hover:text-fg ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-[17px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="10.5" cy="10.5" r="6" />
        <line x1="15" y1="15" x2="20" y2="20" />
      </svg>
    </button>
  );
}
