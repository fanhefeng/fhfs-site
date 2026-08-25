import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getResumeExperiences, getResumeProfile } from "@/lib/content";
import { sectionMetadata } from "@/lib/seo";

export const generateMetadata = sectionMetadata("resume", "/resume");

/**
 * Resume — the formal, printable counterpart to /intro's 3D face. One narrow
 * column, no animation: a page meant to be read top to bottom, on screen or
 * on paper. Everything on it comes from the database and is edited in
 * /admin/resume; until the profile is first saved it shows its quiet empty
 * state rather than inventing a person.
 */
export default async function ResumePage({
  params,
}: PageProps<"/[locale]/resume">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("resume");
  const profile = await getResumeProfile();
  const experiences = await getResumeExperiences();

  return (
    <main id="main" className="mx-auto w-full max-w-[720px] flex-1 px-6 pb-24 pt-24 sm:pt-32 print:pb-8 print:pt-8">
      <header>
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {t("title")}
        </p>

        {profile ? (
          <>
            <h1 className="mt-5 text-display-sm text-fg">
              {profile.name[locale]}
            </h1>
            <p className="no-cjk-oblique mt-4 font-serif text-title italic leading-tight text-fg-secondary">
              {profile.tagline[locale]}
            </p>

            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-caption text-fg-secondary">
              {profile.email && (
                <li>
                  <a
                    href={`mailto:${profile.email}`}
                    className="hover:text-accent"
                  >
                    <span className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                      Email&ensp;
                    </span>
                    {profile.email}
                  </a>
                </li>
              )}
              {profile.github && (
                <li>
                  <a
                    href={`https://github.com/${profile.github}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-accent"
                  >
                    <span className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                      GitHub&ensp;
                    </span>
                    {profile.github}
                  </a>
                </li>
              )}
              {profile.location && (
                <li>
                  <span className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                    {t("locationLabel")}&ensp;
                  </span>
                  {profile.location[locale]}
                </li>
              )}
            </ul>

            {profile.intro[locale].length > 0 && (
              <div className="mt-10 space-y-4 text-body text-fg-secondary">
                {profile.intro[locale].map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="mt-6 text-body text-fg-secondary">{t("empty")}</p>
        )}
      </header>

      {experiences.length > 0 && (
        <section className="mt-16 print:mt-10">
          <h2 className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
            {t("experienceTitle")}
          </h2>

          <div className="mt-8 space-y-10 print:space-y-6">
            {experiences.map((experience) => (
              <article key={experience.key}>
                <h3 className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  {experience.url ? (
                    <a
                      href={experience.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-heading text-fg hover:text-accent"
                    >
                      {experience.company[locale]}
                    </a>
                  ) : (
                    <span className="text-heading text-fg">
                      {experience.company[locale]}
                    </span>
                  )}
                  <span className="text-caption text-fg-secondary">
                    {experience.role[locale]}
                  </span>
                  <span className="font-mono text-meta text-fg-tertiary">
                    {experience.period[locale]}
                  </span>
                </h3>
                {experience.bullets[locale].length > 0 && (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-body text-fg-secondary print:space-y-1">
                    {experience.bullets[locale].map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
