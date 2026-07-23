import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { App } from "content-collections";

export function AppCard({ app, locale }: { app: App; locale: Locale }) {
  const t = useTranslations("software");

  return (
    <article className="neon-card flex flex-col p-6">
      <div className="flex items-center gap-3">
        {app.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={app.icon}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-lg border border-line"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line font-sign text-lg text-gold"
          >
            {app.name.charAt(0)}
          </span>
        )}
        <div>
          <h2 className="font-deco text-lg tracking-wide text-fg">{app.name}</h2>
          <p className="text-xs text-muted-fg">{app.tagline[locale]}</p>
        </div>
      </div>
      <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-fg">
        {app.description[locale]}
      </p>
      {app.platforms.length > 0 && (
        <p className="mt-3 text-xs text-muted-fg/70">
          {t("platforms")}: {app.platforms.join(" · ")}
        </p>
      )}
      <a
        href={app.website}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex w-fit items-center gap-2 rounded border border-neon-red/50 px-4 py-2 text-sm text-neon-red transition-all duration-200 hover:border-neon-red hover:[box-shadow:0_0_14px_rgba(255,77,109,0.35)] hover:[text-shadow:var(--glow-red)]"
      >
        {t(
          app.category === "game"
            ? "play"
            : app.category === "website"
              ? "open"
              : "download"
        )}{" "}
        ↗
      </a>
    </article>
  );
}
