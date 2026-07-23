import { getTranslations, getLocale } from "next-intl/server";
import { site } from "@/config/site";
import { ArtDecoDivider } from "@/components/deco/ArtDecoDivider";

export async function Footer() {
  const t = await getTranslations("footer");
  const locale = await getLocale();

  return (
    <footer className="mt-24 border-t border-line px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center">
        <ArtDecoDivider />
        <p className="font-sign text-lg text-gold/80">{site.signName}</p>
        <p className="text-xs text-muted-fg">{t("builtWith")}</p>
        <div className="flex items-center gap-4 text-xs text-muted-fg">
          <a
            href={site.social.github}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-neon-blue"
          >
            GitHub
          </a>
          <a
            href={`/${locale}/rss.xml`}
            className="transition-colors hover:text-neon-blue"
          >
            {t("rss")}
          </a>
        </div>
        <p className="text-xs text-muted-fg/60">
          © {new Date().getFullYear()} {site.author} · {t("rights")}
        </p>
      </div>
    </footer>
  );
}
