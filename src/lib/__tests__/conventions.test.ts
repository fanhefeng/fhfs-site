import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The rules in AGENTS.md that break silently: a page that still renders, a
 * save that still succeeds. Each is checked against the source here, because
 * nothing at runtime would ever say so.
 */

const src = fileURLToPath(new URL("../../", import.meta.url));
const rel = (file: string) => path.relative(src, file).split(path.sep).join("/");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) {
      if (name !== "__tests__") out.push(...sourceFiles(file));
    } else if (/\.tsx?$/.test(name)) out.push(file);
  }
  return out;
}

const files = sourceFiles(src).map((file) => ({
  file: rel(file),
  text: readFileSync(file, "utf8"),
}));

/** Top-level declarations of a module: split where a line starts a new one. */
function declarations(text: string): string[] {
  return text.split(
    /^(?=(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|const|let|class)\s)/m,
  );
}

/** The body of a function declaration, comments removed. */
function body(declaration: string): string {
  const signatureEnd = declaration.search(/\)\s*(?::[^{]+)?\{\s*$/m);
  return declaration
    .slice(declaration.indexOf("{", signatureEnd))
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("public pages", () => {
  // Without it the page renders all the same — dynamically, on every request.
  // The layout does by hand what pageLocale does for a page.
  it("all start from pageLocale(params)", () => {
    const pages = files.filter(({ file }) => /^app\/\[locale\]\/.*(page|layout)\.tsx$/.test(file));
    expect(pages.length).toBeGreaterThan(10);
    expect(
      pages
        .filter(({ text }) => !/await pageLocale\(|\bsetRequestLocale\(/.test(text))
        .map(({ file }) => file),
    ).toEqual([]);
  });
});

describe("the database", () => {
  // An uncached read renders correctly and then ignores every later edit.
  // /admin reads the tables directly on purpose: the workbench shows what is
  // stored, not what the cache says. The login throttle is a write path.
  it("is imported only by the read layer, the admin and the login throttle", () => {
    const allowed = /^(lib\/content\.ts|lib\/auth\/throttle\.ts|app\/admin\/|db\/)/;
    const importsDb = /from\s+"(@\/db|(\.\.?\/)+db)(\/[^"]*)?"/;
    const strays = files
      .filter(({ file, text }) => !allowed.test(file) && importsDb.test(text))
      // Types and the schema's own enums carry no connection.
      .filter(({ text }) =>
        /import\s+(?!type\b)[^;]*from\s+"(@\/db|(\.\.?\/)+db)(\/index)?"/.test(text),
      );
    expect(strays.map(({ file }) => file)).toEqual([]);
  });

  it("is read in content.ts only from inside unstable_cache", () => {
    const content = files.find(({ file }) => file === "lib/content.ts");
    expect(content).toBeDefined();
    const uncached = declarations(content!.text)
      .filter((d) => /\bdb\s*\.\s*(select|query|execute|batch|\$count)/.test(d))
      .filter((d) => !/^(?:export\s+)?const\s+\w+\s*=\s*unstable_cache\(/.test(d))
      .map((d) => d.split("\n")[0]);
    expect(uncached).toEqual([]);
  });

  it("is never cached with a revalidate window in content.ts", () => {
    const content = files.find(({ file }) => file === "lib/content.ts")!;
    expect(content.text.match(/revalidate:\s*\d+/g) ?? []).toEqual([]);
  });
});

describe("admin server actions", () => {
  const actionFiles = files.filter(
    ({ file, text }) =>
      file.startsWith("app/admin/") &&
      !file.startsWith("app/admin/login/") &&
      text.startsWith('"use server";'),
  );
  const actions = actionFiles.flatMap(({ file, text }) =>
    declarations(text)
      .filter((d) => /^export\s+async\s+function\s/.test(d))
      .map((d) => ({ name: `${file}: ${d.match(/function\s+(\w+)/)![1]}`, body: body(d) })),
  );

  it("are found", () => {
    expect(actions.length).toBeGreaterThan(15);
  });

  // The proxy's check is optimistic; this is the authorization boundary.
  it("all check the session before anything else", () => {
    const late = actions.filter(({ body }) => {
      const first = body.slice(1).trim().split(";")[0]!;
      return !/\b(requireAdmin|adminSession)\(\)/.test(first);
    });
    expect(late.map(({ name }) => name)).toEqual([]);
  });

  // updateTag, through invalidate(): a save that skips it succeeds and
  // changes nothing anyone can see.
  it("all invalidate what they wrote", () => {
    expect(
      actions.filter(({ body }) => !/\binvalidate\(/.test(body)).map(({ name }) => name),
    ).toEqual([]);
  });

  // …and last: a write after it lands in a cache that has already been told
  // nothing changed. After the call, all an action may do is hand back its
  // result or leave for another page.
  it("invalidate after the last write, then only return or redirect", () => {
    const late = actions.filter(({ body }) => {
      const call = body.lastIndexOf("invalidate(");
      if (call === -1) return false;
      const rest = body.slice(body.indexOf(";", call) + 1).replace(/\}\s*$/, "");
      return rest
        .split(";")
        .map((statement) => statement.trim())
        .filter(Boolean)
        .some((statement) => !/^(?:if\s*\([^)]*\)\s*)?(?:return\b|redirect\()/.test(statement));
    });
    expect(late.map(({ name }) => name)).toEqual([]);
  });

  it("never reach for revalidateTag, which serves the saver the stale copy", () => {
    expect(
      actionFiles.filter(({ text }) => /\brevalidateTag\s*\(/.test(text)).map(({ file }) => file),
    ).toEqual([]);
  });
});

describe("admin save forms", () => {
  // React resets a <form action={fn}> when fn returns — an error included —
  // and these forms are uncontrolled, so the reset is the unsaved text. The
  // form still works and the error still shows; only the article is gone.
  it("submit through useSaveAction, never useActionState directly", () => {
    const direct = files.filter(
      ({ file, text }) =>
        file.startsWith("app/admin/") &&
        !file.startsWith("app/admin/login/") &&
        file !== "app/admin/ui/useSaveAction.ts" &&
        /\buseActionState\b/.test(text),
    );
    expect(direct.map(({ file }) => file)).toEqual([]);
  });

  // Checked form by form rather than by counting calls: a new editor that
  // wires its <form> some other way is named here. The exceptions hold
  // nothing typed worth keeping — a delete, the logout, the password box.
  it("each one, every form in the admin but the three that hold no text", () => {
    const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const forms = files.filter(
      ({ file, text }) => file.startsWith("app/admin/") && /<form\b/.test(code(text)),
    );
    expect(forms.length).toBeGreaterThan(10);
    expect(
      forms
        .filter(({ text }) => !/\buseSaveAction\(/.test(text))
        .map(({ file }) => file)
        .sort(),
    ).toEqual([
      "app/admin/AdminSidebar.tsx",
      "app/admin/DeleteRow.tsx",
      "app/admin/login/LoginForm.tsx",
    ]);
  });
});

describe("Flip animations", () => {
  // Reverting a flip that has *finished* puts back the inline styles its
  // entrance tweens recorded mid-flight: /software went A → B → all and kept
  // one of B's cards in the grid, hidden and displaced, with no error. What
  // replaces the revert is `captureGrid` in src/lib/flipGrid.ts.
  it("are never played in a useGSAP that reverts on update", () => {
    const flips = files.filter(({ text }) => /\b(Flip\.from|playGrid)\(/.test(text));
    expect(flips.length).toBeGreaterThan(2);
    const reverted = flips.filter(({ text }) => /revertOnUpdate:\s*true/.test(text));
    expect(reverted.map(({ file }) => file)).toEqual([]);
  });
});

describe("eases", () => {
  // An ease written as a string still animates — it just stops being the
  // site's motion language, one call site at a time, and nothing says so.
  // Every curve is a named token in src/lib/gsap.ts's EASE table.
  it("come from the EASE table, never as a string at the call site", () => {
    const literal = /\bease\w*\s*[:=]\s*["'`]/;
    const offenders = files
      .filter(({ file }) => file !== "lib/gsap.ts")
      .flatMap(({ file, text }) =>
        text
          // Comments may name a curve; blank them, keeping the line count.
          .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ""))
          .split("\n")
          .map((line, i) => ({ line: line.replace(/\/\/.*$/, ""), at: `${file}:${i + 1}` }))
          .filter(({ line }) => literal.test(line))
          .map(({ at }) => at),
      );
    expect(offenders).toEqual([]);
  });
});
