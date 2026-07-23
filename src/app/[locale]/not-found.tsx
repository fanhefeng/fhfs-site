import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFoundPage() {
  const t = useTranslations("notFound");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="font-sign text-6xl neon-red">404</p>
      <h1 className="font-deco text-2xl tracking-widest text-gold">
        {t("title")}
      </h1>
      <p className="text-sm text-muted-fg">{t("description")}</p>
      <Link
        href="/"
        className="mt-4 rounded border border-neon-blue/50 px-4 py-2 text-sm text-neon-blue transition-all hover:[text-shadow:var(--glow-blue)]"
      >
        {t("backHome")}
      </Link>
    </main>
  );
}
