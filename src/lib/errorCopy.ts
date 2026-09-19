import type { Locale } from "@/i18n/routing";

/**
 * The `error` namespace, copied out for `app/global-error.tsx`.
 *
 * That boundary is a client component bundled with the root layout, so every
 * page downloads it — and it used to import both catalogues whole to read
 * these five lines, which put about 58 KB gzipped of copy back into the
 * payload `CLIENT_NAMESPACES` had just cut it out of. It has no intl
 * provider to read them through (the layout is what failed), so they live
 * here instead; `errorCopy.test.ts` keeps them word for word with the files.
 */
export const ERROR_COPY: Record<
  Locale,
  { kicker: string; title: string; description: string; retry: string; backHome: string }
> = {
  zh: {
    kicker: "印刷事故",
    title: "这一页没能印出来",
    description: "不是你的问题，是我们这边出了岔子。再试一次通常就好；要是还不行，过一会儿再来。",
    retry: "再试一次",
    backHome: "回首页",
  },
  en: {
    kicker: "Printing error",
    title: "This page did not make it to print",
    description:
      "Nothing you did — something went wrong on our side. Trying again usually works; if not, come back in a little while.",
    retry: "Try again",
    backHome: "Back home",
  },
};
