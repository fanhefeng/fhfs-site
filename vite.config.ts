import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

/**
 * The one configuration for the toolchain: `vp lint`, `vp fmt`, `vp check` and
 * `vp test` all read this file. Nothing here builds the site — that is still
 * `next build`, and next.config.ts.
 */

const lib = fileURLToPath(new URL("./src/lib/", import.meta.url));

/**
 * What coverage is measured over: the modules that have a test file of their
 * own name, plus the two that are tested under another's. Not all of src/lib
 * — most of it is shaders, stores and the database layer, which these tests
 * were never meant to reach, and a number averaged over those says nothing
 * about the ones that are. A module joins by getting a test.
 */
const tested = readdirSync(`${lib}__tests__`)
  .map((file) => file.replace(/\.test\.ts$/, ""))
  .flatMap((name) => [`${name}.ts`, `auth/${name}.ts`])
  .filter((file) => existsSync(lib + file))
  .concat(["assetManifest.ts", "immutable.ts"])
  .map((file) => `src/lib/${file}`);

export default defineConfig({
  lint: {
    plugins: ["react", "typescript", "unicorn", "oxc", "nextjs", "jsx-a11y"],
    categories: {
      correctness: "error",
    },
    rules: {
      "eslint/no-console": ["warn", { allow: ["warn", "error"] }],
      "eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "gsap",
              message: "Import gsap from @/lib/gsap — the plugins are registered there, once.",
            },
            { name: "@gsap/react", message: "Import useGSAP from @/lib/gsap." },
          ],
          patterns: [{ group: ["gsap/*"], message: "Import GSAP plugins from @/lib/gsap." }],
        },
      ],
      "react/exhaustive-deps": "error",
      "react/rules-of-hooks": "error",
      "react/react-in-jsx-scope": "off",
      "react/set-state-in-effect": "off",
      "react/refs": "off",
      "react/immutability": "off",
      "jsx-a11y/prefer-tag-over-role": "off",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      "jsx-a11y/no-noninteractive-tabindex": "off",
      "jsx-a11y/no-autofocus": "off",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    overrides: [
      {
        files: ["src/lib/gsap.ts", "src/lib/gsap-extras.ts"],
        rules: { "eslint/no-restricted-imports": "off" },
      },
      {
        files: ["scripts/**"],
        rules: { "eslint/no-console": "off" },
      },
    ],
    ignorePatterns: [".next", "tools", "public"],
    options: {
      // Rules that read the types (floating promises, unbound methods, …).
      // The type check itself stays with `tsc --noEmit` in `pnpm typecheck`:
      // oxlint's own is still marked experimental, and the gate should not be.
      typeAware: true,
    },
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
  },

  fmt: {
    printWidth: 100,
    sortPackageJson: false,
    ignorePatterns: [
      // Generated, vendored or written by a tool that has its own opinion.
      ".next",
      "node_modules",
      "pnpm-lock.yaml",
      "backup",
      "drizzle",
      "public",
      "patches",
      "next-env.d.ts",
      "src/lib/assets.gen.json",
      "src/app/yozai.css",
      // Prose. A formatter would re-flow tables and list markers in documents
      // that are read far more than they are diffed.
      "*.md",
      "tools",
    ],
  },

  /**
   * Unit tests for the pure helpers under src/lib — no DOM, no database, no
   * Next runtime. Anything that needs one of those is not a unit test here.
   */
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: tested,
      reporter: ["text-summary"],
      // A floor, a little under where it stands: `pnpm test:coverage` fails
      // when a change takes the tested modules below it. Raise it as they rise.
      thresholds: { statements: 93, branches: 88, functions: 90, lines: 93 },
    },
  },

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
