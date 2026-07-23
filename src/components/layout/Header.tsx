"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { site } from "@/config/site";
import { LocaleSwitcher } from "./LocaleSwitcher";

const navItems = [
  { href: "/blog", key: "blog" },
  { href: "/about", key: "about" },
  { href: "/portfolio", key: "portfolio" },
  { href: "/software", key: "software" },
] as const;

export function Header() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-sign text-xl text-neon-red transition-[text-shadow] duration-200 hover:[text-shadow:var(--glow-red)]"
        >
          {site.signName}
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded px-2 py-2 text-sm tracking-wide transition-colors sm:px-3 ${
                  active
                    ? "text-gold [text-shadow:var(--glow-gold)]"
                    : "text-muted-fg hover:text-fg"
                }`}
              >
                {t(item.key)}
              </Link>
            );
          })}
          <LocaleSwitcher />
        </nav>
      </div>
    </header>
  );
}
