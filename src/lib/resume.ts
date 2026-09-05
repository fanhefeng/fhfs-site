import type { ResumeProject, SkillGroup } from "@/db/schema";

/**
 * The résumé's three small text grammars.
 *
 * The admin edits the skills table and each job's projects in a textarea,
 * because a form with a row per skill group and a sub-form per project would
 * be more chrome than content. So the textarea has a grammar, this file is
 * where it lives, and both directions are here: the Server Action parses on
 * save and the form formats on load, so what is stored is structure and what
 * is typed round-trips.
 *
 * The third grammar is inline: bullets may carry `**strong**` and
 * `` `code` ``, and the page renders them as elements rather than passing any
 * HTML through. That is the whole of the markup a résumé needs — a number to
 * lean on, a flag or an API name set in mono.
 */

/** Lines with the blanks and the surrounding spaces dropped. */
export const lines = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

// ---------------------------------------------------------------------------
// Inline emphasis
// ---------------------------------------------------------------------------

export type InlineRun = { text: string; kind: "text" | "strong" | "code" };

/** A `**…**` span or a `` `…` `` span, neither of which may be empty or nest. */
const INLINE = /\*\*[^*\n]+?\*\*|`[^`\n]+`/g;

/**
 * Splits a line into plain, strong and code runs. Anything that is not a
 * complete, well-formed span — a lone `**`, an unclosed backtick, `****` —
 * stays as the text it is: the résumé is read by people who never see the
 * source, so a typo should show as a typo rather than eat the line.
 */
export function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const token = match[0];
    if (match.index > last) {
      runs.push({ text: text.slice(last, match.index), kind: "text" });
    }
    runs.push(
      token.startsWith("**")
        ? { text: token.slice(2, -2), kind: "strong" }
        : { text: token.slice(1, -1), kind: "code" }
    );
    last = match.index + token.length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), kind: "text" });
  return runs;
}

// ---------------------------------------------------------------------------
// Skills: `name | items`, one group per line
// ---------------------------------------------------------------------------

/** Either pipe: the ASCII one and the full-width one a Chinese keyboard
 *  produces are the same character to the author. */
const PIPE = /[|｜]/;

/**
 * One line per group, heading and items either side of a pipe. A line with
 * no pipe is a group with no heading — the items alone — rather than an
 * error, since a résumé can reasonably list a bare row.
 */
export function parseSkillLines(text: string): SkillGroup[] {
  return lines(text).map((line) => {
    const at = line.search(PIPE);
    if (at === -1) return { name: "", items: line };
    return { name: line.slice(0, at).trim(), items: line.slice(at + 1).trim() };
  });
}

export const formatSkillLine = (group: SkillGroup): string =>
  group.name ? `${group.name} | ${group.items}` : group.items;

export const formatSkillLines = (groups: SkillGroup[]): string =>
  groups.map(formatSkillLine).join("\n");

// ---------------------------------------------------------------------------
// Projects: `# title | period`, then one bullet per line
// ---------------------------------------------------------------------------

/** A leading list marker, if the author typed one. `**strong**` at the start
 *  of a bullet survives: the marker has to be followed by whitespace. */
const MARKER = /^[-–—•*]\s+/;

export type ParsedProjects =
  | { projects: ResumeProject[]; error: null }
  | { projects: null; error: string };

/**
 * A heading line starts with `#`; what follows is the title and, after a
 * pipe, an optional period. Every other line is a bullet of the most recent
 * heading, with or without a list marker. A bullet before any heading has
 * nowhere to go, and a heading with no title would be a project with no
 * name; both are reported rather than guessed at — the author is looking at
 * the form when this runs.
 */
export function parseProjects(text: string): ParsedProjects {
  const projects: ResumeProject[] = [];
  for (const line of lines(text)) {
    if (line.startsWith("#")) {
      const head = line.replace(/^#+\s*/, "");
      const at = head.search(PIPE);
      const title = (at === -1 ? head : head.slice(0, at)).trim();
      if (!title) {
        return {
          projects: null,
          error: `「#」后面要跟项目名：${line.slice(0, 24)}`,
        };
      }
      projects.push({
        title,
        period: at === -1 ? null : head.slice(at + 1).trim() || null,
        bullets: [],
      });
      continue;
    }
    const current = projects.at(-1);
    if (!current) {
      return {
        projects: null,
        error: `要点要放在「# 项目名」之后：${line.slice(0, 24)}`,
      };
    }
    current.bullets.push(line.replace(MARKER, ""));
  }
  return { projects, error: null };
}

/** The inverse of `parseProjects` — what the textarea shows on load. Projects
 *  are separated by a blank line, which the parser ignores. */
export function formatProjects(projects: ResumeProject[]): string {
  return projects
    .map((project) => {
      const head = project.period
        ? `# ${project.title} | ${project.period}`
        : `# ${project.title}`;
      return [head, ...project.bullets.map((bullet) => `- ${bullet}`)].join("\n");
    })
    .join("\n\n");
}
