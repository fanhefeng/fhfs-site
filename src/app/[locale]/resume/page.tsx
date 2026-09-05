import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { site } from "@/config/site";
import { getResumeExperiences, getResumeProfile } from "@/lib/content";
import { sectionMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { Reveal } from "@/components/fx/Reveal";
import { PrintButton } from "@/components/resume/PrintButton";
import { Rich } from "@/components/resume/Rich";
import { Bullets, ResumeSection } from "@/components/resume/ResumeSection";

export const generateMetadata = sectionMetadata("resume", "/resume");

const metaLabel =
  "font-mono text-meta uppercase tracking-meta text-fg-tertiary";

/**
 * Resume — the formal, printable counterpart to /intro's 3D face.
 *
 * One column of paper with a rail of section labels down its left: summary,
 * skills, experience, open source, education, in the order a reader who
 * hires expects them. No animation beyond the site's one entrance; the page
 * is meant to be read top to bottom, on screen or — through the print
 * button and the print stylesheet in globals.css — on A4. Everything on it
 * comes from the database and is edited in /admin/resume; until the profile
 * is first saved it shows its quiet empty state rather than inventing a
 * person.
 *
 * It is a public page, so what it says is the author's call: the admin can
 * leave the email blank and name employers as loosely as they like, and the
 * page shows whatever it is given.
 */
export default async function ResumePage({
  params,
}: PageProps<"/[locale]/resume">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [t, profile, experiences] = await Promise.all([
    getTranslations("resume"),
    getResumeProfile(),
    getResumeExperiences(),
  ]);

  if (!profile) {
    return (
      <main
        id="main"
        className="mx-auto w-full max-w-[880px] flex-1 px-6 pb-24 pt-24 sm:pt-32"
      >
        <p className={metaLabel}>{t("title")}</p>
        <p className="mt-6 text-body text-fg-secondary">{t("empty")}</p>
      </main>
    );
  }

  const format = await getFormatter();
  const updated = format.dateTime(new Date(profile.updatedAt), {
    year: "numeric",
    month: "long",
  });

  const intro = profile.intro[locale];
  const highlights = profile.highlights[locale];
  const skills = profile.skills[locale];
  const projects = profile.projects[locale];
  const education = profile.education[locale];

  // Sections are numbered in the order they appear, and only the ones with
  // something in them appear — so the numbers are handed out as the page is
  // built rather than fixed to a slot.
  let count = 0;
  const next = () => String(++count).padStart(2, "0");

  return (
    <main
      id="main"
      data-resume
      className="mx-auto w-full max-w-[880px] flex-1 px-6 pb-24 pt-24 sm:pt-32 print:max-w-none print:px-0 print:pb-0 print:pt-0"
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: profile.name[locale],
          jobTitle: profile.tagline[locale],
          url: `${site.url}/${locale}/resume`,
          sameAs: profile.github
            ? [`https://github.com/${profile.github}`]
            : [site.social.github],
        }}
      />

      <Reveal as="section">
        <header>
          <div className="flex items-start justify-between gap-6">
            <p className={metaLabel}>{t("title")}</p>
            <PrintButton label={t("print")} ariaLabel={t("printAria")} />
          </div>

          <h1 className="mt-5 text-display-sm text-fg">
            {profile.name[locale]}
          </h1>
          <p className="no-cjk-oblique mt-3 font-serif text-title italic leading-tight text-fg-secondary">
            {profile.tagline[locale]}
          </p>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-caption text-fg-secondary">
            {profile.location?.[locale] && (
              <li>
                <span className={metaLabel}>{t("locationLabel")}&ensp;</span>
                {profile.location[locale]}
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
                  <span className={metaLabel}>{t("githubLabel")}&ensp;</span>
                  {profile.github}
                </a>
              </li>
            )}
            {profile.website && (
              <li>
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-accent"
                >
                  <span className={metaLabel}>{t("linksLabel")}&ensp;</span>
                  {/* Shown without its scheme — the label already says what it is. */}
                  {profile.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              </li>
            )}
            {profile.email && (
              <li>
                <a href={`mailto:${profile.email}`} className="hover:text-accent">
                  <span className={metaLabel}>{t("emailLabel")}&ensp;</span>
                  {profile.email}
                </a>
              </li>
            )}
            {profile.note?.[locale] && (
              <li className="no-cjk-oblique font-serif italic text-fg-tertiary">
                {profile.note[locale]}
              </li>
            )}
          </ul>
        </header>
      </Reveal>

      {(intro.length > 0 || highlights.length > 0) && (
        <ResumeSection index={next()} title={t("summaryTitle")}>
          {intro.length > 0 && (
            <div className="space-y-4 text-body text-fg-secondary print:space-y-2">
              {intro.map((paragraph, i) => (
                <p key={i}>
                  <Rich text={paragraph} />
                </p>
              ))}
            </div>
          )}
          <Bullets items={highlights} className={intro.length > 0 ? "mt-6" : ""} />
        </ResumeSection>
      )}

      {skills.length > 0 && (
        <ResumeSection index={next()} title={t("skillsTitle")}>
          <dl className="divide-y divide-line border-y border-line">
            {skills.map((group, i) => (
              <div
                key={i}
                className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[8.5rem_1fr] print:break-inside-avoid print:py-2"
              >
                {/* A bare row — the grammar allows a line with no heading —
                    takes the whole width rather than leaving the rail empty. */}
                {group.name && (
                  <dt className="text-caption font-medium text-fg">
                    {group.name}
                  </dt>
                )}
                <dd
                  className={`text-caption text-fg-secondary${group.name ? "" : " sm:col-span-2"}`}
                >
                  <Rich text={group.items} />
                </dd>
              </div>
            ))}
          </dl>
        </ResumeSection>
      )}

      {experiences.length > 0 && (
        <ResumeSection index={next()} title={t("experienceTitle")}>
          <div className="space-y-12 print:space-y-5">
            {experiences.map((experience) => (
              <article key={experience.key}>
                <div className="print:break-inside-avoid">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <h3 className="text-heading text-fg">
                      {experience.url ? (
                        <a
                          href={experience.url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-accent"
                        >
                          {experience.company[locale]}
                        </a>
                      ) : (
                        experience.company[locale]
                      )}
                    </h3>
                    <span className="font-mono text-meta text-fg-tertiary tabular-nums">
                      {experience.period[locale]}
                    </span>
                  </div>
                  {experience.role[locale] && (
                    <p className="mt-1 text-caption font-medium text-fg-secondary">
                      {experience.role[locale]}
                    </p>
                  )}
                  {experience.summary?.[locale] && (
                    <p className="mt-1.5 text-caption text-fg-tertiary">
                      {experience.summary[locale]}
                    </p>
                  )}
                </div>

                <Bullets items={experience.bullets[locale]} className="mt-4" />

                {experience.projects[locale].map((project, i) => (
                  <div
                    key={i}
                    className="mt-6 print:mt-3 print:break-inside-avoid"
                  >
                    <h4 className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-l-2 border-accent/50 pl-3 text-body font-medium text-fg">
                      <span>{project.title}</span>
                      {project.period && (
                        <span className="font-mono text-meta font-normal text-fg-tertiary tabular-nums">
                          {project.period}
                        </span>
                      )}
                    </h4>
                    <Bullets items={project.bullets} className="mt-3" />
                  </div>
                ))}
              </article>
            ))}
          </div>
        </ResumeSection>
      )}

      {projects.length > 0 && (
        <ResumeSection index={next()} title={t("projectsTitle")}>
          <Bullets items={projects} />
        </ResumeSection>
      )}

      {education.length > 0 && (
        <ResumeSection index={next()} title={t("educationTitle")}>
          <ul className="space-y-2 text-body text-fg-secondary">
            {education.map((line, i) => (
              <li key={i}>
                <Rich text={line} />
              </li>
            ))}
          </ul>
        </ResumeSection>
      )}

      {/* On paper the colophon stays with whatever precedes it — a sheet
          carrying one line of mono is a sheet nobody wanted. */}
      <footer className="mt-16 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-line pt-6 print:mt-4 print:break-before-avoid print:pt-2">
        <p className={metaLabel}>{t("updated", { date: updated })}</p>
        <Link
          href="/intro"
          className={`${metaLabel} hover:text-accent print:hidden`}
        >
          {t("introLink")} →
        </Link>
      </footer>
    </main>
  );
}
