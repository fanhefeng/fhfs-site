"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { type Locale } from "@/i18n/routing";
import { registerSiteTools, type WebMcpRegistry } from "@/lib/client/webmcp";

/** Public-page enhancement: no UI, model API keys, server code or eager index fetch. */
export function WebMCP({ enabled }: { enabled: boolean }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    const registry = (document as Document & { readonly modelContext?: WebMcpRegistry })
      .modelContext;
    return registerSiteTools(registry, {
      locale,
      async navigate(path, signal) {
        signal?.throwIfAborted();
        router.push(path.slice(3) || "/", { locale: path.slice(1, 3) as Locale });
      },
    });
  }, [enabled, locale, router]);
  return null;
}
