import type { Metadata } from "next";
import { NotFoundStage } from "@/components/notfound/NotFoundStage";
import { routing } from "@/i18n/routing";
import { site } from "@/config/site";
import zh from "../../messages/zh.json";
import en from "../../messages/en.json";
import { fontVariables } from "./fonts";
import "./globals.css";

/**
 * The 404 served for any URL that matches no route.
 *
 * It has to exist separately from `[locale]/not-found.tsx` because this site's
 * root layout lives under a dynamic segment (`app/[locale]/layout.tsx`), so a
 * URL matching no route at all has no layout to render inside. Next serves
 * this file instead, which is why it must return a whole document and dress
 * itself.
 *
 * An unknown *slug* does not come here — that segment renders, misses in the
 * database and calls `notFound()`, which the locale-level boundary catches.
 *
 * One page answers every locale, so it offers both languages rather than
 * guessing. There is no intl provider here — copy is read straight from the
 * message catalogues at build time.
 */

export const metadata: Metadata = {
  title: `${zh.notFound.title} · ${en.notFound.title}`,
  description: en.notFound.description,
};

export default function GlobalNotFound() {
  const blocks = routing.locales.map((locale) => {
    const m = locale === "zh" ? zh : en;
    return {
      lang: locale === "zh" ? "zh-CN" : "en",
      title: m.notFound.title,
      description: m.notFound.description,
      homeHref: `/${locale}`,
      homeLabel: m.notFound.backHome,
      blogHref: `/${locale}/blog`,
      blogLabel: m.notFound.readInstead,
    };
  });

  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${fontVariables} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col bg-bg text-fg">
        {/* Same pre-paint theme script as the app shell: a reader who keeps
            the lights off should not get a white page thrown at them just
            because they mistyped a URL. No ThemeKeeper needed — nothing
            re-renders this document on the client. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("fhfs-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})()`,
          }}
        />
        <NotFoundStage
          blocks={blocks}
          sticker={{
            lang: "zh-CN",
            hint: zh.notFound.stickerHint,
            aria: zh.notFound.stickerAria,
            secret: zh.notFound.stickerSecret,
          }}
        />
        <footer className="px-6 pb-10 text-center font-mono text-caption tracking-meta text-fg-tertiary">
          {site.signName}
        </footer>
      </body>
    </html>
  );
}
