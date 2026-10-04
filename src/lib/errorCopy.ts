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
    kicker: "出错了",
    title: "页面加载失败",
    description: "服务器出了问题。请再试一次，不行的话过一会儿再来。",
    retry: "再试一次",
    backHome: "回首页",
  },
  en: {
    kicker: "Error",
    title: "This page failed to load",
    description:
      "Something went wrong on the server. Please try again; if that does not help, come back a little later.",
    retry: "Try again",
    backHome: "Back home",
  },
};
