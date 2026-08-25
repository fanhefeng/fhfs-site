import { useTranslations } from "next-intl";
import { Sticker } from "@/components/ui/Sticker";
import { AppMock } from "@/components/software/AppMock";
import { appMonogram, mockAccent, type SoftwareApp } from "@/components/software/appMeta";

type Props = {
  app: SoftwareApp;
  /** Drives the sticker's deterministic tilt — pass the list index. */
  index: number;
  /**
   * `feature` is the col-span-2 hero tile (big schematic, full description),
   * `tile` the regular bento cell, `rail` the compact card on the mobile
   * swipe rail.
   */
  variant?: "feature" | "tile" | "rail";
  className?: string;
};

/**
 * One app in the bento. Glass-thin container, sticker monogram (glass is the
 * container material, stickers are the contents), and a state-aware schematic
 * of the app's interface that cross-fades with the gallery lights.
 *
 * Hover is a 4px lift with a two-layer shadow cross-fade, pure CSS — the same
 * grammar as MiniBento's cells, and Tailwind's hover variants only engage on
 * hover-capable pointers. Box-shadow is never transitioned: the resting and
 * lifted shadows are separate painted layers whose opacity swaps while they
 * ride the lift, so the card and its shadow stay welded.
 */
export function AppCard({ app, index, variant = "tile", className }: Props) {
  const t = useTranslations("software");

  const feature = variant === "feature";
  const rail = variant === "rail";

  return (
    <article
      data-app-card
      data-category={app.category}
      className={`group relative isolate h-full ${className ?? ""}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-card shadow-card transition-[transform,opacity] duration-300 ease-out group-hover:-translate-y-1 group-hover:opacity-0"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-card opacity-0 shadow-lift transition-[transform,opacity] duration-300 ease-out group-hover:-translate-y-1 group-hover:opacity-100"
      />

      <div
        className={`glass-thin flex h-full flex-col overflow-hidden rounded-card shadow-none transition-transform duration-300 ease-out group-hover:-translate-y-1 ${
          feature ? "sm:flex-row" : ""
        }`}
      >
        {/* Schematic screenshot — the feature tile puts it beside the copy,
         * everyone else wears it as a lid. */}
        <AppMock
          app={app}
          label={t("mockAlt", { name: app.name })}
          className={
            feature
              ? "aspect-[16/10] w-full shrink-0 border-b border-line sm:aspect-auto sm:order-last sm:w-1/2 sm:border-b-0 sm:border-l"
              : `w-full shrink-0 border-b border-line ${rail ? "aspect-[16/9]" : "aspect-[16/10]"}`
          }
        />

        <div
          className={`flex min-w-0 flex-1 flex-col ${feature ? "gap-3 p-6 sm:p-7" : "gap-2 p-5"}`}
        >
          <div className="flex items-start gap-3">
            <Sticker seed={index} className="shrink-0">
              <span
                className="flex size-10 items-center justify-center rounded-[0.75rem] font-mono text-xs font-semibold tracking-[0.02em] text-white"
                style={{
                  background: `linear-gradient(150deg, ${mockAccent(
                    app.hue,
                    "light"
                  )}, ${mockAccent(app.hue, "dark")})`,
                }}
              >
                {appMonogram(app.name)}
              </span>
            </Sticker>
            <div className="min-w-0">
              {/* h2, not h3: on /software the gallery sits directly under the
                  page's h1, with no section heading between them. */}
              <h2
                lang="en"
                className={`vibrancy ${feature ? "text-title" : "text-heading"} truncate`}
              >
                {app.name}
              </h2>
              <p className="truncate text-caption text-fg-secondary">{app.tagline}</p>
            </div>
          </div>

          <p
            className={`text-caption leading-relaxed text-fg-secondary ${
              feature ? "" : "line-clamp-3"
            }`}
          >
            {app.description}
          </p>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-2">
            {app.version || app.platforms.length > 0 ? (
              <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                {/* The version is the repo's latest GitHub release — it keeps
                    itself current, so it is never typed here. */}
                {app.version ? (
                  <span className="normal-case text-accent">{app.version}</span>
                ) : null}
                {app.version && app.platforms.length > 0 ? " · " : null}
                {app.platforms.join(" · ")}
              </p>
            ) : (
              <span />
            )}
            <a
              href={app.website}
              target="_blank"
              rel="noopener noreferrer"
              // Several cards repeat the same CTA word — name the app for the
              // screen-reader link list.
              aria-label={`${t(app.cta)} — ${app.name}`}
              className="inline-flex min-h-11 items-center gap-1.5 text-caption font-medium text-fg underline decoration-accent/55 decoration-1 underline-offset-4 transition-colors duration-200 hover:text-accent hover:decoration-accent"
            >
              {t(app.cta)}
              <span aria-hidden className="translate-y-px">
                ↗
              </span>
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
